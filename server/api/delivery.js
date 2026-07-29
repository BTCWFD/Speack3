const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const ShopSettings = require('../models/ShopSettings');
const { quote, isInBogota, COP_PER_KM, MAX_DELIVERY_KM, BOGOTA_BOUNDS } = require('../services/deliveryService');

// @route   GET /api/delivery/config
// @desc    Tarifa, cobertura y desde donde se mide, para que la app pueda
//          mostrarlo sin adivinar (y centrar el mapa en la tienda).
// @access  Private
router.get('/config', auth, async (req, res) => {
    try {
        const origin = await ShopSettings.getLocation();
        res.json({
            copPerKm: COP_PER_KM,
            maxDeliveryKm: MAX_DELIVERY_KM,
            bounds: BOGOTA_BOUNDS,
            configured: Boolean(origin),
            origin: origin ? { lat: origin.lat, lng: origin.lng, address: origin.address } : null
        });
    } catch (error) {
        console.error('Delivery config error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/delivery/quote
// @desc    Cotizar el domicilio a un punto antes de pedir, para que el cliente
//          vea cuanto le cuesta llevarselo hasta ahi.
// @access  Private
router.post('/quote', [
    auth,
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const origin = await ShopSettings.getLocation();
        if (!origin) {
            return res.status(503).json({
                error: 'La tienda aun no tiene ubicacion configurada',
                reason: 'no_origin'
            });
        }

        const result = quote(origin, { lat: Number(req.body.lat), lng: Number(req.body.lng) });
        if (!result.ok) {
            return res.status(422).json({ error: result.error, reason: result.reason });
        }

        res.json({ quote: result });
    } catch (error) {
        console.error('Delivery quote error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/delivery/origin
// @desc    Fijar desde donde salen los domicilios
// @access  Private (shop admin only)
router.put('/origin', [
    auth,
    shopAdmin,
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const lat = Number(req.body.lat);
        const lng = Number(req.body.lng);

        // Una tienda fuera de Bogota haria que todos los cobros salieran mal,
        // asi que se avisa al configurarla y no cuando ya haya pedidos.
        if (!isInBogota({ lat, lng })) {
            return res.status(400).json({
                error: 'La ubicacion de la tienda debe estar en Bogota (el cobro por km se calcula desde ahi)'
            });
        }

        const settings = await ShopSettings.setLocation({ lat, lng, address: req.body.address });
        res.json({ message: 'Ubicacion de la tienda actualizada', location: settings.location });
    } catch (error) {
        console.error('Set delivery origin error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
