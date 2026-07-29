const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const User = require('../models/User');
const { hasAcceptedCurrent } = require('../middleware/seller');
const { REQUIRED_VERSIONS } = require('../legal/documents');
const { SERVICE_TYPES, areValidServices } = require('../config/serviceTypes');

// Nunca devolver password ni material de claves al listar vendedores.
const publicView = (user) => ({
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role || 'buyer',
    sellerActive: user.sellerActive !== false,
    services: user.services || [],
    legalAccepted: user.legalAccepted || {},
    legalUpToDate: hasAcceptedCurrent(user),
    sellerSince: user.sellerSince || null
});

// @route   GET /api/sellers/services
// @desc    Servicios que se le pueden asignar a un vendedor, para que la app
//          los muestre como opciones en vez de tenerlos escritos a mano.
// @access  Private (shop admin only)
// NOTA: va antes de /:id para que "services" no se lea como un id.
router.get('/services', [auth, shopAdmin], (req, res) => {
    res.json({ services: SERVICE_TYPES });
});

// @route   GET /api/sellers
// @desc    Vendedores habilitados y si estan al dia con los documentos
// @access  Private (shop admin only)
router.get('/', [auth, shopAdmin], async (req, res) => {
    try {
        const sellers = await User.find({ role: 'seller' });
        res.json({
            sellers: sellers.map(publicView),
            requiredVersions: REQUIRED_VERSIONS
        });
    } catch (error) {
        console.error('List sellers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/sellers
// @desc    Habilitar a un usuario YA REGISTRADO como vendedor.
//          No crea cuentas: la persona se registra por su cuenta y el admin la
//          habilita, para no manejar contrasenas de terceros.
// @access  Private (shop admin only)
router.post('/', [
    auth,
    shopAdmin,
    body('email').isEmail().withMessage('Se requiere el correo del usuario a habilitar')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const email = req.body.email.toLowerCase();
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                error: 'No hay ningun usuario con ese correo. Debe registrarse en la app primero.',
                reason: 'user_not_found'
            });
        }

        if (user.role === 'seller' && user.sellerActive !== false) {
            return res.status(409).json({ error: 'Ese usuario ya es vendedor' });
        }

        // Hay que decir QUE puede ofrecer: habilitar a alguien "para todo" por
        // omision seria darle mas de lo que el admin probablemente quiere.
        if (!areValidServices(req.body.services)) {
            return res.status(400).json({
                error: 'Indica al menos un servicio valido para este vendedor',
                validServices: SERVICE_TYPES
            });
        }

        const updated = await User.findByIdAndUpdate(user._id, {
            role: 'seller',
            sellerActive: true,
            services: req.body.services,
            sellerSince: user.sellerSince || new Date(),
            sellerEnabledBy: req.user._id
        });

        res.status(201).json({
            message: 'Vendedor habilitado',
            seller: publicView(updated),
            // El vendedor no puede operar hasta aceptar los documentos: se avisa
            // aqui para que el admin no crea que ya quedo listo.
            pendingLegalAcceptance: !hasAcceptedCurrent(updated),
            requiredVersions: REQUIRED_VERSIONS
        });
    } catch (error) {
        console.error('Add seller error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/sellers/:id
// @desc    Suspender o reactivar un vendedor
// @access  Private (shop admin only)
router.patch('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'seller') {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        const update = {};

        if (req.body.active !== undefined) {
            update.sellerActive = Boolean(req.body.active);
        }

        if (req.body.services !== undefined) {
            if (!areValidServices(req.body.services)) {
                return res.status(400).json({
                    error: 'Lista de servicios invalida',
                    validServices: SERVICE_TYPES
                });
            }
            update.services = req.body.services;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: 'Se requiere "active" y/o "services"' });
        }

        const updated = await User.findByIdAndUpdate(user._id, update);

        res.json({
            message: 'Vendedor actualizado',
            seller: publicView(updated)
        });
    } catch (error) {
        console.error('Update seller error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/sellers/:id
// @desc    Quitar el rol de vendedor (la cuenta sigue existiendo como comprador)
// @access  Private (shop admin only)
router.delete('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'seller') {
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        await User.findByIdAndUpdate(user._id, { role: 'buyer', sellerActive: false });
        res.json({ message: 'Rol de vendedor retirado' });
    } catch (error) {
        console.error('Remove seller error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
