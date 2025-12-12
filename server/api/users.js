const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/users
// @desc    Get all users (for contacts list)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.userId } })
            .select('username email online lastSeen identityKeyPublic registrationId')
            .limit(100);

        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('username email online lastSeen identityKeyPublic registrationId preKeys signedPreKey');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/users/:id/prekeys
// @desc    Get user's prekeys (for Signal Protocol key exchange)
// @access  Private
router.get('/:id/prekeys', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('identityKeyPublic registrationId preKeys signedPreKey');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get one prekey (remove it from DB after use)
        const preKey = user.preKeys.length > 0 ? user.preKeys.shift() : null;

        if (preKey) {
            await user.save();
        }

        res.json({
            identityKeyPublic: user.identityKeyPublic,
            registrationId: user.registrationId,
            preKey,
            signedPreKey: user.signedPreKey
        });
    } catch (error) {
        console.error('Get prekeys error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/users/prekeys
// @desc    Upload new prekeys
// @access  Private
router.post('/prekeys', auth, async (req, res) => {
    try {
        const { preKeys } = req.body;

        if (!preKeys || !Array.isArray(preKeys)) {
            return res.status(400).json({ error: 'Invalid prekeys format' });
        }

        const user = await User.findById(req.userId);

        // Add new prekeys
        user.preKeys = [...user.preKeys, ...preKeys];
        await user.save();

        res.json({ message: 'PreKeys uploaded successfully' });
    } catch (error) {
        console.error('Upload prekeys error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
