const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'reviews-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');
const { checkStalledOrders, STALLED_AFTER_MS } = require('../services/stalledOrderChecker');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

// Un solo admin para todo el archivo: SHOP_ADMIN_EMAIL es una direccion fija,
// registrarla dos veces (una por describe) choca con el indice unico de correo.
let admin;
beforeAll(async () => {
    admin = await registerUser(app, { email: ADMIN_EMAIL });
});

describe('Reseñas del pedido', () => {
    let product;

    beforeAll(async () => {
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item review', emoji: '⭐', priceCOP: 20000 });
        product = r.body.product;
    });

    const newOrder = async (buyer) =>
        await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

    const deliver = async (orderId) =>
        await request(app).patch(`/api/orders/${orderId}/status`).set(bearer(admin)).send({ status: 'delivered' });

    it('no se puede calificar un pedido que no esta entregado', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);

        const res = await request(app).post(`/api/orders/${order.body.order._id}/review`)
            .set(bearer(buyer)).send({ rating: 5 });

        expect(res.status).toBe(409);
        expect(res.body.reason).toBe('not_delivered');
    });

    it('el dueño califica un pedido entregado', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await deliver(order.body.order._id);

        const res = await request(app).post(`/api/orders/${order.body.order._id}/review`)
            .set(bearer(buyer)).send({ rating: 4, comment: 'Llegó rápido' });

        expect(res.status).toBe(201);
        expect(res.body.order.review.rating).toBe(4);
        expect(res.body.order.review.comment).toBe('Llegó rápido');
    });

    it('no se puede calificar dos veces', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await deliver(order.body.order._id);
        await request(app).post(`/api/orders/${order.body.order._id}/review`).set(bearer(buyer)).send({ rating: 5 });

        const second = await request(app).post(`/api/orders/${order.body.order._id}/review`)
            .set(bearer(buyer)).send({ rating: 1 });

        expect(second.status).toBe(409);
        expect(second.body.reason).toBe('already_reviewed');
    });

    it('nadie más puede calificar el pedido de otro', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await deliver(order.body.order._id);

        const intruso = await registerUser(app);
        const res = await request(app).post(`/api/orders/${order.body.order._id}/review`)
            .set(bearer(intruso)).send({ rating: 5 });

        expect(res.status).toBe(403);
    });

    it('rechaza calificaciones fuera de 1-5', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await deliver(order.body.order._id);

        const res = await request(app).post(`/api/orders/${order.body.order._id}/review`)
            .set(bearer(buyer)).send({ rating: 6 });

        expect(res.status).toBe(400);
    });

    it('el admin ve todas las reseñas y el promedio; un comprador no', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await deliver(order.body.order._id);
        await request(app).post(`/api/orders/${order.body.order._id}/review`).set(bearer(buyer)).send({ rating: 3 });

        const asAdmin = await request(app).get('/api/orders/reviews/all').set(bearer(admin));
        expect(asAdmin.status).toBe(200);
        expect(asAdmin.body.count).toBeGreaterThan(0);
        expect(asAdmin.body.average).toBeGreaterThan(0);

        const asBuyer = await request(app).get('/api/orders/reviews/all').set(bearer(buyer));
        expect(asBuyer.status).toBe(403);
    });
});

describe('Aviso de pedido estancado', () => {
    let product;

    beforeAll(async () => {
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item stalled', emoji: '⏳', priceCOP: 15000 });
        product = r.body.product;
    });

    it('un pedido recien puesto en "listo" no cuenta como estancado', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });
        await request(app).patch(`/api/orders/${order.body.order._id}/status`).set(bearer(admin)).send({ status: 'ready' });

        const notified = await checkStalledOrders(new Date());
        expect(notified).not.toContain(order.body.order._id);
    });

    it('un pedido "listo" hace tiempo se marca estancado y avisa una sola vez', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });
        const id = order.body.order._id;
        await request(app).patch(`/api/orders/${id}/status`).set(bearer(admin)).send({ status: 'ready' });

        // Simula que ya paso el umbral: revisa "en el futuro".
        const later = new Date(Date.now() + STALLED_AFTER_MS + 60000);
        const first = await checkStalledOrders(later);
        expect(first).toContain(id);

        const before = await request(app).get('/api/notifications').set(bearer(admin));
        const countBefore = before.body.notifications.length;

        // Un segundo barrido en el mismo estado no debe avisar de nuevo.
        const second = await checkStalledOrders(new Date(later.getTime() + 60000));
        expect(second).not.toContain(id);

        const after = await request(app).get('/api/notifications').set(bearer(admin));
        expect(after.body.notifications.length).toBe(countBefore);
    });

    it('avanzar de estado limpia el aviso y puede volver a estancarse en el nuevo', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });
        const id = order.body.order._id;
        await request(app).patch(`/api/orders/${id}/status`).set(bearer(admin)).send({ status: 'ready' });

        const later = new Date(Date.now() + STALLED_AFTER_MS + 60000);
        await checkStalledOrders(later); // se marca estancado en "ready"

        await request(app).patch(`/api/orders/${id}/status`).set(bearer(admin)).send({ status: 'on_the_way' });

        // Ya en "on_the_way", recien puesto: no deberia avisar todavia.
        const rightAfter = await checkStalledOrders(new Date(Date.now() + 60000));
        expect(rightAfter).not.toContain(id);

        // Pero si tambien se estanca en el nuevo estado, si avisa.
        const muchLater = new Date(Date.now() + STALLED_AFTER_MS + 120000);
        const stalledAgain = await checkStalledOrders(muchLater);
        expect(stalledAgain).toContain(id);
    });

    it('un pedido en preparacion (no listo/en camino) nunca se marca estancado', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });
        await request(app).patch(`/api/orders/${order.body.order._id}/status`)
            .set(bearer(admin)).send({ status: 'preparing' });

        const later = new Date(Date.now() + STALLED_AFTER_MS + 60000);
        const notified = await checkStalledOrders(later);
        expect(notified).not.toContain(order.body.order._id);
    });
});
