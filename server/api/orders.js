const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const web3PaymentService = require('../services/web3PaymentService');
const { checkCapacity } = require('../services/capacityService');
const { priceLine } = require('../services/pricingService');
const { quote: quoteDelivery } = require('../services/deliveryService');
const ShopSettings = require('../models/ShopSettings');
const { notifyNewOrder, notifyStatusChange } = require('../services/notificationService');

const VALID_STATUSES = ['waitlist', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const VALID_METHODS = ['nequi', 'crypto', 'breb'];

// @route   POST /api/orders
// @desc    Request an order (client picks products + a delivery time; starts
//          on the waitlist until the seller confirms it can be fulfilled)
// @access  Private
router.post('/', [
    auth,
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.productId').isString().notEmpty(),
    body('items.*.qty').isInt({ min: 1 }).withMessage('qty must be a positive integer'),
    body('requestedDeliveryTime').isISO8601().withMessage('requestedDeliveryTime must be an ISO date')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const requestedDeliveryTime = new Date(req.body.requestedDeliveryTime);
        if (requestedDeliveryTime <= new Date()) {
            return res.status(400).json({ error: 'requestedDeliveryTime must be in the future' });
        }

        // El cupo se valida antes de armar el pedido: si la franja esta llena
        // o cerrada no tiene sentido seguir calculando precios.
        const capacity = await checkCapacity(requestedDeliveryTime);
        if (!capacity.ok) {
            return res.status(409).json({ error: capacity.error, reason: capacity.reason });
        }

        // Prices always come from the catalog, never trusted from the client.
        const items = [];
        let totalCOP = 0;
        let totalSavedCOP = 0;
        for (const { productId, qty } of req.body.items) {
            const product = await Product.findById(productId);
            if (!product || !product.active) {
                return res.status(400).json({ error: `Product ${productId} not available` });
            }
            const { subtotalCOP, bundlesApplied, savedCOP } = priceLine(product, qty);
            items.push({
                productId: product._id,
                name: product.name,
                emoji: product.emoji,
                unitPriceCOP: product.priceCOP,
                qty,
                subtotalCOP,
                bundlesApplied,
                savedCOP
            });
            totalCOP += subtotalCOP;
            totalSavedCOP += savedCOP;
        }

        // Domicilio opcional: si el cliente manda un destino se cotiza aqui y
        // se suma al total. La tarifa NUNCA se acepta del cliente, igual que
        // los precios: se recalcula contra la ubicacion de la tienda.
        let delivery = null;
        if (req.body.destination) {
            const origin = await ShopSettings.getLocation();
            if (!origin) {
                return res.status(503).json({
                    error: 'La tienda aun no tiene ubicacion configurada para domicilios',
                    reason: 'no_origin'
                });
            }

            const { lat, lng, address } = req.body.destination;
            const quoted = quoteDelivery(origin, { lat: Number(lat), lng: Number(lng) });
            if (!quoted.ok) {
                return res.status(422).json({ error: quoted.error, reason: quoted.reason });
            }

            delivery = {
                lat: Number(lat),
                lng: Number(lng),
                address: address || '',
                km: quoted.km,
                feeCOP: quoted.feeCOP
            };
            totalCOP += quoted.feeCOP;
        }

        const order = await Order.create({
            buyerId: req.userId,
            items,
            totalCOP,
            totalSavedCOP,
            delivery,
            requestedDeliveryTime,
            notes: req.body.notes || '',
            // Linea de tiempo visible para el comprador: cada cambio se anexa
            // aqui, en vez de solo pisar el campo `status` y perder el historial.
            statusHistory: [{ status: 'waitlist', at: new Date() }]
        });

        // El aviso no debe tumbar el pedido: si algo falla al notificar, el
        // pedido ya esta creado y el vendedor lo vera igual en su lista.
        try {
            await notifyNewOrder(order, req.user);
        } catch (notifyError) {
            console.error('Order notification failed:', notifyError);
        }

        res.status(201).json({ message: 'Order requested', order });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/orders/mine
// @desc    The logged-in buyer's own orders
// @access  Private
router.get('/mine', auth, async (req, res) => {
    try {
        const orders = await Order.find({ buyerId: req.userId }, { sort: { createdAt: -1 } });
        res.json({ orders });
    } catch (error) {
        console.error('List my orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/orders/:id/repeat
// @desc    Volver a pedir lo mismo de un pedido anterior, con una hora de
//          entrega nueva. NO se copian el total ni la tarifa del domicilio:
//          se recalculan contra el catalogo y la ubicacion actuales, porque
//          los precios y las promociones pueden haber cambiado desde entonces.
// @access  Private (order owner only)
router.post('/:id/repeat', [
    auth,
    body('requestedDeliveryTime').isISO8601().withMessage('requestedDeliveryTime must be an ISO date')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const previous = await Order.findById(req.params.id);
        if (!previous) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (previous.buyerId !== req.userId) {
            return res.status(403).json({ error: 'Not your order' });
        }

        const requestedDeliveryTime = new Date(req.body.requestedDeliveryTime);
        if (requestedDeliveryTime <= new Date()) {
            return res.status(400).json({ error: 'requestedDeliveryTime must be in the future' });
        }

        const capacity = await checkCapacity(requestedDeliveryTime);
        if (!capacity.ok) {
            return res.status(409).json({ error: capacity.error, reason: capacity.reason });
        }

        // Recalcular precios: un producto pudo subir de precio, salir del
        // catalogo o cambiar de promocion.
        const items = [];
        let totalCOP = 0;
        let totalSavedCOP = 0;
        const unavailable = [];

        for (const prev of previous.items) {
            const product = await Product.findById(prev.productId);
            if (!product || !product.active) {
                unavailable.push(prev.name);
                continue;
            }
            const { subtotalCOP, bundlesApplied, savedCOP } = priceLine(product, prev.qty);
            items.push({
                productId: product._id,
                name: product.name,
                emoji: product.emoji,
                unitPriceCOP: product.priceCOP,
                qty: prev.qty,
                subtotalCOP,
                bundlesApplied,
                savedCOP
            });
            totalCOP += subtotalCOP;
            totalSavedCOP += savedCOP;
        }

        if (items.length === 0) {
            return res.status(409).json({
                error: 'Ninguno de esos productos sigue disponible',
                reason: 'all_unavailable',
                unavailable
            });
        }

        // Se reutiliza el destino anterior, pero la tarifa se vuelve a cotizar.
        let delivery = null;
        if (previous.delivery) {
            const origin = await ShopSettings.getLocation();
            const quoted = origin && quoteDelivery(origin, {
                lat: previous.delivery.lat,
                lng: previous.delivery.lng
            });

            if (!quoted || !quoted.ok) {
                return res.status(422).json({
                    error: quoted?.error || 'No se pudo cotizar el domicilio a esa direccion',
                    reason: quoted?.reason || 'no_origin'
                });
            }

            delivery = {
                lat: previous.delivery.lat,
                lng: previous.delivery.lng,
                address: previous.delivery.address || '',
                km: quoted.km,
                feeCOP: quoted.feeCOP
            };
            totalCOP += quoted.feeCOP;
        }

        const order = await Order.create({
            buyerId: req.userId,
            items,
            totalCOP,
            totalSavedCOP,
            delivery,
            requestedDeliveryTime,
            notes: previous.notes || '',
            repeatOf: previous._id,
            statusHistory: [{ status: 'waitlist', at: new Date() }]
        });

        try {
            await notifyNewOrder(order, req.user);
        } catch (notifyError) {
            console.error('Order notification failed:', notifyError);
        }

        res.status(201).json({
            message: 'Pedido repetido',
            order,
            // Se avisa de lo que no se pudo incluir, en vez de entregar un
            // pedido incompleto en silencio.
            unavailable
        });
    } catch (error) {
        console.error('Repeat order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/orders
// @desc    All orders, with basic buyer contact info joined in
// @access  Private (shop admin only)
router.get('/', [auth, shopAdmin], async (req, res) => {
    try {
        const orders = await Order.find({}, { sort: { createdAt: -1 } });
        const buyerIds = [...new Set(orders.map((o) => o.buyerId))];
        const buyers = await Promise.all(buyerIds.map((id) => User.findById(id)));
        const buyerById = Object.fromEntries(
            buyers.filter(Boolean).map((u) => [u._id, { username: u.username, email: u.email }])
        );

        res.json({
            orders: orders.map((o) => ({ ...o, buyer: buyerById[o.buyerId] || null }))
        });
    } catch (error) {
        console.error('List orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/orders/:id/status
// @desc    Move an order through the fulfillment pipeline (or off the
//          waitlist once the seller can confirm the requested delivery time)
// @access  Private (shop admin only)
router.patch('/:id/status', [
    auth,
    shopAdmin,
    body('status').isIn(VALID_STATUSES).withMessage(`status must be one of ${VALID_STATUSES.join(', ')}`)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const update = {
            status: req.body.status,
            $push: { statusHistory: { status: req.body.status, at: new Date() } }
        };
        if (req.body.status === 'confirmed' && req.body.confirmedDeliveryTime) {
            update.confirmedDeliveryTime = new Date(req.body.confirmedDeliveryTime);
        }

        // findByIdAndUpdate mete los campos planos en $set y respeta $push.
        const { $push, ...fields } = update;
        const updated = await Order.findByIdAndUpdate(req.params.id, { $set: fields, $push });

        // Avisar al comprador de que su pedido avanzo, sin dejar que un fallo
        // del aviso revierta un cambio de estado ya guardado.
        try {
            await notifyStatusChange(updated, req.body.status);
        } catch (notifyError) {
            console.error('Status notification failed:', notifyError);
        }

        res.json({ message: 'Order status updated', order: updated });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/orders/:id/pay
// @desc    Report a payment for the order.
//          - crypto: verified for real on-chain right here (txHash required).
//          - nequi / breb: no gateway API wired up yet, so this just records
//            the buyer's reference and flips paymentStatus to "pending" —
//            the seller confirms manually (PATCH .../confirm-payment) after
//            checking the transfer landed in their Nequi/Bre-B account.
// @access  Private (order owner only)
router.post('/:id/pay', [
    auth,
    body('method').isIn(VALID_METHODS).withMessage(`method must be one of ${VALID_METHODS.join(', ')}`)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.buyerId !== req.userId) {
            return res.status(403).json({ error: 'Not your order' });
        }

        const { method, txHash, reference } = req.body;

        if (method === 'crypto') {
            if (!txHash) {
                return res.status(400).json({ error: 'txHash required for crypto payments' });
            }
            let confirmed = false;
            try {
                confirmed = await web3PaymentService.verifyTransaction(txHash);
            } catch (chainError) {
                console.error('On-chain verification error:', chainError);
                return res.status(502).json({ error: 'Could not reach the chain to verify the transaction, try again' });
            }
            if (!confirmed) {
                return res.status(400).json({ error: 'Transaction not found or not successful on-chain' });
            }
            const updated = await Order.findByIdAndUpdate(req.params.id, {
                paymentStatus: 'paid',
                paymentMethod: 'crypto',
                paymentRef: txHash
            });
            return res.json({ message: 'Payment verified on-chain', order: updated });
        }

        // nequi / breb: no gateway integration yet — mark pending for the
        // seller to confirm by hand.
        const updated = await Order.findByIdAndUpdate(req.params.id, {
            paymentStatus: 'pending',
            paymentMethod: method,
            paymentRef: reference || ''
        });
        res.json({
            message: 'Payment reported, awaiting seller confirmation',
            order: updated
        });
    } catch (error) {
        console.error('Report payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/orders/:id/confirm-payment
// @desc    Seller manually confirms (or rejects) a pending Nequi/Bre-B payment
// @access  Private (shop admin only)
router.patch('/:id/confirm-payment', [
    auth,
    shopAdmin,
    body('paid').isBoolean().withMessage('paid must be true or false')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const updated = await Order.findByIdAndUpdate(req.params.id, {
            paymentStatus: req.body.paid ? 'paid' : 'unpaid'
        });
        res.json({ message: 'Payment confirmation updated', order: updated });
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
