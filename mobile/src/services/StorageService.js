import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

class Storage {
    // Auth Token Management
    async saveAuthToken(token) {
        try {
            await AsyncStorage.setItem('auth_token', token);
        } catch (error) {
            console.error('Save token error:', error);
        }
    }

    async getAuthToken() {
        try {
            return await AsyncStorage.getItem('auth_token');
        } catch (error) {
            console.error('Get token error:', error);
            return null;
        }
    }

    async saveRefreshToken(token) {
        try {
            await AsyncStorage.setItem('refresh_token', token);
        } catch (error) {
            console.error('Save refresh token error:', error);
        }
    }

    async getRefreshToken() {
        try {
            return await AsyncStorage.getItem('refresh_token');
        } catch (error) {
            console.error('Get refresh token error:', error);
            return null;
        }
    }

    async clearAuth() {
        try {
            await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'current_user']);
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
                service: 'speack3.identity'
            });
        } catch (error) {
            console.error('Save identity key error:', error);
        }
    }

    async getIdentityKeyPair() {
        try {
            const credentials = await Keychain.getGenericPassword({
                service: 'speack3.identity'
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
            await Keychain.resetGenericPassword({ service: 'speack3.identity' });
        } catch (error) {
            console.error('Clear all error:', error);
        }
    }
}

const storageService = new Storage();

export default storageService;
