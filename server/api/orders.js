const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const { isShopAdmin } = require('../middleware/shopAdmin');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const web3PaymentService = require('../services/web3PaymentService');
const { checkCapacity } = require('../services/capacityService');
const { priceLine } = require('../services/pricingService');
const { quote: quoteDelivery } = require('../services/deliveryService');
const { validateReceipt } = require('../services/receiptValidator');
const ShopSettings = require('../models/ShopSettings');
const { notifyNewOrder, notifyStatusChange } = require('../services/notificationService');

// Un comprobante es una imagen en base64 de ~1-3 MB. Devolverla dentro de cada
// pedido haria que listar 20 pedidos moviera decenas de megas y reventara la
// app en datos moviles. Se reemplaza por una bandera y se sirve aparte.
const stripReceipt = (order) => {
    if (!order) return order;
    const { receipt, ...rest } = order;
    return { ...rest, hasReceipt: Boolean(receipt?.image) };
};

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

        // Si la tienda esta cerrada no se recibe nada, sin importar el resto.
        if (!(await ShopSettings.isOpen())) {
            return res.status(409).json({
                error: 'La tienda esta cerrada en este momento',
                reason: 'shop_closed'
            });
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
        // Lo ya descontado, para devolverlo si una linea posterior falla y el
        // pedido no llega a crearse.
        const reserved = [];

        const rollbackReserved = async () => {
            for (const r of reserved) {
                await Product.restoreStock(r.productId, r.qty);
            }
        };

        for (const { productId, qty } of req.body.items) {
            const product = await Product.findById(productId);
            if (!product || !product.active) {
                await rollbackReserved();
                return res.status(400).json({ error: `Product ${productId} not available` });
            }

            // Reservar el stock ANTES de cobrar: si no alcanza, no hay pedido.
            if (Product.tracksStock(product)) {
                const ok = await Product.tryDecrementStock(product._id, qty);
                if (!ok) {
                    await rollbackReserved();
                    return res.status(409).json({
                        error: `No hay suficiente ${product.name} (quedan ${product.stock})`,
                        reason: 'out_of_stock',
                        productId: product._id,
                        available: product.stock
                    });
                }
                reserved.push({ productId: product._id, qty });
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
                // El stock ya estaba reservado: si el pedido no se crea, hay
                // que devolverlo o quedaria retenido para siempre.
                await rollbackReserved();
                return res.status(503).json({
                    error: 'La tienda aun no tiene ubicacion configurada para domicilios',
                    reason: 'no_origin'
                });
            }

            const { lat, lng, address } = req.body.destination;
            const quoted = quoteDelivery(origin, { lat: Number(lat), lng: Number(lng) });
            if (!quoted.ok) {
                await rollbackReserved();
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

// @route   GET /api/orders/:id/receipt
// @desc    El comprobante de pago de un pedido. Solo lo ven el comprador que
//          lo subio y el vendedor que tiene que verificarlo: es una captura
//          bancaria con nombres y numeros de cuenta.
// @access  Private (dueno del pedido o shop admin)
router.get('/:id/receipt', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const esDueno = order.buyerId === req.userId;
        if (!esDueno && !isShopAdmin(req.user)) {
            return res.status(403).json({ error: 'No puedes ver este comprobante' });
        }

        if (!order.receipt?.image) {
            return res.status(404).json({ error: 'Ese pedido no tiene comprobante' });
        }

        res.json({
            receipt: {
                image: order.receipt.image,
                mime: order.receipt.mime,
                uploadedAt: order.receipt.uploadedAt
            }
        });
    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/orders/mine
// @desc    The logged-in buyer's own orders
// @access  Private
router.get('/mine', auth, async (req, res) => {
    try {
        const orders = await Order.find({ buyerId: req.userId }, { sort: { createdAt: -1 } });
        res.json({ orders: orders.map(stripReceipt) });
    } catch (error) {
        console.error('List my orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Devuelve al catalogo el stock de un pedido que se cancela. Se marca en el
// propio pedido para no devolverlo dos veces si se cancela dos veces.
async function releaseStock(order) {
    if (order.stockReleased) return;

    for (const item of order.items || []) {
        const product = await Product.findById(item.productId);
        if (product && Product.tracksStock(product)) {
            await Product.restoreStock(item.productId, item.qty);
        }
    }
    await Order.findByIdAndUpdate(order._id, { stockReleased: true });
}

// Estados en los que el COMPRADOR todavia puede echarse para atras solo. Una
// vez el vendedor empezo a preparar ya invirtio tiempo y producto, asi que a
// partir de ahi la cancelacion la decide el vendedor.
const BUYER_CANCELLABLE = ['waitlist', 'confirmed'];

// @route   POST /api/orders/:id/cancel
// @desc    Cancelar un pedido propio
// @access  Private (dueno del pedido)
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        if (order.buyerId !== req.userId) {
            return res.status(403).json({ error: 'Not your order' });
        }
        if (order.status === 'cancelled') {
            return res.status(409).json({ error: 'Ese pedido ya estaba cancelado' });
        }
        if (!BUYER_CANCELLABLE.includes(order.status)) {
            return res.status(409).json({
                error: 'Ese pedido ya esta en preparacion. Escribele al vendedor para cancelarlo.',
                reason: 'too_late'
            });
        }

        // Si ya habia pagado, el dinero hay que devolverlo POR FUERA (Nequi,
        // Bre-B y cripto no se reversan solos). Se marca para que el vendedor
        // lo vea pendiente en vez de que el pago quede en el limbo.
        const refundPending = order.paymentStatus === 'paid' || order.paymentStatus === 'pending';

        const updated = await Order.findByIdAndUpdate(req.params.id, {
            $set: {
                status: 'cancelled',
                cancelledBy: 'buyer',
                cancelReason: (req.body.reason || '').slice(0, 300),
                ...(refundPending ? { refundPending: true } : {})
            },
            $push: { statusHistory: { status: 'cancelled', at: new Date() } }
        });

        await releaseStock(updated);

        try {
            await notifyStatusChange(updated, 'cancelled');
        } catch (notifyError) {
            console.error('Cancel notification failed:', notifyError);
        }

        res.json({
            message: 'Pedido cancelado',
            order: updated,
            refundPending,
            // Se dice explicitamente: el sistema no mueve el dinero.
            refundNote: refundPending
                ? 'Ya habias reportado un pago. El vendedor debe devolverte el dinero por el mismo medio; no se reversa solo.'
                : null
        });
    } catch (error) {
        console.error('Cancel order error:', error);
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
            orders: orders.map((o) => ({ ...stripReceipt(o), buyer: buyerById[o.buyerId] || null }))
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

        // Si el vendedor cancela, el producto vuelve al catalogo igual que
        // cuando cancela el comprador.
        if (req.body.status === 'cancelled') {
            await releaseStock(updated);
        }

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

        const { method, txHash, reference, receipt } = req.body;

        // Comprobante opcional (captura de la transferencia). Se valida de
        // verdad porque despues se le sirve a otra persona.
        let receiptData;
        if (receipt !== undefined && receipt !== null) {
            const check = validateReceipt(receipt);
            if (!check.ok) {
                return res.status(check.status || 400).json({ error: check.error });
            }
            receiptData = { image: receipt, mime: check.mime, uploadedAt: new Date() };
        }

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
            paymentRef: reference || '',
            ...(receiptData ? { receipt: receiptData } : {})
        });
        res.json({
            message: 'Payment reported, awaiting seller confirmation',
            // La imagen no viaja aqui: engordaria esta respuesta y todas las
            // listas de pedidos. Se pide aparte con GET .../receipt.
            order: stripReceipt(updated),
            hasReceipt: Boolean(receiptData)
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
