// Round-trip tests for the pure-JS Curve25519 adapter (mobile/src/signalCurve.js).
//
// signalCurve.js wraps curve25519-js into the shape libsignal's AsyncCurve
// expects and registers it via setCurve(). It exports the adapter object as
// default, which is what we exercise here. The adapter is the layer that "cost
// so much to get right": buffer formats (always fresh ArrayBuffers), the
// Diffie-Hellman argument order, and the INVERTED verify() convention.

// Importing the module runs setCurve(adapter) (harmless in tests) and returns
// the adapter object.
const adapter = require('../src/signalCurve').default;

// Deterministic 32-byte seed -> keypair via the adapter.
function keyPairFromSeed(byte) {
    const seed = new Uint8Array(32).fill(byte);
    return adapter.keyPair(seed.buffer);
}

const u8 = (ab) => new Uint8Array(ab);

describe('signalCurve adapter', () => {
    test('keyPair returns 32-byte pub/priv ArrayBuffers', () => {
        const kp = keyPairFromSeed(1);
        expect(kp.pubKey).toBeInstanceOf(ArrayBuffer);
        expect(kp.privKey).toBeInstanceOf(ArrayBuffer);
        expect(kp.pubKey.byteLength).toBe(32);
        expect(kp.privKey.byteLength).toBe(32);
    });

    test('Diffie-Hellman: sharedSecret is symmetric', () => {
        const A = keyPairFromSeed(7);
        const B = keyPairFromSeed(42);

        // adapter.sharedSecret(theirPub, myPriv)
        const ssAB = adapter.sharedSecret(B.pubKey, A.privKey);
        const ssBA = adapter.sharedSecret(A.pubKey, B.privKey);

        expect(ssAB).toBeInstanceOf(ArrayBuffer);
        expect(ssAB.byteLength).toBe(32);
        expect(Array.from(u8(ssAB))).toEqual(Array.from(u8(ssBA)));
    });

    test('Diffie-Hellman: different pairs yield different secrets', () => {
        const A = keyPairFromSeed(7);
        const B = keyPairFromSeed(42);
        const C = keyPairFromSeed(99);

        const ssAB = Array.from(u8(adapter.sharedSecret(B.pubKey, A.privKey)));
        const ssAC = Array.from(u8(adapter.sharedSecret(C.pubKey, A.privKey)));

        expect(ssAB).not.toEqual(ssAC);
    });

    test('sign produces a 64-byte signature', () => {
        const A = keyPairFromSeed(7);
        const message = new TextEncoder().encode('sign me').buffer;
        const sig = adapter.sign(A.privKey, message);
        expect(sig).toBeInstanceOf(ArrayBuffer);
        expect(sig.byteLength).toBe(64);
    });

    test('verify uses the INVERTED libsignal convention: valid signature -> false', () => {
        const A = keyPairFromSeed(7);
        const message = new TextEncoder().encode('authentic message').buffer;
        const sig = adapter.sign(A.privKey, message);

        // libsignal's Ed25519Verify treats a TRUTHY result as INVALID, so the
        // adapter returns FALSE for a genuinely valid signature.
        const result = adapter.verify(A.pubKey, message, sig);
        expect(result).toBe(false);
    });

    test('verify: tampered signature -> true (i.e. reported invalid)', () => {
        const A = keyPairFromSeed(7);
        const message = new TextEncoder().encode('authentic message').buffer;
        const sig = adapter.sign(A.privKey, message);

        // Flip a byte in the signature.
        const bad = u8(sig).slice();
        bad[0] ^= 0xff;

        const result = adapter.verify(A.pubKey, message, bad.buffer);
        expect(result).toBe(true);
    });

    test('verify: tampered message -> true (reported invalid)', () => {
        const A = keyPairFromSeed(7);
        const message = new TextEncoder().encode('authentic message').buffer;
        const sig = adapter.sign(A.privKey, message);

        const otherMessage = new TextEncoder().encode('forged message').buffer;
        const result = adapter.verify(A.pubKey, otherMessage, sig);
        expect(result).toBe(true);
    });

    test('verify: wrong public key -> true (reported invalid)', () => {
        const A = keyPairFromSeed(7);
        const B = keyPairFromSeed(42);
        const message = new TextEncoder().encode('authentic message').buffer;
        const sig = adapter.sign(A.privKey, message);

        // Verify A's signature against B's public key.
        const result = adapter.verify(B.pubKey, message, sig);
        expect(result).toBe(true);
    });
});
