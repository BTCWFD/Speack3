const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
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

        const query = {
            messageType: 'direct',
            $or: [
                { sender: req.userId, recipient: userId },
                { sender: userId, recipient: req.userId }
            ]
        };
        const options = {
            sort: { createdAt: -1 },
            limit,
            skip
        };

        const messages = await Message.find(query, options);

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

        const query = {
            messageType: 'group',
            group: groupId
        };
        const options = {
            sort: { createdAt: -1 },
            limit,
            skip
        };

        const messages = await Message.find(query, options);

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

        await Message.findByIdAndUpdate(req.params.id, {
            read: true,
            readAt: new Date()
        });

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/messages/:id
// @desc    Edit a message (soft-edit, sender only)
// @access  Private
router.put('/:id', [
    auth,
    body('encryptedContent').isString().notEmpty().withMessage('Encrypted content required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only the original sender can edit
        if (message.sender?.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updatedMessage = await Message.findByIdAndUpdate(req.params.id, {
            encryptedContent: req.body.encryptedContent,
            edited: true,
            editedAt: new Date()
        });

        res.json({ message: updatedMessage });
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message (soft-delete, sender only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only the original sender can delete
        if (message.sender?.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Soft-delete: keep the record, clear the content
        await Message.findByIdAndUpdate(req.params.id, {
            deleted: true,
            encryptedContent: ''
        });

        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
