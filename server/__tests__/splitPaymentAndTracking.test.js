const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'split-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

jest.mock('../services/web3PaymentService', () => ({ verifyTransaction: jest.fn() }));
const web3PaymentService = require('../services/web3PaymentService');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const future = (h = 24) => new Date(Date.now() + h * 3600000).toISOString();

// Un solo admin para todo el archivo: SHOP_ADMIN_EMAIL es una direccion fija,
// asi que registrarla dos veces (una por describe) chocaria con el indice
// unico de correo.
let admin;
beforeAll(async () => {
    admin = await registerUser(app, { email: ADMIN_EMAIL });
});

describe('Pago mixto (efectivo + electronico)', () => {
    let product;

    beforeAll(async () => {
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item split', emoji: '💵', priceCOP: 100000 });
        product = r.body.product;
    });

    const newOrder = async (buyer) =>
        await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

    it('100% electronico sigue funcionando exactamente igual que antes', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);

        const pay = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
            .set(bearer(buyer)).send({ method: 'nequi', reference: '3001112233' });

        expect(pay.status).toBe(200);
        expect(pay.body.order.paymentStatus).toBe('pending');
        expect(pay.body.order.cashCOP).toBe(0);
    });

    it('100% efectivo: queda pendiente sin metodo, y se confirma al entregar', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        const id = order.body.order._id;

        const pay = await request(app).post(`/api/orders/${id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 100000 });

        expect(pay.status).toBe(200);
        expect(pay.body.order.paymentStatus).toBe('pending');
        expect(pay.body.order.paymentMethod).toBeNull();

        const confirmed = await request(app).patch(`/api/orders/${id}/confirm-cash`)
            .set(bearer(admin)).send({ collected: true });

        expect(confirmed.status).toBe(200);
        expect(confirmed.body.order.paymentStatus).toBe('paid');
    });

    it('mixto: mitad efectivo, mitad Nequi. Solo queda pagado cuando las DOS partes estan listas', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        const id = order.body.order._id;

        const pay = await request(app).post(`/api/orders/${id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 40000, method: 'nequi', reference: '3001112233' });

        expect(pay.status).toBe(200);
        expect(pay.body.order.paymentStatus).toBe('pending');

        // Confirma solo la parte Nequi: falta el efectivo, sigue pendiente.
        const soloElectronico = await request(app).patch(`/api/orders/${id}/confirm-payment`)
            .set(bearer(admin)).send({ paid: true });
        expect(soloElectronico.body.order.paymentStatus).toBe('pending');

        // Cobra el efectivo: ahora si queda pagado.
        const conEfectivo = await request(app).patch(`/api/orders/${id}/confirm-cash`)
            .set(bearer(admin)).send({ collected: true });
        expect(conEfectivo.body.order.paymentStatus).toBe('paid');
    });

    it('mixto en el otro orden: cobra el efectivo primero, la confirmacion electronica no lo hace retroceder', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        const id = order.body.order._id;

        await request(app).post(`/api/orders/${id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 40000, method: 'nequi', reference: '3001112233' });

        // Cobra el efectivo primero.
        const conEfectivo = await request(app).patch(`/api/orders/${id}/confirm-cash`)
            .set(bearer(admin)).send({ collected: true });
        expect(conEfectivo.body.order.paymentStatus).toBe('pending');

        // Confirma la parte electronica despues: ahora si queda pagado.
        const final = await request(app).patch(`/api/orders/${id}/confirm-payment`)
            .set(bearer(admin)).send({ paid: true });
        expect(final.body.order.paymentStatus).toBe('paid');

        // Y si el admin luego rechaza la parte electronica, no debe "revivir"
        // el efectivo ya cobrado como si nunca hubiera pasado: el agregado
        // vuelve a pending porque la parte electronica volvio a quedar mal.
        const rechazado = await request(app).patch(`/api/orders/${id}/confirm-payment`)
            .set(bearer(admin)).send({ paid: false });
        expect(rechazado.body.order.paymentStatus).toBe('pending');
    });

    it('rechaza cashCOP mayor al total del pedido', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);

        const res = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 999999 });

        expect(res.status).toBe(400);
    });

    it('exige method cuando queda una parte electronica', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);

        const res = await request(app).post(`/api/orders/${order.body.order._id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 50000 }); // faltan 50000 sin metodo

        expect(res.status).toBe(400);
    });

    it('confirm-cash falla si el pedido no tiene parte en efectivo', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await request(app).post(`/api/orders/${order.body.order._id}/pay`)
            .set(bearer(buyer)).send({ method: 'nequi' });

        const res = await request(app).patch(`/api/orders/${order.body.order._id}/confirm-cash`)
            .set(bearer(admin)).send({ collected: true });

        expect(res.status).toBe(409);
    });

    it('solo el admin puede confirmar el efectivo', async () => {
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        await request(app).post(`/api/orders/${order.body.order._id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 100000 });

        const res = await request(app).patch(`/api/orders/${order.body.order._id}/confirm-cash`)
            .set(bearer(buyer)).send({ collected: true });

        expect(res.status).toBe(403);
    });

    it('cripto mixto: la parte cripto se verifica en la cadena igual que antes', async () => {
        web3PaymentService.verifyTransaction.mockResolvedValueOnce(true);
        const buyer = await registerUser(app);
        const order = await newOrder(buyer);
        const id = order.body.order._id;

        const pay = await request(app).post(`/api/orders/${id}/pay`)
            .set(bearer(buyer)).send({ cashCOP: 30000, method: 'crypto', txHash: '0xabc' });

        expect(pay.status).toBe(200);
        expect(pay.body.order.paymentStatus).toBe('pending'); // falta el efectivo

        const conEfectivo = await request(app).patch(`/api/orders/${id}/confirm-cash`)
            .set(bearer(admin)).send({ collected: true });
        expect(conEfectivo.body.order.paymentStatus).toBe('paid');
    });
});

describe('Seguimiento del domicilio (estado on_the_way)', () => {
    let product;

    beforeAll(async () => {
        const r = await request(app).post('/api/products').set(bearer(admin))
            .send({ name: 'Item tracking', emoji: '🛵', priceCOP: 20000 });
        product = r.body.product;
    });

    it('acepta on_the_way como estado valido y guarda la ubicacion del domiciliario', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        const res = await request(app).patch(`/api/orders/${order.body.order._id}/status`)
            .set(bearer(admin))
            .send({ status: 'on_the_way', courierLocation: { lat: 4.65, lng: -74.06 } });

        expect(res.status).toBe(200);
        expect(res.body.order.status).toBe('on_the_way');
        expect(res.body.order.courierLocation.lat).toBe(4.65);
        expect(res.body.order.statusHistory.map((h) => h.status)).toContain('on_the_way');
    });

    it('on_the_way sin ubicacion tambien es valido (el vendedor puede no compartirla)', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        const res = await request(app).patch(`/api/orders/${order.body.order._id}/status`)
            .set(bearer(admin)).send({ status: 'on_the_way' });

        expect(res.status).toBe(200);
        expect(res.body.order.courierLocation).toBeUndefined();
    });

    it('rechaza coordenadas invalidas', async () => {
        const buyer = await registerUser(app);
        const order = await request(app).post('/api/orders').set(bearer(buyer))
            .send({ items: [{ productId: product._id, qty: 1 }], requestedDeliveryTime: future() });

        const res = await request(app).patch(`/api/orders/${order.body.order._id}/status`)
            .set(bearer(admin))
            .send({ status: 'on_the_way', courierLocation: { lat: 999, lng: -74 } });

        expect(res.status).toBe(400);
    });
});
