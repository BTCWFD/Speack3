const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Group = require('../models/Group');

// @route   GET /api/messages/direct/:userId
// @desc    Get direct messages with a user
// @access  Private
router.get('/direct/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const skip = parseInt(req.query.skip) || 0;

        const messages = await Message.find({
            messageType: 'direct',
            $or: [
                { sender: req.userId, recipient: userId },
                { sender: userId, recipient: req.userId }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate('sender', 'username')
            .populate('recipient', 'username');

        res.json({ messages: messages.reverse() }); // Oldest first
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/messages/group/:groupId
// @desc    Get group messages
// @access  Private
router.get('/group/:groupId', auth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const skip = parseInt(req.query.skip) || 0;

        // Verify user is member
        const group = await Group.findById(groupId);
        if (!group || !group.members.includes(req.userId)) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        const messages = await Message.find({
            messageType: 'group',
            group: groupId
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate('sender', 'username');

        res.json({ messages: messages.reverse() });
    } catch (error) {
        console.error('Get group messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only recipient can mark as read
        if (message.recipient?.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        message.read = true;
        message.readAt = new Date();
        await message.save();

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
