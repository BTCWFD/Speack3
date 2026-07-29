const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const seller = require('../middleware/seller');
const User = require('../models/User');
const Order = require('../models/Order');
const { resolveAdminUser } = require('../middleware/shopAdmin');

// Un numero de Nequi es un numero de celular, y una llave Bre-B suele ser el
// celular, la cedula o el correo: son datos personales. NO se publican en el
// catalogo ni se listan a cualquiera; solo los ve quien tiene un pedido en
// curso con ese vendedor y necesita a donde transferir.
const NEQUI_RE = /^3\d{9}$/;              // celular colombiano: 10 digitos, empieza en 3
const BREB_RE = /^[A-Za-z0-9@._+-]{3,60}$/;

const ownView = (user) => ({
    nequi: user.payout?.nequi || null,
    breb: user.payout?.breb || null,
    updatedAt: user.payout?.updatedAt || null
});

// @route   GET /api/payout-methods/mine
// @desc    Los datos de cobro propios, para mostrarlos en la seccion del vendedor
// @access  Private (vendedor o admin)
router.get('/mine', [auth, seller], async (req, res) => {
    try {
        res.json({ payout: ownView(req.user) });
    } catch (error) {
        console.error('Get payout methods error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/payout-methods/mine
// @desc    Registrar o actualizar donde recibe el dinero este vendedor.
//          Enviar null en un campo lo borra.
// @access  Private (vendedor o admin)
router.put('/mine', [
    auth,
    seller,
    body('nequi').optional({ nullable: true }).custom((v) =>
        v === null || NEQUI_RE.test(String(v))
    ).withMessage('El numero de Nequi debe ser un celular colombiano de 10 digitos que empiece por 3'),
    body('breb').optional({ nullable: true }).custom((v) =>
        v === null || BREB_RE.test(String(v))
    ).withMessage('Llave Bre-B invalida')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (req.body.nequi === undefined && req.body.breb === undefined) {
            return res.status(400).json({ error: 'Envia al menos "nequi" o "breb"' });
        }

        const payout = { ...(req.user.payout || {}) };
        if (req.body.nequi !== undefined) {
            payout.nequi = req.body.nequi === null ? null : String(req.body.nequi);
        }
        if (req.body.breb !== undefined) {
            payout.breb = req.body.breb === null ? null : String(req.body.breb);
        }
        payout.updatedAt = new Date();

        const updated = await User.findByIdAndUpdate(req.userId, { payout });
        res.json({ message: 'Datos de cobro actualizados', payout: ownView(updated) });
    } catch (error) {
        console.error('Update payout methods error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/payout-methods/for-order/:orderId
// @desc    A donde debe pagar el comprador de ESE pedido. Solo el dueno del
//          pedido puede consultarlo, y solo mientras el pedido no este
//          cancelado: es la unica razon legitima para ver el numero personal
//          de otra persona.
// @access  Private (dueno del pedido)
router.get('/for-order/:orderId', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        if (order.buyerId !== req.userId) {
            return res.status(403).json({ error: 'Not your order' });
        }
        if (order.status === 'cancelled') {
            return res.status(409).json({ error: 'Ese pedido esta cancelado' });
        }
        if (order.paymentStatus === 'paid') {
            return res.status(409).json({ error: 'Ese pedido ya esta pagado' });
        }

        // Tienda de un solo vendedor: se paga al admin salvo que el pedido
        // tenga asignado un vendedor concreto.
        const payee = order.sellerId
            ? await User.findById(order.sellerId)
            : await resolveAdminUser();

        if (!payee?.payout || (!payee.payout.nequi && !payee.payout.breb)) {
            return res.status(503).json({
                error: 'El vendedor aun no ha registrado sus datos de cobro',
                reason: 'no_payout_configured'
            });
        }

        res.json({
            payTo: {
                username: payee.username,
                nequi: payee.payout.nequi || null,
                breb: payee.payout.breb || null
            },
            amountCOP: order.totalCOP
        });
    } catch (error) {
        console.error('Get payout for order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
