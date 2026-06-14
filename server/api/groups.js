const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Group = require('../models/Group');

// @route   POST /api/groups
// @desc    Create new group
// @access  Private
router.post('/', [
    auth,
    body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Group name required (1-50 chars)'),
    body('members').isArray({ min: 1 }).withMessage('At least one member required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, members } = req.body;

        // Create group
        const groupData = {
            name,
            description,
            admin: req.userId,
            members: [...new Set([req.userId, ...members])] // Remove duplicates
        };

        const newGroup = await Group.create(groupData);

        res.status(201).json({
            message: 'Group created successfully',
            group: newGroup
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/groups
// @desc    Get user's groups
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const groups = await Group.find({
            members: req.userId
        });

        res.json({ groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/groups/:id
// @desc    Get group by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is member
        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        res.json({ group });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/groups/:id/members
// @desc    Add members to group
// @access  Private
router.put('/:id/members', [
    auth,
    body('members').isArray({ min: 1 }).withMessage('Members array required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is admin or allowed to add members
        const isAdmin = group.admin.toString() === req.userId;
        const canAddMembers = group.settings?.memberCanAddOthers;

        if (!isAdmin && !canAddMembers) {
            return res.status(403).json({ error: 'Only admin can add members' });
        }

        const { members } = req.body;

        // Add new members
        const updatedGroup = await Group.findByIdAndUpdate(req.params.id, {
            $addToSet: { members: { $each: members } }
        });

        res.json({
            message: 'Members added successfully',
            group: updatedGroup
        });
    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/groups/:id/members/:memberId
// @desc    Remove member from group
// @access  Private
router.delete('/:id/members/:memberId', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Only admin can remove members
        if (group.admin.toString() !== req.userId) {
            return res.status(403).json({ error: 'Only admin can remove members' });
        }

        // Cannot remove admin
        if (req.params.memberId === req.userId) {
            return res.status(400).json({ error: 'Admin cannot leave group' });
        }

        // Remove member
        await Group.findByIdAndUpdate(req.params.id, {
            $pull: { members: req.params.memberId }
        });

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Only admin can delete
        if (group.admin.toString() !== req.userId) {
            return res.status(403).json({ error: 'Only admin can delete group' });
        }

        await Group.deleteOne({ _id: req.params.id });

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
