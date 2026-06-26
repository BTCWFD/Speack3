const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');

// Store active socket connections
const activeUsers = new Map(); // userId -> socketId

// Maximum accepted length for an encrypted message payload.
const MAX_CONTENT_LENGTH = 100000;

// Small validation helpers for socket inputs.
const isNonEmptyString = (x) => typeof x === 'string' && x.trim().length > 0;
const isValidContent = (x) =>
    typeof x === 'string' && x.length > 0 && x.length <= MAX_CONTENT_LENGTH;

const setupSocketHandlers = (io) => {
    // Socket.io middleware for authentication
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return next(new Error('User not found'));
            }

            socket.userId = decoded.userId;
            socket.username = user.username;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`User connected: ${socket.username} (${socket.userId})`);

        // Store active connection
        activeUsers.set(socket.userId, socket.id);

        // Update user online status
        await User.findByIdAndUpdate(socket.userId, {
            online: true,
            lastSeen: new Date()
        });

        // Emit user online to all contacts
        socket.broadcast.emit('user:online', {
            userId: socket.userId,
            username: socket.username
        });

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);

        // Flush undelivered DIRECT messages on (re)connect.
        // While the recipient was offline, message:direct stored messages with
        // delivered:false and never retried, so they were silently stuck. Now
        // that this user is back online we replay them in chronological order,
        // using the SAME payload shape as the live message:direct emit, and mark
        // each delivered once re-emitted. Scope is DIRECT messages only: group
        // messages have no `recipient` field and are out of scope here.
        try {
            const pending = await Message.findUndelivered(socket.userId);
            // Cache sender id -> username to avoid repeated lookups when a
            // single sender left several queued messages.
            const usernameCache = new Map();

            for (const message of pending) {
                try {
                    const senderId = message.sender;
                    let senderUsername = usernameCache.get(senderId);

                    if (senderUsername === undefined) {
                        const senderUser = await User.findById(senderId);
                        senderUsername = senderUser ? senderUser.username : null;
                        usernameCache.set(senderId, senderUsername);
                    }

                    io.to(`user:${socket.userId}`).emit('message:receive', {
                        id: message._id,
                        sender: {
                            id: senderId,
                            username: senderUsername
                        },
                        encryptedContent: message.encryptedContent,
                        timestamp: message.createdAt,
                        messageType: 'direct'
                    });

                    // Mark delivered after the emit. The client dedupes by `id`,
                    // so flipping this flag is enough to never resend it.
                    await Message.findByIdAndUpdate(message._id, {
                        delivered: true,
                        deliveredAt: new Date()
                    });
                } catch (msgError) {
                    // Skip this message but keep flushing the rest.
                    console.error('Undelivered flush (single message) error:', msgError);
                }
            }
        } catch (flushError) {
            // Never let the flush tear down the connection.
            console.error('Undelivered flush error:', flushError);
        }

        // Handle direct message
        socket.on('message:direct', async (data) => {
            try {
                const { recipientId, encryptedContent } = data || {};

                // Validate input
                if (!isNonEmptyString(recipientId) || !isValidContent(encryptedContent)) {
                    return socket.emit('message:error', {
                        error: 'Invalid message payload',
                        tempId: data?.tempId
                    });
                }

                // Save message to database
                const message = await Message.create({
                    sender: socket.userId,
                    recipient: recipientId,
                    encryptedContent,
                    messageType: 'direct',
                    delivered: false
                });

                // Check if recipient is online
                const recipientSocketId = activeUsers.get(recipientId);

                if (recipientSocketId) {
                    // Send to recipient
                    io.to(`user:${recipientId}`).emit('message:receive', {
                        id: message._id,
                        sender: {
                            id: socket.userId,
                            username: socket.username
                        },
                        encryptedContent,
                        timestamp: message.createdAt,
                        messageType: 'direct'
                    });

                    // Update delivery status
                    await Message.findByIdAndUpdate(message._id, { 
                        delivered: true, 
                        deliveredAt: new Date() 
                    });

                    // Send delivery confirmation to sender
                    socket.emit('message:delivered', {
                        messageId: message._id,
                        delivered: true
                    });
                }

                // Send confirmation to sender
                socket.emit('message:sent', {
                    messageId: message._id,
                    tempId: data.tempId, // Client's temporary ID
                    timestamp: message.createdAt
                });

            } catch (error) {
                console.error('Direct message error:', error);
                socket.emit('message:error', {
                    error: 'Failed to send message',
                    tempId: data.tempId
                });
            }
        });

        // Handle group message
        socket.on('message:group', async (data) => {
            try {
                const { groupId, encryptedContent } = data || {};

                // Validate input
                if (!isNonEmptyString(groupId) || !isValidContent(encryptedContent)) {
                    return socket.emit('message:error', {
                        error: 'Invalid message payload',
                        tempId: data?.tempId
                    });
                }

                // Verify user is member
                const group = await Group.findById(groupId);

                if (!group || !group.members.some(m => m.toString() === socket.userId)) {
                    return socket.emit('message:error', {
                        error: 'Not a member of this group',
                        tempId: data.tempId
                    });
                }

                // Check posting permissions
                if (group.settings?.onlyAdminCanPost && group.admin.toString() !== socket.userId) {
                    return socket.emit('message:error', {
                        error: 'Only admin can post in this group',
                        tempId: data.tempId
                    });
                }

                // Save message
                const message = await Message.create({
                    sender: socket.userId,
                    group: groupId,
                    encryptedContent,
                    messageType: 'group'
                });

                // Send to all group members
                group.members.forEach(memberId => {
                    io.to(`user:${memberId.toString()}`).emit('message:receive', {
                        id: message._id,
                        sender: {
                            id: socket.userId,
                            username: socket.username
                        },
                        groupId,
                        encryptedContent,
                        timestamp: message.createdAt,
                        messageType: 'group'
                    });
                });

                // Send confirmation to sender
                socket.emit('message:sent', {
                    messageId: message._id,
                    tempId: data.tempId,
                    timestamp: message.createdAt
                });

            } catch (error) {
                console.error('Group message error:', error);
                socket.emit('message:error', {
                    error: 'Failed to send group message',
                    tempId: data.tempId
                });
            }
        });

        // Handle typing indicator
        socket.on('typing:start', (data) => {
            if (!data) return;
            if (isNonEmptyString(data.recipientId)) {
                io.to(`user:${data.recipientId}`).emit('typing:start', {
                    userId: socket.userId,
                    username: socket.username
                });
            } else if (isNonEmptyString(data.groupId)) {
                socket.to(`group:${data.groupId}`).emit('typing:start', {
                    userId: socket.userId,
                    username: socket.username,
                    groupId: data.groupId
                });
            }
        });

        socket.on('typing:stop', (data) => {
            if (!data) return;
            if (isNonEmptyString(data.recipientId)) {
                io.to(`user:${data.recipientId}`).emit('typing:stop', {
                    userId: socket.userId
                });
            } else if (isNonEmptyString(data.groupId)) {
                socket.to(`group:${data.groupId}`).emit('typing:stop', {
                    userId: socket.userId,
                    groupId: data.groupId
                });
            }
        });

        // Handle message read receipt
        socket.on('message:read', async (data) => {
            try {
                const { messageId } = data || {};

                // Validate input
                if (!isNonEmptyString(messageId)) {
                    return;
                }

                const message = await Message.findById(messageId);

                if (message && message.recipient?.toString() === socket.userId) {
                    const updatedMessage = await Message.findByIdAndUpdate(messageId, {
                        read: true,
                        readAt: new Date()
                    });

                    // Notify sender
                    io.to(`user:${message.sender.toString()}`).emit('message:read', {
                        messageId,
                        readAt: updatedMessage.readAt
                    });
                }
            } catch (error) {
                console.error('Message read error:', error);
            }
        });

        // Handle message edit (soft-edit)
        socket.on('message:edit', async (data) => {
            try {
                const { messageId, encryptedContent } = data || {};

                // Validate input
                if (!isNonEmptyString(messageId) || !isValidContent(encryptedContent)) {
                    return socket.emit('message:error', {
                        error: 'Invalid message payload',
                        tempId: data?.tempId
                    });
                }

                const message = await Message.findById(messageId);

                if (!message) {
                    return socket.emit('message:error', {
                        error: 'Message not found',
                        tempId: data.tempId
                    });
                }

                // Only the original sender may edit
                if (message.sender.toString() !== socket.userId) {
                    return socket.emit('message:error', {
                        error: 'Unauthorized',
                        tempId: data.tempId
                    });
                }

                const updatedMessage = await Message.findByIdAndUpdate(messageId, {
                    encryptedContent,
                    edited: true,
                    editedAt: new Date()
                });

                // Include sender (so clients can decrypt direct edits like an
                // incoming message) and groupId (so group screens can scope it).
                const payload = {
                    messageId,
                    encryptedContent,
                    editedAt: updatedMessage.editedAt,
                    sender: { id: socket.userId, username: socket.username },
                    messageType: message.messageType
                };

                if (message.messageType === 'group') {
                    const group = await Group.findById(message.group);
                    payload.groupId = message.group.toString();
                    if (group) {
                        group.members.forEach(memberId => {
                            io.to(`user:${memberId.toString()}`).emit('message:edited', payload);
                        });
                    }
                } else {
                    // Direct: notify recipient and the sender socket
                    io.to(`user:${message.recipient.toString()}`).emit('message:edited', payload);
                    socket.emit('message:edited', payload);
                }
            } catch (error) {
                console.error('Message edit error:', error);
                socket.emit('message:error', {
                    error: 'Failed to edit message',
                    tempId: data.tempId
                });
            }
        });

        // Handle message delete (soft-delete)
        socket.on('message:delete', async (data) => {
            try {
                const { messageId } = data || {};

                // Validate input
                if (!isNonEmptyString(messageId)) {
                    return socket.emit('message:error', {
                        error: 'Invalid message payload',
                        tempId: data?.tempId
                    });
                }

                const message = await Message.findById(messageId);

                if (!message) {
                    return socket.emit('message:error', {
                        error: 'Message not found',
                        tempId: data.tempId
                    });
                }

                // Only the original sender may delete
                if (message.sender.toString() !== socket.userId) {
                    return socket.emit('message:error', {
                        error: 'Unauthorized',
                        tempId: data.tempId
                    });
                }

                // Soft-delete: keep the record, clear the content
                await Message.findByIdAndUpdate(messageId, {
                    deleted: true,
                    encryptedContent: ''
                });

                const payload = {
                    messageId,
                    sender: { id: socket.userId, username: socket.username },
                    messageType: message.messageType
                };

                if (message.messageType === 'group') {
                    const group = await Group.findById(message.group);
                    payload.groupId = message.group.toString();
                    if (group) {
                        group.members.forEach(memberId => {
                            io.to(`user:${memberId.toString()}`).emit('message:deleted', payload);
                        });
                    }
                } else {
                    // Direct: notify recipient and the sender socket
                    io.to(`user:${message.recipient.toString()}`).emit('message:deleted', payload);
                    socket.emit('message:deleted', payload);
                }
            } catch (error) {
                console.error('Message delete error:', error);
                socket.emit('message:error', {
                    error: 'Failed to delete message',
                    tempId: data.tempId
                });
            }
        });

        // Handle disconnect
        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.username} (${socket.userId})`);

            // Remove from active users
            activeUsers.delete(socket.userId);

            // Update user offline status
            await User.findByIdAndUpdate(socket.userId, {
                online: false,
                lastSeen: new Date()
            });

            // Emit user offline
            socket.broadcast.emit('user:offline', {
                userId: socket.userId,
                lastSeen: new Date()
            });
        });
    });
};

module.exports = setupSocketHandlers;
