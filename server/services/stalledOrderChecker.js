const Order = require('../models/Order');
const { notifyStalledOrder } = require('./notificationService');

// Cuanto tiempo en "listo" o "en camino" sin avanzar cuenta como estancado.
// Son los dos puntos donde el pedido depende de una accion humana pendiente
// (empacarlo/salir, o entregarlo) y no de que el cliente confirme algo.
const STALLED_AFTER_MS = Number(process.env.STALLED_ORDER_MINUTES ?? 45) * 60 * 1000;
const STALLED_STATUSES = ['ready', 'on_the_way'];

// Revisa una vez y avisa lo que encuentre. Exportada aparte de start() para
// poder probarla en los tests sin depender de temporizadores reales.
async function checkStalledOrders(now = new Date()) {
    const all = await Order.find({});
    const notified = [];

    for (const order of all) {
        if (!STALLED_STATUSES.includes(order.status)) continue;
        if (order.stalledNotifiedAt) continue; // ya se avisó una vez para este estado

        const history = order.statusHistory || [];
        const lastEntry = [...history].reverse().find((h) => h.status === order.status);
        const since = lastEntry ? new Date(lastEntry.at) : new Date(order.createdAt);

        if (now.getTime() - since.getTime() >= STALLED_AFTER_MS) {
            await notifyStalledOrder(order);
            await Order.findByIdAndUpdate(order._id, { stalledNotifiedAt: now });
            notified.push(order._id);
        }
    }

    return notified;
}

let timer = null;

// Se corre cada 10 minutos mientras el proceso este vivo. En el plan free de
// Render el proceso se duerme sin trafico, asi que esto NO es un cron
// confiable 24/7 — es "revisa mientras alguien este usando la tienda", que
// para el volumen actual alcanza. Si hace falta garantia real, la alternativa
// es un cron externo (p.ej. cron-job.org) pegandole a un endpoint dedicado.
function start(intervalMs = 10 * 60 * 1000) {
    if (timer) return; // no duplicar si start() se llama dos veces
    timer = setInterval(() => {
        checkStalledOrders().catch((err) => console.error('Stalled order check failed:', err));
    }, intervalMs);
    timer.unref?.(); // no mantener el proceso vivo solo por este timer
}

function stop() {
    clearInterval(timer);
    timer = null;
}

module.exports = { checkStalledOrders, start, stop, STALLED_AFTER_MS };
