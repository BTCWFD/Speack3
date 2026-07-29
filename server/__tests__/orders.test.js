// Require helpers first so NODE_ENV/JWT secrets are set before the app loads.
const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'seller@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

jest.mock('../services/web3PaymentService', () => ({
    verifyTransaction: jest.fn()
}));
const web3PaymentService = require('../services/web3PaymentService');

async function createProduct(admin, overrides = {}) {
    const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Fresa', emoji: '🍓', priceCOP: 60000, ...overrides });
    return res.body.product;
}

function futureISO(hours = 24) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

describe('Shop catalog + orders', () => {
    // One shop admin for the whole file: SHOP_ADMIN_EMAIL is a fixed address,
    // so registering it fresh in every `it` would collide on the unique
    // email index. Buyers stay per-test since buildUser() makes each unique.
    let admin;
    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
    });

    describe('admin pinned by user id', () => {
        // SHOP_ADMIN_USER_ID takes precedence over the email fallback, so that
        // registering the admin's address can't hand over the shop.
        afterEach(() => {
            delete process.env.SHOP_ADMIN_USER_ID;
            process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;
        });

        it('grants access by id even when the email does not match', async () => {
            process.env.SHOP_ADMIN_USER_ID = admin.id;
            process.env.SHOP_ADMIN_EMAIL = 'someone-else@speack3.test';

            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'Pila', emoji: '🔋', priceCOP: 40000 });

            expect(res.status).toBe(201);
        });

        it('denies someone who merely owns the admin email once an id is pinned', async () => {
            const impostor = await registerUser(app);
            process.env.SHOP_ADMIN_USER_ID = admin.id;
            // Even if the env still names an address the impostor controls,
            // the id is what counts.
            process.env.SHOP_ADMIN_EMAIL = impostor.payload.email;

            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${impostor.token}`)
                .send({ name: 'Robado', emoji: '🏴', priceCOP: 1 });

            expect(res.status).toBe(403);
        });

        it('fails closed when neither id nor email is configured', async () => {
            delete process.env.SHOP_ADMIN_EMAIL;

            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'Nadie', emoji: '🚫', priceCOP: 1 });

            expect(res.status).toBe(503);
        });
    });

    it('only the shop admin (by SHOP_ADMIN_EMAIL) can create products', async () => {
        const buyer = await registerUser(app);

        const asAdmin = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ name: 'Coco', emoji: '🥥', priceCOP: 40000 });
        expect(asAdmin.status).toBe(201);

        const asBuyer = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ name: 'Pirata', emoji: '🏴‍☠️', priceCOP: 1 });
        expect(asBuyer.status).toBe(403);
    });

    it('computes the order total from the catalog, ignoring any client-sent price', async () => {
        const buyer = await registerUser(app);
        const product = await createProduct(admin, { priceCOP: 60000 });

        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({
                items: [{ productId: product._id, qty: 2, priceCOP: 1 }],
                requestedDeliveryTime: futureISO()
            });

        expect(res.status).toBe(201);
        expect(res.body.order.totalCOP).toBe(120000);
        expect(res.body.order.status).toBe('waitlist');
        expect(res.body.order.paymentStatus).toBe('unpaid');
    });

    it('rejects a requestedDeliveryTime in the past', async () => {
        const buyer = await registerUser(app);
        const product = await createProduct(admin);

        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({
                items: [{ productId: product._id, qty: 1 }],
                requestedDeliveryTime: new Date(Date.now() - 60000).toISOString()
            });

        expect(res.status).toBe(400);
    });

    it('only the shop admin can move an order off the waitlist', async () => {
        const buyer = await registerUser(app);
        const product = await createProduct(admin);

        const orderRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: futureISO() });
        const orderId = orderRes.body.order._id;

        const asBuyer = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ status: 'confirmed' });
        expect(asBuyer.status).toBe(403);

        const asAdmin = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ status: 'confirmed', confirmedDeliveryTime: futureISO(48) });
        expect(asAdmin.status).toBe(200);
        expect(asAdmin.body.order.status).toBe('confirmed');
        expect(asAdmin.body.order.confirmedDeliveryTime).toBeDefined();
    });

    it('confirms a crypto payment only when the tx verifies on-chain', async () => {
        const buyer = await registerUser(app);
        const product = await createProduct(admin);

        const orderRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: futureISO() });
        const orderId = orderRes.body.order._id;

        web3PaymentService.verifyTransaction.mockResolvedValueOnce(false);
        const failed = await request(app)
            .post(`/api/orders/${orderId}/pay`)
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ method: 'crypto', txHash: '0xbad' });
        expect(failed.status).toBe(400);

        web3PaymentService.verifyTransaction.mockResolvedValueOnce(true);
        const paid = await request(app)
            .post(`/api/orders/${orderId}/pay`)
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ method: 'crypto', txHash: '0xgood' });
        expect(paid.status).toBe(200);
        expect(paid.body.order.paymentStatus).toBe('paid');
    });

    it('marks nequi/breb payments pending until the seller confirms them by hand', async () => {
        const buyer = await registerUser(app);
        const product = await createProduct(admin);

        const orderRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: futureISO() });
        const orderId = orderRes.body.order._id;

        const reported = await request(app)
            .post(`/api/orders/${orderId}/pay`)
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ method: 'nequi', reference: '3001234567' });
        expect(reported.status).toBe(200);
        expect(reported.body.order.paymentStatus).toBe('pending');

        const confirmed = await request(app)
            .patch(`/api/orders/${orderId}/confirm-payment`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ paid: true });
        expect(confirmed.status).toBe(200);
        expect(confirmed.body.order.paymentStatus).toBe('paid');
    });
});
