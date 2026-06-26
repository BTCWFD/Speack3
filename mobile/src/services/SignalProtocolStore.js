// SignalProtocolStore implementing the StorageType interface that
// @privacyresearch/libsignal-protocol-typescript expects (the library does NOT
// ship a store — the app must provide one).
//
// PERSISTENCE: sessions, prekeys and signed prekeys now survive an app restart.
// The store keeps an in-memory Map as a write-through cache and mirrors every
// write to StorageService (AsyncStorage-backed). Reads consult the Map first
// and fall back to StorageService (read-through), so even though the store is
// constructed synchronously, the async StorageType reads transparently rehydrate
// state persisted in a previous run.
//
// The identity key pair and the local registration id are already persisted by
// SignalService via StorageService.saveIdentityKeyPair/saveRegistrationId, so we
// read those back directly from StorageService rather than duplicating them.
//
// Map key conventions (kept identical to the original in-memory store so the
// `put('identityKey'|'registrationId', ...)` calls from SignalService.initialize
// keep working unchanged):
//   identityKey                 -> identity key pair (seeded by SignalService)
//   registrationId              -> local registration id (seeded by SignalService)
//   identityKey<address>        -> a peer's trusted public identity key
//   25519KeypreKey<id>          -> a prekey KeyPairType
//   25519KeysignedKey<id>       -> a signed prekey KeyPairType
//   session<encodedAddress>     -> a serialized session record (string)

import StorageService from './StorageService';

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
    // These remain synchronous and Map-only. SignalService uses them solely to
    // seed 'identityKey' and 'registrationId' (which are persisted elsewhere by
    // SignalService), so no extra persistence is required here.
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

    // Optional explicit hydration hook. Not required for correctness (reads are
    // read-through), but SignalService could call it after construction to warm
    // the in-memory cache. Currently a no-op placeholder kept for forward
    // compatibility; per-key lazy loading happens in the load* methods below.
    async hydrate() {
        return true;
    }

    // --- StorageType: identity ---
    // Identity key + registration id are owned/persisted by SignalService via
    // StorageService; prefer the in-memory seed, fall back to StorageService.
    async getIdentityKeyPair() {
        const cached = this.get('identityKey');
        if (cached !== undefined) {
            return cached;
        }
        const persisted = await StorageService.getIdentityKeyPair();
        if (persisted) {
            this.put('identityKey', persisted);
            return persisted;
        }
        return undefined;
    }

    async getLocalRegistrationId() {
        const cached = this.get('registrationId');
        if (cached !== undefined) {
            return cached;
        }
        const persisted = await StorageService.getRegistrationId();
        if (persisted != null) {
            this.put('registrationId', persisted);
            return persisted;
        }
        return undefined;
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
        // Peer identity keys are only needed for trust-on-first-use within a
        // session lifetime; they are not persisted across restarts (TOFU resets
        // to "trust" on a fresh launch, matching the original behavior).
        return existing !== undefined && !arrayBufferEquals(existing, publicKey);
    }

    // --- StorageType: prekeys ---
    async loadPreKey(keyId) {
        const cached = this.get('25519KeypreKey' + keyId);
        if (cached !== undefined) {
            return cached;
        }
        const persisted = await StorageService.getSignalPreKey(keyId);
        if (persisted !== undefined) {
            this.put('25519KeypreKey' + keyId, persisted);
        }
        return persisted;
    }

    async storePreKey(keyId, keyPair) {
        this.put('25519KeypreKey' + keyId, keyPair);
        await StorageService.saveSignalPreKey(keyId, keyPair);
    }

    async removePreKey(keyId) {
        this.remove('25519KeypreKey' + keyId);
        await StorageService.removeSignalPreKey(keyId);
    }

    // --- StorageType: signed prekeys ---
    async loadSignedPreKey(keyId) {
        const cached = this.get('25519KeysignedKey' + keyId);
        if (cached !== undefined) {
            return cached;
        }
        const persisted = await StorageService.getSignalSignedPreKey(keyId);
        if (persisted !== undefined) {
            this.put('25519KeysignedKey' + keyId, persisted);
        }
        return persisted;
    }

    async storeSignedPreKey(keyId, keyPair) {
        this.put('25519KeysignedKey' + keyId, keyPair);
        await StorageService.saveSignalSignedPreKey(keyId, keyPair);
    }

    async removeSignedPreKey(keyId) {
        this.remove('25519KeysignedKey' + keyId);
        await StorageService.removeSignalSignedPreKey(keyId);
    }

    // --- StorageType: sessions ---
    async loadSession(encodedAddress) {
        const cached = this.get('session' + encodedAddress);
        if (cached !== undefined) {
            return cached;
        }
        const persisted = await StorageService.getSignalSession(encodedAddress);
        if (persisted !== undefined) {
            this.put('session' + encodedAddress, persisted);
        }
        return persisted;
    }

    async storeSession(encodedAddress, record) {
        this.put('session' + encodedAddress, record);
        await StorageService.saveSignalSession(encodedAddress, record);
    }

    async removeSession(encodedAddress) {
        this.remove('session' + encodedAddress);
        await StorageService.removeSignalSession(encodedAddress);
    }

    async removeAllSessions(identifier) {
        const removals = [];
        for (const key of Array.from(this._store.keys())) {
            if (key.startsWith('session' + identifier)) {
                this._store.delete(key);
                // Mirror the deletion to persistence (strip the 'session' prefix
                // to recover the encodedAddress used as the storage key).
                removals.push(
                    StorageService.removeSignalSession(key.slice('session'.length))
                );
            }
        }
        await Promise.all(removals);
    }
}

export default SignalProtocolStore;
