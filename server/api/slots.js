const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const DeliverySlot = require('../models/DeliverySlot');
const { availability } = require('../services/capacityService');

const slotRules = [
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be 0 (Sunday) to 6 (Saturday)'),
    body('startHour').isInt({ min: 0, max: 23 }).withMessage('startHour must be 0-23'),
    body('endHour').isInt({ min: 1, max: 24 }).withMessage('endHour must be 1-24'),
    body('maxOrders').isInt({ min: 1 }).withMessage('maxOrders must be at least 1')
];

// @route   GET /api/slots/availability
// @desc    Franjas libres de los proximos dias, para que el cliente elija una
//          hora que el vendedor pueda cumplir en vez de adivinar.
// @access  Private
// NOTA: va antes de /:id para que "availability" no se lea como un id.
router.get('/availability', auth, async (req, res) => {
    try {
        const days = Math.min(Number(req.query.days) || 14, 60);
        res.json({ availability: await availability(days) });
    } catch (error) {
        console.error('Availability error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/slots
// @desc    Franjas configuradas
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        res.json({ slots: await DeliverySlot.find({}) });
    } catch (error) {
        console.error('List slots error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/slots
// @desc    Crear una franja de entrega
// @access  Private (shop admin only)
router.post('/', [auth, shopAdmin, ...slotRules], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { dayOfWeek, startHour, endHour, maxOrders } = req.body;
        if (endHour <= startHour) {
            return res.status(400).json({ error: 'endHour must be after startHour' });
        }

        // Dos franjas solapadas el mismo dia harian ambiguo contra cual cupo
        // cuenta un pedido, asi que se rechaza al crearlas.
        const sameDay = await DeliverySlot.find({ dayOfWeek, active: true });
        const overlaps = sameDay.find((s) => startHour < s.endHour && endHour > s.startHour);
        if (overlaps) {
            return res.status(409).json({
                error: `Se solapa con la franja ${overlaps.startHour}:00-${overlaps.endHour}:00 de ese mismo dia`
            });
        }

        const slot = await DeliverySlot.create({ dayOfWeek, startHour, endHour, maxOrders });
        res.status(201).json({ message: 'Slot created', slot });
    } catch (error) {
        console.error('Create slot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/slots/:id
// @desc    Editar el cupo o desactivar una franja
// @access  Private (shop admin only)
router.patch('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const slot = await DeliverySlot.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
        }

        const update = {};
        if (req.body.maxOrders !== undefined) {
            if (!Number.isInteger(req.body.maxOrders) || req.body.maxOrders < 1) {
                return res.status(400).json({ error: 'maxOrders must be a positive integer' });
            }
            update.maxOrders = req.body.maxOrders;
        }
        if (req.body.active !== undefined) {
            update.active = Boolean(req.body.active);
        }

        res.json({ message: 'Slot updated', slot: await DeliverySlot.findByIdAndUpdate(req.params.id, update) });
    } catch (error) {
        console.error('Update slot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/slots/:id
// @access  Private (shop admin only)
router.delete('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const slot = await DeliverySlot.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
        }
        await DeliverySlot.deleteById(req.params.id);
        res.json({ message: 'Slot deleted' });
    } catch (error) {
        console.error('Delete slot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
