// Shared test helpers. JWT secrets MUST be set before the app (and its auth
// middleware) is required, so we set them here and require this module first
// from every test file, before `require('../server')`.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';

const request = require('supertest');

let counter = 0;

// Build a valid register body with a unique username/email per call so tests
// never collide on the unique indexes.
function buildUser(overrides = {}) {
    counter += 1;
    const unique = `${Date.now()}_${process.pid}_${counter}`;
    return {
        username: `user_${unique}`.slice(0, 30),
        email: `user_${unique}@example.com`,
        password: 'password123',
        identityKeyPublic: `idkey_${unique}`,
        registrationId: 1000 + counter,
        ...overrides
    };
}

// Register a fresh user and return { body, token, refreshToken, id }.
async function registerUser(app, overrides = {}) {
    const payload = buildUser(overrides);
    const res = await request(app).post('/api/auth/register').send(payload);
    if (res.status !== 201) {
        throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        payload,
        body: res.body,
        token: res.body.token,
        refreshToken: res.body.refreshToken,
        id: res.body.user.id
    };
}

module.exports = { buildUser, registerUser };
