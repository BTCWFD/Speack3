import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// Keychain service identifiers. Each secret lives under its own service so
// they can be stored and cleared independently, matching the existing
// 'speack3.identity' pattern used for the Signal identity key.
const AUTH_TOKEN_SERVICE = 'speack3.auth';
const REFRESH_TOKEN_SERVICE = 'speack3.refresh';
const IDENTITY_SERVICE = 'speack3.identity';

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
            // Clear secrets from the Keychain (auth + refresh + Signal identity)...
            await Promise.all([
                Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
                Keychain.resetGenericPassword({ service: IDENTITY_SERVICE })
            ]);
        } catch (error) {
            console.error('Clear auth keychain error:', error);
        }

        try {
            // ...then remove the remaining AsyncStorage items, including any
            // cached message threads (keys are prefixed with `messages_`).
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = ['current_user', 'registration_id', 'auth_token', 'refresh_token'];
            for (const key of keys) {
                if (key.startsWith('messages_')) {
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

    // Message Cache
    //
    // RESIDUAL RISK: this cache keeps the last 100 decrypted messages per chat
    // in AsyncStorage, which is NOT encrypted at rest. On a rooted/jailbroken
    // device or via a filesystem backup extraction, cached message bodies could
    // be recovered. The auth/refresh tokens and Signal identity key have been
    // moved to the Keychain, but message bodies remain here to preserve the
    // existing cache API (saveMessage/getMessages/updateMessage/markMessageDeleted)
    // used by the chat screens without adding a crypto dependency. The cache is
    // wiped on logout via clearAuth() and via clearMessages()/clearAll().
    // TODO: encrypt cached bodies at rest (e.g. an MMKV-encrypted or
    // SQLCipher-backed store) once a vetted dependency is available.
    async saveMessage(chatId, message) {
        try {
            const key = `messages_${chatId}`;
            const existing = await AsyncStorage.getItem(key);
            const messages = existing ? JSON.parse(existing) : [];

            messages.push(message);

            // Keep only last 100 messages per chat
            if (messages.length > 100) {
                messages.shift();
            }

            await AsyncStorage.setItem(key, JSON.stringify(messages));
        } catch (error) {
            console.error('Save message error:', error);
        }
    }

    async getMessages(chatId) {
        try {
            const key = `messages_${chatId}`;
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : [];
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

            const messages = JSON.parse(existing);
            const next = messages.map(msg => {
                const id = msg.id ?? msg._id;
                return id?.toString() === messageId?.toString() ? updater(msg) : msg;
            });

            await AsyncStorage.setItem(key, JSON.stringify(next));
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
                Keychain.resetGenericPassword({ service: IDENTITY_SERVICE })
            ]);
        } catch (error) {
            console.error('Clear all error:', error);
        }
    }
}

const storageService = new Storage();

export default storageService;
