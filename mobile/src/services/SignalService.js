import {
    SignalProtocolAddress,
    SessionBuilder,
    SessionCipher,
    KeyHelper
} from '@privacyresearch/libsignal-protocol-typescript';
// This library does not ship a store; we provide one implementing StorageType.
import SignalProtocolStore from './SignalProtocolStore';
import StorageService from './StorageService';
import CryptoJS from 'crypto-js';

class SignalProtocolManager {
    constructor() {
        this.store = null;
        this.registrationId = null;
        // Library has no nextId tracking; we manage prekey ids ourselves.
        this.nextPreKeyId = 1;
        this.nextSignedPreKeyId = 1;
    }

    // Initialize Signal Protocol for current user
    async initialize(userId) {
        try {
            // Generate or load identity key pair
            let identityKeyPair = await StorageService.getIdentityKeyPair();

            if (!identityKeyPair) {
                identityKeyPair = await KeyHelper.generateIdentityKeyPair();
                await StorageService.saveIdentityKeyPair(identityKeyPair);
            }

            // Generate or load registration ID
            this.registrationId = await StorageService.getRegistrationId();

            if (!this.registrationId) {
                this.registrationId = KeyHelper.generateRegistrationId();
                await StorageService.saveRegistrationId(this.registrationId);
            }

            // Create Signal Protocol Store
            this.store = new SignalProtocolStore();
            await this.store.put('identityKey', identityKeyPair);
            await this.store.put('registrationId', this.registrationId);

            console.log('✅ Signal Protocol initialized');
            return true;
        } catch (error) {
            console.error('Signal Protocol initialization error:', error);
            throw error;
        }
    }

    // Generate prekeys for server upload. The library exposes generatePreKey
    // (singular), so we loop and assign ids ourselves.
    async generatePreKeys(count = 100) {
        try {
            const preKeysForServer = [];
            for (let i = 0; i < count; i++) {
                const keyId = this.nextPreKeyId++;
                const preKey = await KeyHelper.generatePreKey(keyId);
                await this.store.storePreKey(preKey.keyId, preKey.keyPair);
                preKeysForServer.push({
                    keyId: preKey.keyId,
                    publicKey: this.arrayBufferToBase64(preKey.keyPair.pubKey)
                });
            }
            return preKeysForServer;
        } catch (error) {
            console.error('PreKey generation error:', error);
            throw error;
        }
    }

    // Generate signed prekey
    async generateSignedPreKey() {
        try {
            const identityKeyPair = await this.store.getIdentityKeyPair();
            const keyId = this.nextSignedPreKeyId++;
            const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, keyId);

            await this.store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

            return {
                keyId: signedPreKey.keyId,
                publicKey: this.arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                signature: this.arrayBufferToBase64(signedPreKey.signature)
            };
        } catch (error) {
            console.error('Signed PreKey generation error:', error);
            throw error;
        }
    }

    // Get public identity key
    async getPublicIdentityKey() {
        try {
            const identityKeyPair = await this.store.getIdentityKeyPair();
            return this.arrayBufferToBase64(identityKeyPair.pubKey);
        } catch (error) {
            console.error('Get public key error:', error);
            throw error;
        }
    }

    // Get the LOCAL identity public key in base64. Thin alias over
    // getPublicIdentityKey() so callers (e.g. identity verification UI) can be
    // explicit about wanting *our* key, mirroring the remote key from the API.
    async getLocalIdentityPublicBase64() {
        return this.getPublicIdentityKey();
    }

    // Derive a deterministic, SYMMETRIC "safety number" from two public
    // identity keys (both base64). Same result regardless of argument order and
    // identical on both devices for the same pair of users, so two people can
    // read it aloud / compare out-of-band to detect a MITM.
    //
    // Algorithm (pragmatic, NOT Signal's exact fingerprint spec):
    //   1. Sort the two base64 keys lexicographically (makes it symmetric).
    //   2. Concatenate them.
    //   3. SHA-256 the concatenation (crypto-js -> hex digest).
    //   4. Take pairs of hex digits (bytes) from the digest, turn each into a
    //      number in [0, 65535] and map it into a 5-digit decimal block, giving
    //      12 blocks of 5 digits (60 digits total), grouped Signal-style.
    //
    // This is deterministic, symmetric and comparable across devices. It is
    // NOT interoperable with Signal's real safety numbers.
    computeSafetyNumber(localKeyB64, remoteKeyB64) {
        if (!localKeyB64 || !remoteKeyB64) {
            return null;
        }

        // Symmetric: order-independent by sorting before concatenation.
        const [a, b] = [String(localKeyB64), String(remoteKeyB64)].sort();
        const digestHex = CryptoJS.SHA256(a + b).toString(CryptoJS.enc.Hex);

        const blocks = [];
        // 12 blocks: each consumes 4 hex chars (2 bytes => 0..65535), formatted
        // as a zero-padded 5-digit decimal number.
        for (let i = 0; i < 12; i++) {
            const chunk = digestHex.substr(i * 4, 4);
            const value = parseInt(chunk, 16) % 100000;
            blocks.push(String(value).padStart(5, '0'));
        }
        return blocks.join(' ');
    }

    // Encrypt message for recipient
    async encryptMessage(recipientId, message) {
        try {
            const address = new SignalProtocolAddress(recipientId, 1);
            const sessionCipher = new SessionCipher(this.store, address);

            const ciphertext = await sessionCipher.encrypt(
                this.stringToArrayBuffer(message)
            );

            return {
                type: ciphertext.type,
                body: this.arrayBufferToBase64(ciphertext.body),
                registrationId: ciphertext.registrationId
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    // Decrypt message from sender
    async decryptMessage(senderId, encryptedMessage) {
        try {
            const address = new SignalProtocolAddress(senderId, 1);
            const sessionCipher = new SessionCipher(this.store, address);

            const ciphertext = {
                type: encryptedMessage.type,
                // libsignal's decrypt*(... , 'binary') expects a binary (latin1)
                // string, which is exactly what atob() produces.
                body: atob(encryptedMessage.body),
                registrationId: encryptedMessage.registrationId
            };

            let plaintext;

            if (ciphertext.type === 3) {
                // PreKey message (first message in session)
                plaintext = await sessionCipher.decryptPreKeyWhisperMessage(
                    ciphertext.body,
                    'binary'
                );
            } else {
                // Normal message
                plaintext = await sessionCipher.decryptWhisperMessage(
                    ciphertext.body,
                    'binary'
                );
            }

            return this.arrayBufferToString(plaintext);
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    }

    // Build session with recipient (before first message)
    async buildSession(recipientId, preKeyBundle) {
        try {
            const address = new SignalProtocolAddress(recipientId, 1);
            const sessionBuilder = new SessionBuilder(this.store, address);

            const preKeyBundleObj = {
                identityKey: this.base64ToArrayBuffer(preKeyBundle.identityKeyPublic),
                registrationId: preKeyBundle.registrationId,
                preKey: preKeyBundle.preKey ? {
                    keyId: preKeyBundle.preKey.keyId,
                    publicKey: this.base64ToArrayBuffer(preKeyBundle.preKey.publicKey)
                } : null,
                signedPreKey: {
                    keyId: preKeyBundle.signedPreKey.keyId,
                    publicKey: this.base64ToArrayBuffer(preKeyBundle.signedPreKey.publicKey),
                    signature: this.base64ToArrayBuffer(preKeyBundle.signedPreKey.signature)
                }
            };

            await sessionBuilder.processPreKey(preKeyBundleObj);
            console.log(`✅ Session built with ${recipientId}`);
            return true;
        } catch (error) {
            console.error('Build session error:', error);
            throw error;
        }
    }

    // True if a pairwise session already exists with the given user.
    async hasSession(recipientId) {
        try {
            const address = new SignalProtocolAddress(recipientId, 1);
            const session = await this.store.loadSession(address.toString());
            return !!session;
        } catch (error) {
            return false;
        }
    }

    // Helper: ArrayBuffer (or binary string) to Base64.
    // libsignal returns ciphertext bodies as binary (latin1) strings, so accept
    // both a string and an ArrayBuffer/typed array.
    arrayBufferToBase64(buffer) {
        if (typeof buffer === 'string') {
            return btoa(buffer);
        }
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Helper: Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Helper: String to ArrayBuffer (libsignal requires a real ArrayBuffer,
    // not a Uint8Array view).
    stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    }

    // Helper: ArrayBuffer to String
    arrayBufferToString(buffer) {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
    }
}

// Create a singleton instance
const signalService = new SignalProtocolManager();

export default signalService;
