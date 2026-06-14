import { io } from 'socket.io-client';
import { WS_URL } from '../config/api';
import StorageService from './StorageService';
import SignalService from './SignalService';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.messageHandlers = new Set();
        this.statusHandlers = new Set();
        this.editedHandlers = new Set();
        this.deletedHandlers = new Set();
    }

    // Connect to WebSocket server
    async connect() {
        try {
            const token = await StorageService.getAuthToken();

            if (!token) {
                throw new Error('No auth token found');
            }

            this.socket = io(WS_URL, {
                auth: { token },
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });

            this.setupListeners();

            return new Promise((resolve, reject) => {
                this.socket.on('connect', () => {
                    console.log('✅ Socket connected');
                    this.connected = true;
                    resolve(true);
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Socket connect error:', error);
            throw error;
        }
    }

    // Setup event listeners
    setupListeners() {
        // Connection events
        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            this.connected = false;
            this.notifyStatusChange('disconnected');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
            this.connected = true;
            this.notifyStatusChange('connected');
        });

        // Message events
        this.socket.on('message:receive', async (data) => {
            try {
                // Decrypt message
                const decrypted = await SignalService.decryptMessage(
                    data.sender.id,
                    JSON.parse(data.encryptedContent)
                );

                const message = {
                    id: data.id,
                    sender: data.sender,
                    content: decrypted,
                    timestamp: data.timestamp,
                    messageType: data.messageType,
                    groupId: data.groupId
                };

                // Cache message locally
                const chatId = data.messageType === 'group'
                    ? data.groupId
                    : data.sender.id;

                await StorageService.saveMessage(chatId, message);

                // Notify listeners
                this.notifyMessageReceived(message);

                console.log('📩 Message received and decrypted');
            } catch (error) {
                console.error('Error processing received message:', error);
            }
        });

        this.socket.on('message:sent', (data) => {
            this.notifyEvent('message:sent', data);
        });

        this.socket.on('message:delivered', (data) => {
            this.notifyEvent('message:delivered', data);
        });

        this.socket.on('message:read', (data) => {
            this.notifyEvent('message:read', data);
        });

        this.socket.on('message:error', (data) => {
            console.error('Message error:', data);
            this.notifyEvent('message:error', data);
        });

        // Edit / delete events
        this.socket.on('message:edited', async (data) => {
            try {
                let content = null;

                // For direct messages the server forwards the same Signal-encrypted
                // payload used for incoming messages. Decrypt it the same way so
                // screens receive plaintext. Group edits are forwarded as the
                // simplified plaintext JSON ({ message }) used by sendGroupMessage.
                if (data.sender?.id && data.encryptedContent) {
                    try {
                        content = await SignalService.decryptMessage(
                            data.sender.id,
                            JSON.parse(data.encryptedContent)
                        );
                    } catch (err) {
                        // Fallback: group / plaintext payload
                        try {
                            const parsed = JSON.parse(data.encryptedContent);
                            content = parsed.message ?? null;
                        } catch {
                            content = null;
                        }
                    }
                } else if (data.encryptedContent) {
                    try {
                        const parsed = JSON.parse(data.encryptedContent);
                        content = parsed.message ?? null;
                    } catch {
                        content = null;
                    }
                }

                const payload = {
                    messageId: data.messageId,
                    content,
                    editedAt: data.editedAt,
                    groupId: data.groupId
                };

                this.notifyMessageEdited(payload);
                console.log('✏️ Message edited');
            } catch (error) {
                console.error('Error processing edited message:', error);
            }
        });

        this.socket.on('message:deleted', (data) => {
            this.notifyMessageDeleted({
                messageId: data.messageId,
                groupId: data.groupId
            });
            console.log('🗑️ Message deleted');
        });

        // User status events
        this.socket.on('user:online', (data) => {
            this.notifyEvent('user:online', data);
        });

        this.socket.on('user:offline', (data) => {
            this.notifyEvent('user:offline', data);
        });

        // Typing indicators
        this.socket.on('typing:start', (data) => {
            this.notifyEvent('typing:start', data);
        });

        this.socket.on('typing:stop', (data) => {
            this.notifyEvent('typing:stop', data);
        });
    }

    // Send direct message
    async sendDirectMessage(recipientId, message, tempId) {
        try {
            if (!this.connected) {
                throw new Error('Socket not connected');
            }

            // Encrypt message
            const encrypted = await SignalService.encryptMessage(recipientId, message);

            // Send via socket
            this.socket.emit('message:direct', {
                recipientId,
                encryptedContent: JSON.stringify(encrypted),
                tempId
            });

            console.log('📤 Direct message sent');
        } catch (error) {
            console.error('Send direct message error:', error);
            throw error;
        }
    }

    // Send group message
    async sendGroupMessage(groupId, message, tempId) {
        try {
            if (!this.connected) {
                throw new Error('Socket not connected');
            }

            // For groups, encrypt with group key (simplified - using sender's key here)
            // In production, implement proper group encryption (sender keys)
            const encrypted = JSON.stringify({ message }); // Simplified

            this.socket.emit('message:group', {
                groupId,
                encryptedContent: encrypted,
                tempId
            });

            console.log('📤 Group message sent');
        } catch (error) {
            console.error('Send group message error:', error);
            throw error;
        }
    }

    // Edit a previously sent message
    async editMessage(recipientOrGroupId, messageId, newText, isGroup = false) {
        try {
            if (!this.connected) {
                throw new Error('Socket not connected');
            }

            let encryptedContent;

            if (isGroup) {
                // Same simplified approach as sendGroupMessage
                encryptedContent = JSON.stringify({ message: newText });
            } else {
                // Encrypt the same way as sendDirectMessage
                const encrypted = await SignalService.encryptMessage(recipientOrGroupId, newText);
                encryptedContent = JSON.stringify(encrypted);
            }

            this.socket.emit('message:edit', {
                messageId,
                encryptedContent,
                tempId: messageId
            });

            console.log('✏️ Message edit sent');
        } catch (error) {
            console.error('Edit message error:', error);
            throw error;
        }
    }

    // Delete a previously sent message
    deleteMessage(messageId) {
        if (!this.connected) {
            throw new Error('Socket not connected');
        }

        this.socket.emit('message:delete', { messageId });
        console.log('🗑️ Message delete sent');
    }

    // Typing indicators
    sendTypingStart(recipientId = null, groupId = null) {
        if (this.connected) {
            this.socket.emit('typing:start', { recipientId, groupId });
        }
    }

    sendTypingStop(recipientId = null, groupId = null) {
        if (this.connected) {
            this.socket.emit('typing:stop', { recipientId, groupId });
        }
    }

    // Mark message as read
    markAsRead(messageId) {
        if (this.connected) {
            this.socket.emit('message:read', { messageId });
        }
    }

    // Event subscription
    onMessage(handler) {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onEvent(eventName, handler) {
        this.socket?.on(eventName, handler);
        return () => this.socket?.off(eventName, handler);
    }

    // Edit / delete subscriptions (delivered with decrypted/plaintext content)
    onMessageEdited(handler) {
        this.editedHandlers.add(handler);
        return () => this.editedHandlers.delete(handler);
    }

    onMessageDeleted(handler) {
        this.deletedHandlers.add(handler);
        return () => this.deletedHandlers.delete(handler);
    }

    // Notify message handlers
    notifyMessageReceived(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                console.error('Message handler error:', error);
            }
        });
    }

    notifyEvent(eventName, data) {
        // This will be handled by component-specific listeners
    }

    notifyMessageEdited(payload) {
        this.editedHandlers.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.error('Edited handler error:', error);
            }
        });
    }

    notifyMessageDeleted(payload) {
        this.deletedHandlers.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.error('Deleted handler error:', error);
            }
        });
    }

    notifyStatusChange(status) {
        this.statusHandlers.forEach(handler => {
            try {
                handler(status);
            } catch (error) {
                console.error('Status handler error:', error);
            }
        });
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            console.log('👋 Socket disconnected');
        }
    }

    // Check connection status
    isConnected() {
        return this.connected && this.socket?.connected;
    }
}

const socketService = new SocketService();

export default socketService;
