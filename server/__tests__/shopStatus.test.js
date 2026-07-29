const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'status-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

describe('Abrir/cerrar tienda y disponibilidad del vendedor', () => {
    let admin;
    let product;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item status', emoji: '📦', priceCOP: 5000 });
        product = r.body.product;
    });

    afterEach(async () => {
        // Dejar la tienda abierta para no arrastrar estado entre pruebas.
        await request(app).put('/api/shop/open').set(bearer(admin)).send({ open: true });
    });

    it('la tienda arranca abierta', async () => {
        const res = await request(app).get('/api/shop/status').set(bearer(admin));
        expect(res.status).toBe(200);
        expect(res.body.open).toBe(true);
    });

    it('con la tienda cerrada no se reciben pedidos', async () => {
        await request(app).put('/api/shop/open').set(bearer(admin)).send({ open: false });

        const buyer = await registerUser(app);
        const res = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        expect(res.status).toBe(409);
        expect(res.body.reason).toBe('shop_closed');
    });

    it('al reabrir vuelve a recibir pedidos', async () => {
        await request(app).put('/api/shop/open').set(bearer(admin)).send({ open: false });
        await request(app).put('/api/shop/open').set(bearer(admin)).send({ open: true });

        const buyer = await registerUser(app);
        const res = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        expect(res.status).toBe(201);
    });

    it('solo el admin abre o cierra la tienda', async () => {
        const buyer = await registerUser(app);
        const res = await request(app).put('/api/shop/open').set(bearer(buyer)).send({ open: false });
        expect(res.status).toBe(403);
    });

    it('un vendedor fuera de linea deja de recibir avisos de pedidos nuevos', async () => {
        const candidate = await registerUser(app);
        await request(app).post('/api/sellers').set(bearer(admin))
            .send({ email: candidate.payload.email, services: ['catalogo'] });

        // Aceptar los documentos para poder operar.
        const docs = await request(app).get('/api/legal');
        await request(app).post('/api/legal/accept').set(bearer(candidate))
            .send({ accept: docs.body.documents.map((d) => ({ id: d.id, version: d.version })) });

        // En linea: recibe el aviso.
        const buyer1 = await registerUser(app);
        await request(app).post('/api/orders').set(bearer(buyer1))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        const online = await request(app).get('/api/notifications').set(bearer(candidate));
        const antes = online.body.notifications.length;
        expect(antes).toBeGreaterThan(0);

        // Fuera de linea: ya no.
        const off = await request(app).put('/api/shop/availability')
            .set(bearer(candidate)).send({ available: false });
        expect(off.body.available).toBe(false);

        const buyer2 = await registerUser(app);
        await request(app).post('/api/orders').set(bearer(buyer2))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        const offline = await request(app).get('/api/notifications').set(bearer(candidate));
        expect(offline.body.notifications.length).toBe(antes);
    });

    it('un comprador cualquiera no puede cambiar disponibilidad de vendedor', async () => {
        const buyer = await registerUser(app);
        const res = await request(app).put('/api/shop/availability')
            .set(bearer(buyer)).send({ available: false });
        expect(res.status).toBe(403);
    });
});
