const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');

// Store active socket connections
const activeUsers = new Map(); // userId -> socketId

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

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.username} (${socket.userId})`);

        // Store active connection
        activeUsers.set(socket.userId, socket.id);

        // Update user online status
        User.findByIdAndUpdate(socket.userId, {
            online: true,
            lastSeen: new Date()
        }).exec();

        // Emit user online to all contacts
        socket.broadcast.emit('user:online', {
            userId: socket.userId,
            username: socket.username
        });

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);

        // Handle direct message
        socket.on('message:direct', async (data) => {
            try {
                const { recipientId, encryptedContent } = data;

                // Save message to database
                const message = new Message({
                    sender: socket.userId,
                    recipient: recipientId,
                    encryptedContent,
                    messageType: 'direct',
                    delivered: false
                });

                await message.save();
                await message.populate('sender', 'username');

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
                    message.delivered = true;
                    message.deliveredAt = new Date();
                    await message.save();

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
                const { groupId, encryptedContent } = data;

                // Verify user is member
                const group = await Group.findById(groupId);

                if (!group || !group.members.some(m => m.toString() === socket.userId)) {
                    return socket.emit('message:error', {
                        error: 'Not a member of this group',
                        tempId: data.tempId
                    });
                }

                // Check posting permissions
                if (group.settings.onlyAdminCanPost && group.admin.toString() !== socket.userId) {
                    return socket.emit('message:error', {
                        error: 'Only admin can post in this group',
                        tempId: data.tempId
                    });
                }

                // Save message
                const message = new Message({
                    sender: socket.userId,
                    group: groupId,
                    encryptedContent,
                    messageType: 'group'
                });

                await message.save();
                await message.populate('sender', 'username');

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
            if (data.recipientId) {
                io.to(`user:${data.recipientId}`).emit('typing:start', {
                    userId: socket.userId,
                    username: socket.username
                });
            } else if (data.groupId) {
                socket.to(`group:${data.groupId}`).emit('typing:start', {
                    userId: socket.userId,
                    username: socket.username,
                    groupId: data.groupId
                });
            }
        });

        socket.on('typing:stop', (data) => {
            if (data.recipientId) {
                io.to(`user:${data.recipientId}`).emit('typing:stop', {
                    userId: socket.userId
                });
            } else if (data.groupId) {
                socket.to(`group:${data.groupId}`).emit('typing:stop', {
                    userId: socket.userId,
                    groupId: data.groupId
                });
            }
        });

        // Handle message read receipt
        socket.on('message:read', async (data) => {
            try {
                const { messageId } = data;
                const message = await Message.findById(messageId);

                if (message && message.recipient?.toString() === socket.userId) {
                    message.read = true;
                    message.readAt = new Date();
                    await message.save();

                    // Notify sender
                    io.to(`user:${message.sender.toString()}`).emit('message:read', {
                        messageId,
                        readAt: message.readAt
                    });
                }
            } catch (error) {
                console.error('Message read error:', error);
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
