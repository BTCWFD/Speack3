const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'sellers-admin@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');
const { REQUIRED_VERSIONS } = require('../legal/documents');

const asAdmin = (admin) => ({ Authorization: `Bearer ${admin.token}` });

describe('Alta de vendedores', () => {
    let admin;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
    });

    it('los documentos legales se pueden leer sin estar autenticado', async () => {
        const list = await request(app).get('/api/legal');
        expect(list.status).toBe(200);
        expect(list.body.documents.map((d) => d.id).sort()).toEqual(['privacy', 'terms']);

        const terms = await request(app).get('/api/legal/terms');
        expect(terms.status).toBe(200);
        expect(terms.body.document.body.length).toBeGreaterThan(100);
    });

    it('solo el admin puede habilitar vendedores', async () => {
        const buyer = await registerUser(app);
        const victim = await registerUser(app);

        const res = await request(app)
            .post('/api/sellers')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ email: victim.payload.email, services: ['catalogo'] });

        expect(res.status).toBe(403);
    });

    it('no habilita a alguien que no se ha registrado', async () => {
        const res = await request(app)
            .post('/api/sellers')
            .set(asAdmin(admin))
            .send({ email: 'fantasma@speack3.test', services: ['catalogo'] });

        expect(res.status).toBe(404);
        expect(res.body.reason).toBe('user_not_found');
    });

    it('exige indicar al menos un servicio valido', async () => {
        const candidate = await registerUser(app);

        const sinServicios = await request(app)
            .post('/api/sellers').set(asAdmin(admin))
            .send({ email: candidate.payload.email });
        expect(sinServicios.status).toBe(400);

        const invalido = await request(app)
            .post('/api/sellers').set(asAdmin(admin))
            .send({ email: candidate.payload.email, services: ['contrabando'] });
        expect(invalido.status).toBe(400);
        expect(invalido.body.validServices.length).toBeGreaterThan(0);
    });

    it('habilita un vendedor con sus servicios, pendiente de aceptar los documentos', async () => {
        const candidate = await registerUser(app);

        const res = await request(app)
            .post('/api/sellers').set(asAdmin(admin))
            .send({ email: candidate.payload.email, services: ['catalogo', 'domicilios'] });

        expect(res.status).toBe(201);
        expect(res.body.seller.role).toBe('seller');
        expect(res.body.seller.services).toEqual(['catalogo', 'domicilios']);
        // Aun no acepto nada, asi que no deberia poder operar todavia.
        expect(res.body.pendingLegalAcceptance).toBe(true);
        expect(res.body.seller.legalUpToDate).toBe(false);
    });

    it('un vendedor no puede vender hasta aceptar terminos y privacidad', async () => {
        const candidate = await registerUser(app);
        await request(app)
            .post('/api/sellers').set(asAdmin(admin))
            .send({ email: candidate.payload.email, services: ['catalogo'] });

        // Aceptar solo los terminos no alcanza: falta la politica de privacidad.
        const parcial = await request(app)
            .post('/api/legal/accept')
            .set('Authorization', `Bearer ${candidate.token}`)
            .send({ accept: [{ id: 'terms', version: REQUIRED_VERSIONS.terms }] });
        expect(parcial.status).toBe(200);

        const sellers = await request(app).get('/api/sellers').set(asAdmin(admin));
        const yo = sellers.body.sellers.find((s) => s.email === candidate.payload.email.toLowerCase());
        expect(yo.legalUpToDate).toBe(false);

        // Con ambos aceptados, ya queda al dia.
        await request(app)
            .post('/api/legal/accept')
            .set('Authorization', `Bearer ${candidate.token}`)
            .send({ accept: [{ id: 'privacy', version: REQUIRED_VERSIONS.privacy }] });

        const after = await request(app).get('/api/sellers').set(asAdmin(admin));
        const actualizado = after.body.sellers.find((s) => s.email === candidate.payload.email.toLowerCase());
        expect(actualizado.legalUpToDate).toBe(true);
    });

    it('rechaza aceptar una version que no es la vigente', async () => {
        const user = await registerUser(app);
        const res = await request(app)
            .post('/api/legal/accept')
            .set('Authorization', `Bearer ${user.token}`)
            .send({ accept: [{ id: 'terms', version: 999 }] });

        expect(res.status).toBe(409);
        expect(res.body.currentVersion).toBe(REQUIRED_VERSIONS.terms);
    });

    it('el admin puede suspender, cambiar servicios y retirar el rol', async () => {
        const candidate = await registerUser(app);
        const created = await request(app)
            .post('/api/sellers').set(asAdmin(admin))
            .send({ email: candidate.payload.email, services: ['catalogo'] });
        const id = created.body.seller.id;

        const suspended = await request(app)
            .patch(`/api/sellers/${id}`).set(asAdmin(admin))
            .send({ active: false });
        expect(suspended.body.seller.sellerActive).toBe(false);

        const reServiced = await request(app)
            .patch(`/api/sellers/${id}`).set(asAdmin(admin))
            .send({ services: ['domicilios', 'mayorista'] });
        expect(reServiced.body.seller.services).toEqual(['domicilios', 'mayorista']);

        const removed = await request(app)
            .delete(`/api/sellers/${id}`).set(asAdmin(admin));
        expect(removed.status).toBe(200);

        const list = await request(app).get('/api/sellers').set(asAdmin(admin));
        expect(list.body.sellers.find((s) => s.id === id)).toBeUndefined();
    });

    it('el listado de vendedores nunca expone contrasenas', async () => {
        const res = await request(app).get('/api/sellers').set(asAdmin(admin));
        expect(res.status).toBe(200);
        for (const s of res.body.sellers) {
            expect(s.password).toBeUndefined();
        }
    });

    it('expone el catalogo de servicios asignables', async () => {
        const res = await request(app).get('/api/sellers/services').set(asAdmin(admin));
        expect(res.status).toBe(200);
        expect(res.body.services.map((s) => s.id)).toContain('catalogo');
        for (const s of res.body.services) {
            expect(typeof s.label).toBe('string');
        }
    });
});
