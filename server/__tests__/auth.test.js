// Require helpers first: it sets NODE_ENV=test and the JWT secrets before the
// app/auth middleware are loaded.
const { buildUser, registerUser } = require('./helpers');
const request = require('supertest');
const { app } = require('../server');

describe('POST /api/auth/register', () => {
    it('registers a new user and returns user, token and refreshToken', async () => {
        const payload = buildUser();
        const res = await request(app).post('/api/auth/register').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.id).toBeDefined();
        expect(res.body.user.username).toBe(payload.username);
        expect(res.body.user.email).toBe(payload.email.toLowerCase());
        expect(typeof res.body.token).toBe('string');
        expect(typeof res.body.refreshToken).toBe('string');
        // Password must never be echoed back.
        expect(res.body.user.password).toBeUndefined();
    });

    it('rejects a weak (too short) password with 400', async () => {
        const payload = buildUser({ password: '123' });
        const res = await request(app).post('/api/auth/register').send(payload);

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('rejects a duplicate user with 400', async () => {
        const first = await registerUser(app);
        // Re-send the exact same payload -> same email + username already exist.
        const res = await request(app).post('/api/auth/register').send(first.payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('User already exists');
    });
});

describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
        const { payload } = await registerUser(app);
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: payload.email, password: payload.password });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
        expect(res.body.user.email).toBe(payload.email.toLowerCase());
    });

    it('rejects a wrong password with 401', async () => {
        const { payload } = await registerUser(app);
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: payload.email, password: 'wrong-password' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });
});

describe('POST /api/auth/refresh', () => {
    it('returns a new access token from a valid refresh token', async () => {
        const { refreshToken } = await registerUser(app);
        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken });

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
    });

    it('rejects a missing refresh token with 401', async () => {
        const res = await request(app).post('/api/auth/refresh').send({});
        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('returns the current user when authenticated', async () => {
        const { token, payload } = await registerUser(app);
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.username).toBe(payload.username);
    });

    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});
