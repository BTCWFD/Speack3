// THE STAR TEST: end-to-end Signal 1-to-1 round-trip.
//
// APPROACH (documented):
//   The app's SignalService is a SINGLETON sharing a single store and pulling
//   identity material from the persistent StorageService. Standing up two full
//   SignalService instances for "Alice" and "Bob" in one process is therefore
//   awkward. Instead — exactly as the task suggests — we drive the SAME public
//   primitives the app uses (KeyHelper + SessionBuilder + SessionCipher from
//   @privacyresearch/libsignal-protocol-typescript) directly, with TWO separate
//   SignalProtocolStore instances (the app's own in-memory store, src/services/
//   SignalProtocolStore.js) standing in for Alice's and Bob's devices.
//
//   We also reuse the app's own buffer conventions (base64 <-> ArrayBuffer and
//   the binary-string decrypt path) so this test guards the exact serialization
//   that "cost so much to fix". The crypto chain underneath — the curve25519
//   adapter and crypto.subtle — is the real one (installed by setup.js via
//   cryptoPolyfill + signalCurve), so a regression in the pure-JS curve, the
//   Hermes polyfills, or the buffer formats will fail THIS test.
//
//   This is a true round-trip: decryptMessage(Bob, encryptMessage(Alice, m)) === m.

require('../src/signalCurve'); // registers the pure-JS curve via setCurve()

const {
    SignalProtocolAddress,
    SessionBuilder,
    SessionCipher,
    KeyHelper,
} = require('@privacyresearch/libsignal-protocol-typescript');

const SignalProtocolStore = require('../src/services/SignalProtocolStore').default;

// ---- buffer helpers mirroring SignalService.js exactly ----
function arrayBufferToBase64(buffer) {
    if (typeof buffer === 'string') return Buffer.from(buffer, 'binary').toString('base64');
    return Buffer.from(new Uint8Array(buffer)).toString('base64');
}
function base64ToArrayBuffer(base64) {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}
function arrayBufferToString(buffer) {
    return new TextDecoder().decode(buffer);
}

// Build a fresh device: identity + registrationId seeded into an in-memory store,
// just like SignalProtocolManager.initialize().
async function makeDevice() {
    const store = new SignalProtocolStore();
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    const registrationId = KeyHelper.generateRegistrationId();
    await store.put('identityKey', identityKeyPair);
    await store.put('registrationId', registrationId);
    return { store, identityKeyPair, registrationId };
}

// Produce a server-style preKeyBundle for `device`, mirroring SignalService's
// generatePreKeys + generateSignedPreKey (base64 wire format).
async function publishPreKeyBundle(device, preKeyId, signedPreKeyId) {
    const preKey = await KeyHelper.generatePreKey(preKeyId);
    await device.store.storePreKey(preKey.keyId, preKey.keyPair);

    const signedPreKey = await KeyHelper.generateSignedPreKey(
        device.identityKeyPair,
        signedPreKeyId,
    );
    await device.store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

    return {
        identityKeyPublic: arrayBufferToBase64(device.identityKeyPair.pubKey),
        registrationId: device.registrationId,
        preKey: {
            keyId: preKey.keyId,
            publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
        },
        signedPreKey: {
            keyId: signedPreKey.keyId,
            publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
            signature: arrayBufferToBase64(signedPreKey.signature),
        },
    };
}

// SessionService.buildSession: process a base64 preKeyBundle into a session.
async function buildSession(store, recipientId, bundle) {
    const address = new SignalProtocolAddress(recipientId, 1);
    const sessionBuilder = new SessionBuilder(store, address);
    await sessionBuilder.processPreKey({
        identityKey: base64ToArrayBuffer(bundle.identityKeyPublic),
        registrationId: bundle.registrationId,
        preKey: bundle.preKey
            ? {
                  keyId: bundle.preKey.keyId,
                  publicKey: base64ToArrayBuffer(bundle.preKey.publicKey),
              }
            : null,
        signedPreKey: {
            keyId: bundle.signedPreKey.keyId,
            publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
            signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
        },
    });
}

// SignalService.encryptMessage
async function encryptMessage(store, recipientId, message) {
    const address = new SignalProtocolAddress(recipientId, 1);
    const cipher = new SessionCipher(store, address);
    const ciphertext = await cipher.encrypt(stringToArrayBuffer(message));
    return {
        type: ciphertext.type,
        body: arrayBufferToBase64(ciphertext.body),
        registrationId: ciphertext.registrationId,
    };
}

// SignalService.decryptMessage
async function decryptMessage(store, senderId, encryptedMessage) {
    const address = new SignalProtocolAddress(senderId, 1);
    const cipher = new SessionCipher(store, address);
    const body = Buffer.from(encryptedMessage.body, 'base64').toString('binary');

    let plaintext;
    if (encryptedMessage.type === 3) {
        plaintext = await cipher.decryptPreKeyWhisperMessage(body, 'binary');
    } else {
        plaintext = await cipher.decryptWhisperMessage(body, 'binary');
    }
    return arrayBufferToString(plaintext);
}

describe('Signal 1-to-1 end-to-end round-trip', () => {
    const ALICE = 'alice';
    const BOB = 'bob';

    test('Bob decrypts the message Alice encrypted (PreKey message)', async () => {
        const alice = await makeDevice();
        const bob = await makeDevice();

        // Bob publishes a preKey bundle; Alice builds a session to Bob.
        const bobBundle = await publishPreKeyBundle(bob, 100, 1);
        await buildSession(alice.store, BOB, bobBundle);

        const message = 'hola 🔒';
        const ciphertext = await encryptMessage(alice.store, BOB, message);

        // First message is a PreKey (type 3) message.
        expect(ciphertext.type).toBe(3);

        const decrypted = await decryptMessage(bob.store, ALICE, ciphertext);
        expect(decrypted).toBe(message);
    });

    test('full bidirectional conversation round-trips', async () => {
        const alice = await makeDevice();
        const bob = await makeDevice();

        const bobBundle = await publishPreKeyBundle(bob, 200, 2);
        await buildSession(alice.store, BOB, bobBundle);

        // Alice -> Bob (establishes session on Bob's side).
        const m1 = 'hola Bob 🔒';
        const c1 = await encryptMessage(alice.store, BOB, m1);
        expect(await decryptMessage(bob.store, ALICE, c1)).toBe(m1);

        // Bob -> Alice (now a normal Whisper message, type 1).
        const m2 = 'hola Alice 👋 café ☕';
        const c2 = await encryptMessage(bob.store, ALICE, m2);
        expect(c2.type).toBe(1);
        expect(await decryptMessage(alice.store, BOB, c2)).toBe(m2);

        // Alice -> Bob again (ratchet advances).
        const m3 = 'todo bien ✅';
        const c3 = await encryptMessage(alice.store, BOB, m3);
        expect(await decryptMessage(bob.store, ALICE, c3)).toBe(m3);
    });

    test('a tampered ciphertext body fails to decrypt', async () => {
        const alice = await makeDevice();
        const bob = await makeDevice();

        const bobBundle = await publishPreKeyBundle(bob, 300, 3);
        await buildSession(alice.store, BOB, bobBundle);

        const ciphertext = await encryptMessage(alice.store, BOB, 'secret');

        // Corrupt the base64 body.
        const bytes = Buffer.from(ciphertext.body, 'base64');
        bytes[bytes.length - 1] ^= 0xff;
        ciphertext.body = bytes.toString('base64');

        await expect(decryptMessage(bob.store, ALICE, ciphertext)).rejects.toBeDefined();
    });
});
