const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const seller = require('../middleware/seller');
const ShopSettings = require('../models/ShopSettings');
const User = require('../models/User');
const { isShopAdmin } = require('../middleware/shopAdmin');

// @route   GET /api/shop/status
// @desc    Si la tienda esta recibiendo pedidos. Lo consulta la app para
//          mostrar "cerrado" antes de dejar armar un carrito que se va a
//          rechazar al final.
// @access  Private
router.get('/status', auth, async (req, res) => {
    try {
        const open = await ShopSettings.isOpen();
        res.json({
            open,
            // Al vendedor le interesa ademas su propio estado.
            me: {
                isAdmin: isShopAdmin(req.user),
                isSeller: req.user.role === 'seller',
                available: req.user.sellerAvailable !== false
            }
        });
    } catch (error) {
        console.error('Shop status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/shop/open
// @desc    Abrir o cerrar la tienda entera
// @access  Private (shop admin only)
router.put('/open', [
    auth,
    shopAdmin,
    body('open').isBoolean().withMessage('open debe ser true o false')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const settings = await ShopSettings.setOpen(req.body.open, req.user._id);
        res.json({
            message: settings.open ? 'Tienda abierta' : 'Tienda cerrada',
            open: settings.open
        });
    } catch (error) {
        console.error('Set shop open error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/shop/availability
// @desc    Que un vendedor se ponga en linea o fuera de linea. No cierra la
//          tienda: solo deja de recibir avisos de pedidos nuevos mientras no
//          este disponible.
// @access  Private (vendedor o admin)
router.put('/availability', [
    auth,
    seller,
    body('available').isBoolean().withMessage('available debe ser true o false')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const updated = await User.findByIdAndUpdate(req.userId, {
            sellerAvailable: Boolean(req.body.available),
            sellerAvailableChangedAt: new Date()
        });

        res.json({
            message: updated.sellerAvailable ? 'Estas en linea' : 'Estas fuera de linea',
            available: updated.sellerAvailable !== false
        });
    } catch (error) {
        console.error('Set availability error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
