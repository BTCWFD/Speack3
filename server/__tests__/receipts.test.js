const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'receipts-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');
const { validateReceipt } = require('../services/receiptValidator');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

// PNG de 1x1 real, valido como data URI.
const PNG_1X1 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('Comprobante de pago', () => {
    let admin;
    let product;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item receipt', emoji: '🧾', priceCOP: 30000 });
        product = r.body.product;
    });

    const newOrder = async (buyer) =>
        await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

    describe('validacion', () => {
        it('acepta un PNG valido', () => {
            expect(validateReceipt(PNG_1X1).ok).toBe(true);
        });

        it('rechaza algo que no es data URI de imagen', () => {
            expect(validateReceipt('hola').ok).toBe(false);
            expect(validateReceipt('data:text/html;base64,PHNjcmlwdD4=').ok).toBe(false);
            expect(validateReceipt('').ok).toBe(false);
            expect(validateReceipt(null).ok).toBe(false);
        });

        it('rechaza imagenes demasiado grandes', () => {
            const enorme = `data:image/png;base64,${'A'.repeat(4_000_001)}`;
            const res = validateReceipt(enorme);
            expect(res.ok).toBe(false);
            expect(res.status).toBe(413);
        });

        it('rechaza base64 truncado', () => {
            expect(validateReceipt('data:image/png;base64,abc').ok).toBe(false);
        });
    });

    describe('subir y consultar', () => {
        it('adjunta el comprobante al reportar el pago', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);

            const pay = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
                .set(bearer(buyer))
                .send({ method: 'nequi', reference: '3001112233', receipt: PNG_1X1 });

            expect(pay.status).toBe(200);
            expect(pay.body.hasReceipt).toBe(true);
            // La imagen NO viaja en la respuesta del pedido.
            expect(pay.body.order.receipt).toBeUndefined();
            expect(pay.body.order.hasReceipt).toBe(true);
        });

        it('el comprador puede ver su propio comprobante', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);
            const id = order.body.order._id;

            await request(app).post(`/api/orders/${id}/pay`).set(bearer(buyer))
                .send({ method: 'nequi', receipt: PNG_1X1 });

            const res = await request(app).get(`/api/orders/${id}/receipt`).set(bearer(buyer));
            expect(res.status).toBe(200);
            expect(res.body.receipt.image).toBe(PNG_1X1);
            expect(res.body.receipt.mime).toBe('image/png');
        });

        it('el vendedor puede ver el comprobante para verificarlo', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);
            const id = order.body.order._id;

            await request(app).post(`/api/orders/${id}/pay`).set(bearer(buyer))
                .send({ method: 'breb', receipt: PNG_1X1 });

            const res = await request(app).get(`/api/orders/${id}/receipt`).set(bearer(admin));
            expect(res.status).toBe(200);
            expect(res.body.receipt.image).toBe(PNG_1X1);
        });

        it('un tercero NO puede ver el comprobante de otro', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);
            const id = order.body.order._id;

            await request(app).post(`/api/orders/${id}/pay`).set(bearer(buyer))
                .send({ method: 'nequi', receipt: PNG_1X1 });

            const curioso = await registerUser(app);
            const res = await request(app).get(`/api/orders/${id}/receipt`).set(bearer(curioso));
            expect(res.status).toBe(403);
        });

        it('rechaza un comprobante que no es imagen', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);

            const res = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
                .set(bearer(buyer))
                .send({ method: 'nequi', receipt: 'data:text/html;base64,PHNjcmlwdD4=' });

            expect(res.status).toBe(400);
        });

        it('el comprobante es opcional: se puede pagar sin el', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);

            const res = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
                .set(bearer(buyer))
                .send({ method: 'nequi', reference: '3001112233' });

            expect(res.status).toBe(200);
            expect(res.body.hasReceipt).toBe(false);
        });

        it('404 si el pedido no tiene comprobante', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);
            const id = order.body.order._id;

            await request(app).post(`/api/orders/${id}/pay`).set(bearer(buyer))
                .send({ method: 'nequi' });

            const res = await request(app).get(`/api/orders/${id}/receipt`).set(bearer(buyer));
            expect(res.status).toBe(404);
        });

        it('las listas de pedidos no arrastran la imagen', async () => {
            const buyer = await registerUser(app);
            const order = await newOrder(buyer);

            await request(app).post(`/api/orders/${order.body.order._id}/pay`)
                .set(bearer(buyer)).send({ method: 'nequi', receipt: PNG_1X1 });

            const mias = await request(app).get('/api/orders/mine').set(bearer(buyer));
            for (const o of mias.body.orders) {
                expect(o.receipt).toBeUndefined();
            }
            expect(mias.body.orders.some((o) => o.hasReceipt)).toBe(true);

            const todas = await request(app).get('/api/orders').set(bearer(admin));
            for (const o of todas.body.orders) {
                expect(o.receipt).toBeUndefined();
            }
        });
    });
});
