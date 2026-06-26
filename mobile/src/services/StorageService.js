import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';

// Keychain service identifiers. Each secret lives under its own service so
// they can be stored and cleared independently, matching the existing
// 'speack3.identity' pattern used for the Signal identity key.
const AUTH_TOKEN_SERVICE = 'speack3.auth';
const REFRESH_TOKEN_SERVICE = 'speack3.refresh';
const IDENTITY_SERVICE = 'speack3.identity';
const GROUP_KEYS_SERVICE = 'speack3.groupkeys';
// Symmetric key used to encrypt the at-rest message cache (AES via crypto-js).
const CACHE_KEY_SERVICE = 'speack3.cachekey';

// AsyncStorage key prefixes for the persisted Signal Protocol store. Sessions,
// prekeys and signed prekeys are persisted here (the identity key + registration
// id live in the Keychain / dedicated keys instead).
const SIGNAL_SESSION_PREFIX = 'signal_session_';
const SIGNAL_PREKEY_PREFIX = 'signal_prekey_';
const SIGNAL_SIGNED_PREKEY_PREFIX = 'signal_signed_prekey_';

class Storage {
    // Auth Token Management
    //
    // Access and refresh tokens are stored in the device Keychain/Keystore
    // (react-native-keychain) rather than AsyncStorage so they are not
    // recoverable in plaintext via a filesystem extraction. The method
    // names/signatures are unchanged and remain async, so ApiService and
    // SocketService (which already await them) keep working.
    async saveAuthToken(token) {
        try {
            // Keychain requires a non-empty value; clear the entry on falsy input.
            if (!token) {
                await Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE });
                return;
            }
            await Keychain.setGenericPassword('auth_token', token, {
                service: AUTH_TOKEN_SERVICE
            });
        } catch (error) {
            console.error('Save token error:', error);
        }
    }

    async getAuthToken() {
        try {
            const credentials = await Keychain.getGenericPassword({
                service: AUTH_TOKEN_SERVICE
            });
            return credentials ? credentials.password : null;
        } catch (error) {
            console.error('Get token error:', error);
            return null;
        }
    }

    async saveRefreshToken(token) {
        try {
            if (!token) {
                await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
                return;
            }
            await Keychain.setGenericPassword('refresh_token', token, {
                service: REFRESH_TOKEN_SERVICE
            });
        } catch (error) {
            console.error('Save refresh token error:', error);
        }
    }

    async getRefreshToken() {
        try {
            const credentials = await Keychain.getGenericPassword({
                service: REFRESH_TOKEN_SERVICE
            });
            return credentials ? credentials.password : null;
        } catch (error) {
            console.error('Get refresh token error:', error);
            return null;
        }
    }

    async clearAuth() {
        try {
            // Clear secrets from the Keychain (auth + refresh + Signal identity
            // + group keys + message cache key)...
            await Promise.all([
                Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: IDENTITY_SERVICE }),
                Keychain.resetGenericPassword({ service: GROUP_KEYS_SERVICE }),
                Keychain.resetGenericPassword({ service: CACHE_KEY_SERVICE })
            ]);
            this._cacheKey = null;
        } catch (error) {
            console.error('Clear auth keychain error:', error);
        }

        try {
            // ...then remove the remaining AsyncStorage items, including any
            // cached message threads (keys are prefixed with `messages_`) and
            // the persisted Signal Protocol store (sessions / prekeys).
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = ['current_user', 'registration_id', 'auth_token', 'refresh_token'];
            for (const key of keys) {
                if (
                    key.startsWith('messages_') ||
                    key.startsWith(SIGNAL_SESSION_PREFIX) ||
                    key.startsWith(SIGNAL_PREKEY_PREFIX) ||
                    key.startsWith(SIGNAL_SIGNED_PREKEY_PREFIX)
                ) {
                    toRemove.push(key);
                }
            }
            await AsyncStorage.multiRemove(toRemove);
        } catch (error) {
            console.error('Clear auth error:', error);
        }
    }

    // User Data
    async saveCurrentUser(user) {
        try {
            await AsyncStorage.setItem('current_user', JSON.stringify(user));
        } catch (error) {
            console.error('Save user error:', error);
        }
    }

    async getCurrentUser() {
        try {
            const user = await AsyncStorage.getItem('current_user');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // Signal Protocol Keys (Secure Storage)
    async saveIdentityKeyPair(keyPair) {
        try {
            const data = JSON.stringify({
                pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
                privKey: Array.from(new Uint8Array(keyPair.privKey))
            });

            await Keychain.setGenericPassword('identity_key', data, {
                service: IDENTITY_SERVICE
            });
        } catch (error) {
            console.error('Save identity key error:', error);
        }
    }

    async getIdentityKeyPair() {
        try {
            const credentials = await Keychain.getGenericPassword({
                service: IDENTITY_SERVICE
            });

            if (credentials) {
                const data = JSON.parse(credentials.password);
                return {
                    pubKey: new Uint8Array(data.pubKey).buffer,
                    privKey: new Uint8Array(data.privKey).buffer
                };
            }
            return null;
        } catch (error) {
            console.error('Get identity key error:', error);
            return null;
        }
    }

    async saveRegistrationId(id) {
        try {
            await AsyncStorage.setItem('registration_id', id.toString());
        } catch (error) {
            console.error('Save registration ID error:', error);
        }
    }

    async getRegistrationId() {
        try {
            const id = await AsyncStorage.getItem('registration_id');
            return id ? parseInt(id, 10) : null;
        } catch (error) {
            console.error('Get registration ID error:', error);
            return null;
        }
    }

    // Group encryption keys (symmetric, one per group).
    // Stored together as a JSON map in the Keychain under a single service.
    async _getGroupKeyMap() {
        try {
            const credentials = await Keychain.getGenericPassword({
                service: GROUP_KEYS_SERVICE
            });
            return credentials ? JSON.parse(credentials.password) : {};
        } catch (error) {
            console.error('Get group keys error:', error);
            return {};
        }
    }

    async saveGroupKey(groupId, keyB64) {
        try {
            const map = await this._getGroupKeyMap();
            map[groupId] = keyB64;
            await Keychain.setGenericPassword('group_keys', JSON.stringify(map), {
                service: GROUP_KEYS_SERVICE
            });
        } catch (error) {
            console.error('Save group key error:', error);
        }
    }

    async getGroupKey(groupId) {
        const map = await this._getGroupKeyMap();
        return map[groupId] || null;
    }

    // --- Message cache encryption key -------------------------------------
    //
    // A single random 256-bit key (hex string) lives in the Keychain under its
    // own service and is used to AES-encrypt the cached message bodies at rest.
    // It is generated once on first use (via the global crypto polyfill) and
    // reused thereafter. Cached in-memory after the first read to avoid a
    // Keychain round-trip on every message operation.
    async _getCacheKey() {
        if (this._cacheKey) {
            return this._cacheKey;
        }
        try {
            const credentials = await Keychain.getGenericPassword({
                service: CACHE_KEY_SERVICE
            });
            if (credentials && credentials.password) {
                this._cacheKey = credentials.password;
                return this._cacheKey;
            }

            // Generate a fresh 32-byte (256-bit) key and persist it as hex.
            const bytes = new Uint8Array(32);
            global.crypto.getRandomValues(bytes);
            let hex = '';
            for (let i = 0; i < bytes.length; i++) {
                hex += bytes[i].toString(16).padStart(2, '0');
            }

            await Keychain.setGenericPassword('cache_key', hex, {
                service: CACHE_KEY_SERVICE
            });
            this._cacheKey = hex;
            return this._cacheKey;
        } catch (error) {
            console.error('Get cache key error:', error);
            return null;
        }
    }

    // Encrypt a JS value (array of messages) to a ciphertext string for storage.
    async _encryptCache(value) {
        const key = await this._getCacheKey();
        const json = JSON.stringify(value);
        if (!key) {
            // No key available: fall back to storing plaintext rather than
            // losing the cache entirely (should not normally happen).
            return json;
        }
        return CryptoJS.AES.encrypt(json, key).toString();
    }

    // Decrypt a stored cache string back to a JS value. Returns [] for legacy
    // plaintext entries or any value that cannot be decrypted/parsed, so older
    // unencrypted caches degrade gracefully to "empty".
    async _decryptCache(stored) {
        if (!stored) {
            return [];
        }
        const key = await this._getCacheKey();
        if (!key) {
            return [];
        }
        try {
            const bytes = CryptoJS.AES.decrypt(stored, key);
            const json = bytes.toString(CryptoJS.enc.Utf8);
            if (!json) {
                return [];
            }
            const parsed = JSON.parse(json);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            // Legacy plaintext or corrupt entry: treat as empty cache.
            return [];
        }
    }

    // Message Cache
    //
    // The cache keeps the last 100 decrypted messages per chat. Bodies are now
    // encrypted at rest with AES (crypto-js) under a random per-install key held
    // in the Keychain (CACHE_KEY_SERVICE), so a filesystem/backup extraction no
    // longer yields plaintext message bodies. Legacy plaintext entries written
    // before this change cannot be decrypted and are treated as an empty cache
    // (see _decryptCache). The cache is wiped on logout via clearAuth() and via
    // clearMessages()/clearAll(), and the cache key is reset alongside it.
    async saveMessage(chatId, message) {
        try {
            const key = `messages_${chatId}`;
            const existing = await AsyncStorage.getItem(key);
            const messages = await this._decryptCache(existing);

            messages.push(message);

            // Keep only last 100 messages per chat
            if (messages.length > 100) {
                messages.shift();
            }

            await AsyncStorage.setItem(key, await this._encryptCache(messages));
        } catch (error) {
            console.error('Save message error:', error);
        }
    }

    async getMessages(chatId) {
        try {
            const key = `messages_${chatId}`;
            const data = await AsyncStorage.getItem(key);
            return await this._decryptCache(data);
        } catch (error) {
            console.error('Get messages error:', error);
            return [];
        }
    }

    // Update a cached message (e.g. after an edit). The updater receives the
    // existing message and returns the new message object.
    async updateMessage(chatId, messageId, updater) {
        try {
            const key = `messages_${chatId}`;
            const existing = await AsyncStorage.getItem(key);
            if (!existing) {
                return;
            }

            const messages = await this._decryptCache(existing);
            const next = messages.map(msg => {
                const id = msg.id ?? msg._id;
                return id?.toString() === messageId?.toString() ? updater(msg) : msg;
            });

            await AsyncStorage.setItem(key, await this._encryptCache(next));
        } catch (error) {
            console.error('Update message error:', error);
        }
    }

    // Mark a cached message as deleted (keeps it in place as a tombstone)
    async markMessageDeleted(chatId, messageId) {
        await this.updateMessage(chatId, messageId, (msg) => ({
            ...msg,
            deleted: true,
            content: ''
        }));
    }

    async clearMessages(chatId) {
        try {
            const key = `messages_${chatId}`;
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.error('Clear messages error:', error);
        }
    }

    // Complete cleanup
    async clearAll() {
        try {
            await AsyncStorage.clear();
            await Promise.all([
                Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: IDENTITY_SERVICE }),
                Keychain.resetGenericPassword({ service: GROUP_KEYS_SERVICE }),
                Keychain.resetGenericPassword({ service: CACHE_KEY_SERVICE })
            ]);
            this._cacheKey = null;
        } catch (error) {
            console.error('Clear all error:', error);
        }
    }

    // ---------------------------------------------------------------------
    // Signal Protocol store persistence
    //
    // The SignalProtocolStore keeps sessions / prekeys / signed prekeys in an
    // in-memory Map; these helpers back that Map with AsyncStorage so the
    // cryptographic state survives an app restart. Values are JSON-serialized.
    //
    // - Sessions are SessionRecordType (plain strings produced by
    //   record.serialize()), so they are stored verbatim as JSON strings.
    // - PreKeys / signed prekeys are KeyPairType ({ pubKey, privKey } as
    //   ArrayBuffers); each ArrayBuffer is serialized to a base64 string and
    //   rehydrated back into an ArrayBuffer on load.
    // ---------------------------------------------------------------------

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return global.btoa(binary);
    }

    _base64ToArrayBuffer(base64) {
        const binary = global.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    _serializeKeyPair(keyPair) {
        return JSON.stringify({
            pubKey: this._arrayBufferToBase64(keyPair.pubKey),
            privKey: this._arrayBufferToBase64(keyPair.privKey)
        });
    }

    _deserializeKeyPair(json) {
        const data = JSON.parse(json);
        return {
            pubKey: this._base64ToArrayBuffer(data.pubKey),
            privKey: this._base64ToArrayBuffer(data.privKey)
        };
    }

    // --- Sessions (record is a serialized string) ---
    async saveSignalSession(encodedAddress, record) {
        try {
            await AsyncStorage.setItem(
                SIGNAL_SESSION_PREFIX + encodedAddress,
                JSON.stringify(record)
            );
        } catch (error) {
            console.error('Save signal session error:', error);
        }
    }

    async getSignalSession(encodedAddress) {
        try {
            const data = await AsyncStorage.getItem(SIGNAL_SESSION_PREFIX + encodedAddress);
            return data != null ? JSON.parse(data) : undefined;
        } catch (error) {
            console.error('Get signal session error:', error);
            return undefined;
        }
    }

    async removeSignalSession(encodedAddress) {
        try {
            await AsyncStorage.removeItem(SIGNAL_SESSION_PREFIX + encodedAddress);
        } catch (error) {
            console.error('Remove signal session error:', error);
        }
    }

    // --- PreKeys (KeyPairType) ---
    async saveSignalPreKey(keyId, keyPair) {
        try {
            await AsyncStorage.setItem(
                SIGNAL_PREKEY_PREFIX + keyId,
                this._serializeKeyPair(keyPair)
            );
        } catch (error) {
            console.error('Save signal prekey error:', error);
        }
    }

    async getSignalPreKey(keyId) {
        try {
            const data = await AsyncStorage.getItem(SIGNAL_PREKEY_PREFIX + keyId);
            return data != null ? this._deserializeKeyPair(data) : undefined;
        } catch (error) {
            console.error('Get signal prekey error:', error);
            return undefined;
        }
    }

    async removeSignalPreKey(keyId) {
        try {
            await AsyncStorage.removeItem(SIGNAL_PREKEY_PREFIX + keyId);
        } catch (error) {
            console.error('Remove signal prekey error:', error);
        }
    }

    // --- Signed PreKeys (KeyPairType) ---
    async saveSignalSignedPreKey(keyId, keyPair) {
        try {
            await AsyncStorage.setItem(
                SIGNAL_SIGNED_PREKEY_PREFIX + keyId,
                this._serializeKeyPair(keyPair)
            );
        } catch (error) {
            console.error('Save signal signed prekey error:', error);
        }
    }

    async getSignalSignedPreKey(keyId) {
        try {
            const data = await AsyncStorage.getItem(SIGNAL_SIGNED_PREKEY_PREFIX + keyId);
            return data != null ? this._deserializeKeyPair(data) : undefined;
        } catch (error) {
            console.error('Get signal signed prekey error:', error);
            return undefined;
        }
    }

    async removeSignalSignedPreKey(keyId) {
        try {
            await AsyncStorage.removeItem(SIGNAL_SIGNED_PREKEY_PREFIX + keyId);
        } catch (error) {
            console.error('Remove signal signed prekey error:', error);
        }
    }
}

const storageService = new Storage();

export default storageService;
