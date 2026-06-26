// Minimal SignalProtocolStore implementing the StorageType interface that
// @privacyresearch/libsignal-protocol-typescript expects (the library does NOT
// ship a store — the app must provide one). Backed by an in-memory Map.
//
// NOTE: sessions/prekeys live in memory for now (lost on app restart). Identity
// key + registrationId are seeded from persistent storage by SignalService.
// Persisting sessions is a follow-up.

const arrayBufferEquals = (a, b) => {
    if (!a || !b) return false;
    const ua = new Uint8Array(a);
    const ub = new Uint8Array(b);
    if (ua.length !== ub.length) return false;
    for (let i = 0; i < ua.length; i++) {
        if (ua[i] !== ub[i]) return false;
    }
    return true;
};

class SignalProtocolStore {
    constructor() {
        this._store = new Map();
    }

    // --- generic helpers used by SignalService ---
    put(key, value) {
        if (key === undefined || value === undefined) {
            throw new Error('Tried to store undefined');
        }
        this._store.set(key, value);
    }

    get(key, defaultValue) {
        return this._store.has(key) ? this._store.get(key) : defaultValue;
    }

    remove(key) {
        this._store.delete(key);
    }

    // --- StorageType: identity ---
    async getIdentityKeyPair() {
        return this.get('identityKey');
    }

    async getLocalRegistrationId() {
        return this.get('registrationId');
    }

    async isTrustedIdentity(identifier, identityKey /*, direction */) {
        if (identifier == null) {
            throw new Error('tried to check identity key for undefined/null key');
        }
        const trusted = this.get('identityKey' + identifier);
        if (trusted === undefined) {
            return true; // trust on first use
        }
        return arrayBufferEquals(identityKey, trusted);
    }

    async saveIdentity(encodedAddress, publicKey) {
        if (encodedAddress == null) {
            throw new Error('tried to save identity for undefined/null key');
        }
        const address = encodedAddress.split('.')[0];
        const existing = this.get('identityKey' + address);
        this.put('identityKey' + address, publicKey);
        return existing !== undefined && !arrayBufferEquals(existing, publicKey);
    }

    // --- StorageType: prekeys ---
    async loadPreKey(keyId) {
        return this.get('25519KeypreKey' + keyId);
    }

    async storePreKey(keyId, keyPair) {
        this.put('25519KeypreKey' + keyId, keyPair);
    }

    async removePreKey(keyId) {
        this.remove('25519KeypreKey' + keyId);
    }

    // --- StorageType: signed prekeys ---
    async loadSignedPreKey(keyId) {
        return this.get('25519KeysignedKey' + keyId);
    }

    async storeSignedPreKey(keyId, keyPair) {
        this.put('25519KeysignedKey' + keyId, keyPair);
    }

    async removeSignedPreKey(keyId) {
        this.remove('25519KeysignedKey' + keyId);
    }

    // --- StorageType: sessions ---
    async loadSession(encodedAddress) {
        return this.get('session' + encodedAddress);
    }

    async storeSession(encodedAddress, record) {
        this.put('session' + encodedAddress, record);
    }

    async removeSession(encodedAddress) {
        this.remove('session' + encodedAddress);
    }

    async removeAllSessions(identifier) {
        for (const key of this._store.keys()) {
            if (key.startsWith('session' + identifier)) {
                this._store.delete(key);
            }
        }
    }
}

export default SignalProtocolStore;
