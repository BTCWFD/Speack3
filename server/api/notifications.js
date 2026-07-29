const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route   GET /api/notifications
// @desc    Avisos del usuario (pedido nuevo si es vendedor, cambios de estado
//          si es comprador). Quedan guardados para poder verlos aunque la app
//          estuviera cerrada cuando ocurrieron.
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const unreadOnly = req.query.unread === '1';
        const limit = Math.min(Number(req.query.limit) || 50, 100);

        res.json({
            notifications: await Notification.findForUser(req.userId, { unreadOnly, limit }),
            unread: await Notification.countUnread(req.userId)
        });
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/notifications/:id/read
// @access  Private
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const updated = await Notification.markRead(req.params.id, req.userId);
        if (!updated || updated.userId !== req.userId) {
            return res.status(404).json({ error: 'Notificacion no encontrada' });
        }
        res.json({ message: 'Marcada como leida', notification: updated });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/notifications/read-all
// @access  Private
router.post('/read-all', auth, async (req, res) => {
    try {
        await Notification.markAllRead(req.userId);
        res.json({ message: 'Todas marcadas como leidas', unread: 0 });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
