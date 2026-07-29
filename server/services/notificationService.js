const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('./realtime');
const { resolveAdminUser } = require('../middleware/shopAdmin');

// A quien avisar de un pedido nuevo: al admin de la tienda y a los vendedores
// activos que puedan atenderlo.
async function shopStaffIds() {
    const ids = new Set();

    const admin = await resolveAdminUser();
    if (admin) ids.add(admin._id);

    const sellers = await User.find({ role: 'seller' });
    for (const s of sellers) {
        if (s.sellerActive !== false) ids.add(s._id);
    }

    return [...ids];
}

// Guarda el aviso y lo empuja por socket. Se guarda SIEMPRE, aunque el socket
// falle o la persona este desconectada: el vendedor tiene que poder abrir la
// app despues y encontrarlo.
async function notify(userId, { type, title, body, orderId }) {
    const notification = await Notification.create({ userId, type, title, body, orderId });
    emitToUser(userId, 'notification:new', notification);
    return notification;
}

const formatCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

// Aviso de pedido nuevo para el vendedor.
async function notifyNewOrder(order, buyer) {
    const resumen = order.items.map((i) => `${i.qty}x ${i.emoji} ${i.name}`).join(', ');
    const staff = await shopStaffIds();

    return await Promise.all(staff.map((userId) => notify(userId, {
        type: 'order:new',
        title: 'Pedido nuevo',
        body: `${buyer?.username || 'Alguien'} pidio ${resumen} — ${formatCOP(order.totalCOP)}`,
        orderId: order._id
    })));
}

const STATUS_LABEL = {
    waitlist: 'en lista de espera',
    confirmed: 'confirmado',
    preparing: 'en preparacion',
    ready: 'listo',
    delivered: 'entregado',
    cancelled: 'cancelado'
};

// Aviso al comprador de que su pedido cambio de estado.
async function notifyStatusChange(order, status) {
    return await notify(order.buyerId, {
        type: 'order:status',
        title: 'Tu pedido cambio de estado',
        body: `Tu pedido esta ${STATUS_LABEL[status] || status}`,
        orderId: order._id
    });
}

module.exports = { notify, notifyNewOrder, notifyStatusChange, shopStaffIds, STATUS_LABEL };
