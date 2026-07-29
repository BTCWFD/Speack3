const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'flow-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

describe('Avisos, estado del pedido y repetir pedido', () => {
    let admin;
    let fresa;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Fresa flow', emoji: '🍓', priceCOP: 60000, bundleQty: 2, bundlePriceCOP: 100000 });
        fresa = r.body.product;
    });

    async function placeOrder(buyer, qty = 1) {
        return await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: fresa._id, qty }], requestedDeliveryTime: future() });
    }

    describe('avisos', () => {
        it('un pedido nuevo le genera aviso al vendedor', async () => {
            const before = await request(app).get('/api/notifications').set(bearer(admin));
            const buyer = await registerUser(app);
            await placeOrder(buyer);

            const after = await request(app).get('/api/notifications').set(bearer(admin));
            expect(after.body.notifications.length).toBeGreaterThan(before.body.notifications.length);

            const aviso = after.body.notifications[0];
            expect(aviso.type).toBe('order:new');
            expect(aviso.read).toBe(false);
        });

        it('el comprador recibe aviso cuando cambia el estado', async () => {
            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);

            await request(app)
                .patch(`/api/orders/${order.body.order._id}/status`)
                .set(bearer(admin))
                .send({ status: 'confirmed' });

            const avisos = await request(app).get('/api/notifications').set(bearer(buyer));
            expect(avisos.body.notifications[0].type).toBe('order:status');
            expect(avisos.body.unread).toBeGreaterThan(0);
        });

        it('nadie puede marcar leidas las notificaciones de otro', async () => {
            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);
            await request(app).patch(`/api/orders/${order.body.order._id}/status`)
                .set(bearer(admin)).send({ status: 'preparing' });

            const suyas = await request(app).get('/api/notifications').set(bearer(buyer));
            const id = suyas.body.notifications[0]._id;

            const intruso = await registerUser(app);
            const res = await request(app).patch(`/api/notifications/${id}/read`).set(bearer(intruso));
            expect(res.status).toBe(404);

            // Y sigue sin leer para su dueno.
            const check = await request(app).get('/api/notifications').set(bearer(buyer));
            expect(check.body.notifications.find((n) => n._id === id).read).toBe(false);
        });

        it('marcar todas como leidas deja el contador en cero', async () => {
            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);
            await request(app).patch(`/api/orders/${order.body.order._id}/status`)
                .set(bearer(admin)).send({ status: 'ready' });

            await request(app).post('/api/notifications/read-all').set(bearer(buyer));
            const after = await request(app).get('/api/notifications').set(bearer(buyer));
            expect(after.body.unread).toBe(0);
        });
    });

    describe('estado del pedido', () => {
        it('guarda la linea de tiempo completa, no solo el ultimo estado', async () => {
            const buyer = await registerUser(app);
            const created = await placeOrder(buyer);
            const id = created.body.order._id;

            expect(created.body.order.statusHistory).toHaveLength(1);
            expect(created.body.order.statusHistory[0].status).toBe('waitlist');

            for (const status of ['confirmed', 'preparing', 'ready', 'delivered']) {
                await request(app).patch(`/api/orders/${id}/status`).set(bearer(admin)).send({ status });
            }

            const mine = await request(app).get('/api/orders/mine').set(bearer(buyer));
            const order = mine.body.orders.find((o) => o._id === id);

            expect(order.status).toBe('delivered');
            expect(order.statusHistory.map((h) => h.status))
                .toEqual(['waitlist', 'confirmed', 'preparing', 'ready', 'delivered']);
        });
    });

    describe('repetir pedido', () => {
        it('repite el pedido recalculando el precio actual', async () => {
            const buyer = await registerUser(app);
            const first = await placeOrder(buyer, 2);
            expect(first.body.order.totalCOP).toBe(100000);

            // Sube el precio entre un pedido y el siguiente.
            await request(app).put(`/api/products/${fresa._id}`).set(bearer(admin))
                .send({ bundlePriceCOP: 110000 });

            const repeat = await request(app)
                .post(`/api/orders/${first.body.order._id}/repeat`)
                .set(bearer(buyer))
                .send({ requestedDeliveryTime: future(48) });

            expect(repeat.status).toBe(201);
            // No copia el total viejo: cobra el precio nuevo.
            expect(repeat.body.order.totalCOP).toBe(110000);
            expect(repeat.body.order.repeatOf).toBe(first.body.order._id);

            await request(app).put(`/api/products/${fresa._id}`).set(bearer(admin))
                .send({ bundlePriceCOP: 100000 });
        });

        it('no deja repetir el pedido de otro', async () => {
            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);
            const intruso = await registerUser(app);

            const res = await request(app)
                .post(`/api/orders/${order.body.order._id}/repeat`)
                .set(bearer(intruso))
                .send({ requestedDeliveryTime: future(48) });

            expect(res.status).toBe(403);
        });

        it('avisa si el producto ya no esta disponible', async () => {
            const temporal = await request(app).post('/api/products').set(bearer(admin))
                .send({ name: 'Temporal', emoji: '⏳', priceCOP: 10000 });

            const buyer = await registerUser(app);
            const order = await request(app).post('/api/orders').set(bearer(buyer))
                .send({ items: [{ productId: temporal.body.product._id, qty: 1 }], requestedDeliveryTime: future() });

            await request(app).put(`/api/products/${temporal.body.product._id}`)
                .set(bearer(admin)).send({ active: false });

            const res = await request(app)
                .post(`/api/orders/${order.body.order._id}/repeat`)
                .set(bearer(buyer))
                .send({ requestedDeliveryTime: future(48) });

            expect(res.status).toBe(409);
            expect(res.body.reason).toBe('all_unavailable');
            expect(res.body.unavailable).toContain('Temporal');
        });
    });

    describe('datos de cobro del vendedor', () => {
        it('un comprador cualquiera no puede registrar datos de cobro', async () => {
            const buyer = await registerUser(app);
            const res = await request(app).put('/api/payout-methods/mine')
                .set(bearer(buyer)).send({ nequi: '3001112233' });
            expect(res.status).toBe(403);
        });

        it('valida el formato del numero de Nequi', async () => {
            const res = await request(app).put('/api/payout-methods/mine')
                .set(bearer(admin)).send({ nequi: '123' });
            expect(res.status).toBe(400);
        });

        it('el vendedor registra su Nequi y el comprador de un pedido lo puede ver', async () => {
            await request(app).put('/api/payout-methods/mine')
                .set(bearer(admin)).send({ nequi: '3001112233', breb: 'wilfredo@speack3.test' });

            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);

            const res = await request(app)
                .get(`/api/payout-methods/for-order/${order.body.order._id}`)
                .set(bearer(buyer));

            expect(res.status).toBe(200);
            expect(res.body.payTo.nequi).toBe('3001112233');
            expect(res.body.amountCOP).toBe(order.body.order.totalCOP);
        });

        it('alguien sin pedido NO puede ver el numero del vendedor', async () => {
            const buyer = await registerUser(app);
            const order = await placeOrder(buyer);

            const curioso = await registerUser(app);
            const res = await request(app)
                .get(`/api/payout-methods/for-order/${order.body.order._id}`)
                .set(bearer(curioso));

            expect(res.status).toBe(403);
        });
    });
});
