const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/users
// @desc    Get all users (for contacts list)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const rawUsers = await User.find({ _id: { $ne: req.userId } }, { limit: 100 });

        // Manually select fields to avoid leaking sensitive data
        const users = rawUsers.map(u => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            online: u.online,
            lastSeen: u.lastSeen,
            identityKeyPublic: u.identityKeyPublic,
            registrationId: u.registrationId
        }));

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
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Manually select fields to return
        const publicUser = {
            _id: user._id,
            username: user.username,
            email: user.email,
            online: user.online,
            lastSeen: user.lastSeen,
            identityKeyPublic: user.identityKeyPublic,
            registrationId: user.registrationId
        };

        res.json({ user: publicUser });
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
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const preKey = user.preKeys && user.preKeys.length > 0 ? user.preKeys[0] : null;

        if (preKey) {
            // Atomically remove the used pre-key from the database
            await User.findByIdAndUpdate(req.params.id, {
                $pull: { preKeys: { keyId: preKey.keyId } }
            });
        }

        res.json({
            identityKeyPublic: user.identityKeyPublic,
            registrationId: user.registrationId,
            preKey: preKey, // The single-use prekey
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

        if (!preKeys || !Array.isArray(preKeys) || preKeys.length === 0) {
            return res.status(400).json({ error: 'Invalid prekeys format' });
        }

        // Add new prekeys atomically
        await User.findByIdAndUpdate(req.userId, {
            $addToSet: { preKeys: { $each: preKeys } }
        });

        res.json({ message: 'PreKeys uploaded successfully' });
    } catch (error) {
        console.error('Upload prekeys error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
