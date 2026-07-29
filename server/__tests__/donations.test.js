const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'donations-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');

jest.mock('../services/web3PaymentService', () => ({ verifyTransaction: jest.fn() }));
const web3PaymentService = require('../services/web3PaymentService');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });

describe('Aportes voluntarios de vendedores', () => {
    let admin;
    let sellerUser;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });

        // El admin registra a donde llegan los aportes.
        await request(app).put('/api/payout-methods/mine').set(bearer(admin))
            .send({ nequi: '3009998877' });

        // Un vendedor habilitado y al dia con los documentos.
        sellerUser = await registerUser(app);
        await request(app).post('/api/sellers').set(bearer(admin))
            .send({ email: sellerUser.payload.email, services: ['catalogo'] });

        const docs = await request(app).get('/api/legal');
        await request(app).post('/api/legal/accept').set(bearer(sellerUser))
            .send({ accept: docs.body.documents.map((d) => ({ id: d.id, version: d.version })) });
    });

    it('un comprador cualquiera no ve la seccion de aportes', async () => {
        const buyer = await registerUser(app);
        const res = await request(app).get('/api/donations/info').set(bearer(buyer));
        expect(res.status).toBe(403);
    });

    it('el vendedor ve a donde aportar, marcado como voluntario', async () => {
        const res = await request(app).get('/api/donations/info').set(bearer(sellerUser));
        expect(res.status).toBe(200);
        expect(res.body.voluntary).toBe(true);
        expect(res.body.payTo.nequi).toBe('3009998877');
        expect(res.body.suggestedCOP.length).toBeGreaterThan(0);
    });

    it('reporta un aporte por Nequi y queda pendiente de confirmar', async () => {
        const res = await request(app).post('/api/donations').set(bearer(sellerUser))
            .send({ amountCOP: 20000, method: 'nequi', reference: '3001234567' });

        expect(res.status).toBe(201);
        expect(res.body.donation.status).toBe('reported');
        expect(res.body.donation.amountCOP).toBe(20000);
    });

    it('un aporte en cripto se verifica en la cadena y queda confirmado', async () => {
        web3PaymentService.verifyTransaction.mockResolvedValueOnce(true);

        const res = await request(app).post('/api/donations').set(bearer(sellerUser))
            .send({ amountCOP: 50000, method: 'crypto', txHash: '0xabc' });

        expect(res.status).toBe(201);
        expect(res.body.donation.status).toBe('confirmed');
    });

    it('rechaza un aporte en cripto cuya transaccion no existe', async () => {
        web3PaymentService.verifyTransaction.mockResolvedValueOnce(false);

        const res = await request(app).post('/api/donations').set(bearer(sellerUser))
            .send({ amountCOP: 10000, method: 'crypto', txHash: '0xfalso' });

        expect(res.status).toBe(400);
    });

    it('rechaza montos invalidos', async () => {
        const res = await request(app).post('/api/donations').set(bearer(sellerUser))
            .send({ amountCOP: 0, method: 'nequi' });
        expect(res.status).toBe(400);
    });

    it('el total solo cuenta lo confirmado, no lo meramente reportado', async () => {
        const list = await request(app).get('/api/donations').set(bearer(admin));
        expect(list.status).toBe(200);

        const confirmados = list.body.donations
            .filter((d) => d.status === 'confirmed')
            .reduce((s, d) => s + d.amountCOP, 0);

        expect(list.body.confirmedTotalCOP).toBe(confirmados);
        // Hay al menos un aporte reportado sin confirmar que NO debe sumar.
        expect(list.body.donations.some((d) => d.status === 'reported')).toBe(true);
    });

    it('el admin confirma un aporte reportado y entonces si suma', async () => {
        const before = await request(app).get('/api/donations').set(bearer(admin));
        const pendiente = before.body.donations.find((d) => d.status === 'reported');
        const totalAntes = before.body.confirmedTotalCOP;

        const res = await request(app).patch(`/api/donations/${pendiente._id}`)
            .set(bearer(admin)).send({ status: 'confirmed' });
        expect(res.status).toBe(200);

        const after = await request(app).get('/api/donations').set(bearer(admin));
        expect(after.body.confirmedTotalCOP).toBe(totalAntes + pendiente.amountCOP);
    });

    it('solo el admin puede ver todos los aportes o confirmarlos', async () => {
        const listado = await request(app).get('/api/donations').set(bearer(sellerUser));
        expect(listado.status).toBe(403);
    });

    it('no aportar no limita en nada al vendedor', async () => {
        // Un vendedor recien habilitado, sin ningun aporte, puede operar igual.
        const nuevo = await registerUser(app);
        await request(app).post('/api/sellers').set(bearer(admin))
            .send({ email: nuevo.payload.email, services: ['catalogo'] });

        const docs = await request(app).get('/api/legal');
        await request(app).post('/api/legal/accept').set(bearer(nuevo))
            .send({ accept: docs.body.documents.map((d) => ({ id: d.id, version: d.version })) });

        const misDonaciones = await request(app).get('/api/donations/mine').set(bearer(nuevo));
        expect(misDonaciones.body.donations).toHaveLength(0);

        // Sin haber aportado nada, sigue pudiendo usar funciones de vendedor.
        const payout = await request(app).put('/api/payout-methods/mine')
            .set(bearer(nuevo)).send({ nequi: '3007776655' });
        expect(payout.status).toBe(200);
    });
});
