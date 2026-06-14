import {
    SignalProtocolAddress,
    SessionBuilder,
    SessionCipher,
    KeyHelper,
    SignalProtocolStore
} from '@privacyresearch/libsignal-protocol-typescript';
import StorageService from './StorageService';

class SignalProtocolManager {
    constructor() {
        this.store = null;
        this.registrationId = null;
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

    // Generate prekeys for server upload
    async generatePreKeys(count = 100) {
        try {
            const preKeys = await KeyHelper.generatePreKeys(
                await this.store.getNextPreKeyId(),
                count
            );

            // Save prekeys locally
            for (const preKey of preKeys) {
                await this.store.storePreKey(preKey.keyId, preKey.keyPair);
            }

            // Format for server
            const preKeysForServer = preKeys.map(pk => ({
                keyId: pk.keyId,
                publicKey: this.arrayBufferToBase64(pk.keyPair.pubKey)
            }));

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
            const signedPreKey = await KeyHelper.generateSignedPreKey(
                identityKeyPair,
                await this.store.getNextSignedPreKeyId()
            );

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
                body: this.base64ToArrayBuffer(encryptedMessage.body),
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

    // Helper: ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
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

    // Helper: String to ArrayBuffer
    stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
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
