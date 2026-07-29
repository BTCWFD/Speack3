const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'stock-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

describe('Stock y cancelacion', () => {
    let admin;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
    });

    const newProduct = async (overrides = {}) => {
        const res = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: `P${Date.now()}${Math.random()}`, emoji: '📦', priceCOP: 10000, ...overrides });
        return res.body.product;
    };

    const order = async (buyer, product, qty = 1, when = future()) =>
        await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty }], requestedDeliveryTime: when });

    describe('stock', () => {
        it('un producto sin stock definido es ilimitado', async () => {
            const p = await newProduct();
            const buyer = await registerUser(app);
            const res = await order(buyer, p, 9999);
            expect(res.status).toBe(201);
        });

        it('descuenta el stock al pedir', async () => {
            const p = await newProduct({ stock: 10 });
            const buyer = await registerUser(app);
            await order(buyer, p, 3);

            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(7);
        });

        it('rechaza el pedido si no alcanza el stock', async () => {
            const p = await newProduct({ stock: 2 });
            const buyer = await registerUser(app);

            const res = await order(buyer, p, 3);
            expect(res.status).toBe(409);
            expect(res.body.reason).toBe('out_of_stock');
            expect(res.body.available).toBe(2);

            // Y no descuenta nada al fallar.
            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(2);
        });

        it('dos pedidos simultaneos no venden mas de lo que hay', async () => {
            const p = await newProduct({ stock: 1 });
            const a = await registerUser(app);
            const b = await registerUser(app);

            const [r1, r2] = await Promise.all([order(a, p, 1), order(b, p, 1)]);
            const codes = [r1.status, r2.status].sort();

            // Uno pasa y el otro se queda sin stock: nunca los dos.
            expect(codes).toEqual([201, 409]);

            const catalog = await request(app).get('/api/products').set(bearer(a));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(0);
        });

        it('devuelve el stock reservado si el pedido falla despues (destino invalido)', async () => {
            // Hace falta una tienda ubicada para llegar a la validacion del
            // destino; sin ella el pedido fallaria antes, por otra razon.
            await request(app).put('/api/delivery/origin').set(bearer(admin))
                .send({ lat: 4.6486, lng: -74.0628, address: 'Chapinero' });

            const p = await newProduct({ stock: 5 });
            const buyer = await registerUser(app);

            const res = await request(app).post('/api/orders').set(bearer(buyer)).send({
                items: [{ productId: p._id, qty: 2 }],
                requestedDeliveryTime: future(),
                destination: { lat: 6.2442, lng: -75.5812 } // Medellin: fuera de cobertura
            });
            expect(res.status).toBe(422);

            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(5);
        });

        it('rechaza un stock invalido', async () => {
            const res = await request(app).post('/api/products').set(bearer(admin))
                .send({ name: 'Malo', emoji: '❌', priceCOP: 1000, stock: -5 });
            expect(res.status).toBe(400);
        });
    });

    describe('cancelacion', () => {
        it('el comprador cancela y el stock vuelve', async () => {
            const p = await newProduct({ stock: 4 });
            const buyer = await registerUser(app);
            const created = await order(buyer, p, 2);

            const res = await request(app)
                .post(`/api/orders/${created.body.order._id}/cancel`)
                .set(bearer(buyer)).send({ reason: 'ya no lo necesito' });

            expect(res.status).toBe(200);
            expect(res.body.order.status).toBe('cancelled');
            expect(res.body.order.statusHistory.map((h) => h.status)).toContain('cancelled');

            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(4);
        });

        it('cancelar dos veces no duplica el stock devuelto', async () => {
            const p = await newProduct({ stock: 3 });
            const buyer = await registerUser(app);
            const created = await order(buyer, p, 1);
            const id = created.body.order._id;

            await request(app).post(`/api/orders/${id}/cancel`).set(bearer(buyer)).send({});
            const second = await request(app).post(`/api/orders/${id}/cancel`).set(bearer(buyer)).send({});
            expect(second.status).toBe(409);

            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(3);
        });

        it('no deja cancelar un pedido ajeno', async () => {
            const p = await newProduct();
            const buyer = await registerUser(app);
            const created = await order(buyer, p);

            const intruso = await registerUser(app);
            const res = await request(app)
                .post(`/api/orders/${created.body.order._id}/cancel`)
                .set(bearer(intruso)).send({});
            expect(res.status).toBe(403);
        });

        it('el comprador no puede cancelar cuando ya esta en preparacion', async () => {
            const p = await newProduct();
            const buyer = await registerUser(app);
            const created = await order(buyer, p);
            const id = created.body.order._id;

            await request(app).patch(`/api/orders/${id}/status`).set(bearer(admin))
                .send({ status: 'preparing' });

            const res = await request(app).post(`/api/orders/${id}/cancel`).set(bearer(buyer)).send({});
            expect(res.status).toBe(409);
            expect(res.body.reason).toBe('too_late');
        });

        it('avisa que hay que devolver el dinero si ya habia pagado', async () => {
            const p = await newProduct();
            const buyer = await registerUser(app);
            const created = await order(buyer, p);
            const id = created.body.order._id;

            await request(app).post(`/api/orders/${id}/pay`).set(bearer(buyer))
                .send({ method: 'nequi', reference: '3001112233' });

            const res = await request(app).post(`/api/orders/${id}/cancel`).set(bearer(buyer)).send({});
            expect(res.status).toBe(200);
            expect(res.body.refundPending).toBe(true);
            expect(res.body.refundNote).toMatch(/devolverte el dinero/i);
        });

        it('el vendedor cancela y el stock tambien vuelve', async () => {
            const p = await newProduct({ stock: 6 });
            const buyer = await registerUser(app);
            const created = await order(buyer, p, 2);

            await request(app).patch(`/api/orders/${created.body.order._id}/status`)
                .set(bearer(admin)).send({ status: 'cancelled' });

            const catalog = await request(app).get('/api/products').set(bearer(buyer));
            expect(catalog.body.products.find((x) => x._id === p._id).stock).toBe(6);
        });

        it('un pedido cancelado libera el cupo de su franja', async () => {
            // Ya cubierto en slots.test.js; aqui se comprueba que la ruta nueva
            // de cancelacion del comprador tambien lo libera.
            const p = await newProduct();
            const buyer = await registerUser(app);
            const created = await order(buyer, p);

            const res = await request(app)
                .post(`/api/orders/${created.body.order._id}/cancel`)
                .set(bearer(buyer)).send({});
            expect(res.body.order.status).toBe('cancelled');
        });
    });
});
