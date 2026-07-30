const { registerUser } = require('./helpers');
const request = require('supertest');
const { app } = require('../server');

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });

describe('Dirección favorita', () => {
    it('guarda la dirección y aparece en /api/auth/me', async () => {
        const user = await registerUser(app);

        const res = await request(app).put('/api/users/me/favorite-address')
            .set(bearer(user))
            .send({ lat: 4.65, lng: -74.06, address: 'Casa, torre 3 apto 501' });

        expect(res.status).toBe(200);
        expect(res.body.favoriteAddress.lat).toBe(4.65);

        const me = await request(app).get('/api/auth/me').set(bearer(user));
        expect(me.body.user.favoriteAddress.address).toBe('Casa, torre 3 apto 501');
    });

    it('rechaza coordenadas inválidas', async () => {
        const user = await registerUser(app);
        const res = await request(app).put('/api/users/me/favorite-address')
            .set(bearer(user)).send({ lat: 999, lng: -74 });
        expect(res.status).toBe(400);
    });

    it('se puede borrar', async () => {
        const user = await registerUser(app);
        await request(app).put('/api/users/me/favorite-address')
            .set(bearer(user)).send({ lat: 4.65, lng: -74.06 });

        const del = await request(app).delete('/api/users/me/favorite-address').set(bearer(user));
        expect(del.status).toBe(200);

        const me = await request(app).get('/api/auth/me').set(bearer(user));
        expect(me.body.user.favoriteAddress).toBeNull();
    });

    it('cada usuario solo ve/edita la suya (aislamiento via auth)', async () => {
        const a = await registerUser(app);
        const b = await registerUser(app);

        await request(app).put('/api/users/me/favorite-address')
            .set(bearer(a)).send({ lat: 4.1, lng: -74.1, address: 'De A' });
        await request(app).put('/api/users/me/favorite-address')
            .set(bearer(b)).send({ lat: 4.2, lng: -74.2, address: 'De B' });

        const meA = await request(app).get('/api/auth/me').set(bearer(a));
        const meB = await request(app).get('/api/auth/me').set(bearer(b));

        expect(meA.body.user.favoriteAddress.address).toBe('De A');
        expect(meB.body.user.favoriteAddress.address).toBe('De B');
    });
});
