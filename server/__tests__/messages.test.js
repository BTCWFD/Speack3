// Require helpers first so NODE_ENV/JWT secrets are set before the app loads.
const { registerUser } = require('./helpers');
const request = require('supertest');
const { app } = require('../server');

// Real messages are created over sockets, so the REST suite only exercises the
// ownership/validation paths reachable via HTTP: 404 for missing records,
// 401/403 for auth/ownership, and request-body validation.

describe('PUT /api/messages/:id (edit)', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app)
            .put('/api/messages/nonexistent-id')
            .send({ encryptedContent: 'updated' });
        expect(res.status).toBe(401);
    });

    it('returns 400 when encryptedContent is missing', async () => {
        const user = await registerUser(app);
        const res = await request(app)
            .put('/api/messages/nonexistent-id')
            .set('Authorization', `Bearer ${user.token}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('returns 404 for a message that does not exist', async () => {
        const user = await registerUser(app);
        const res = await request(app)
            .put('/api/messages/does-not-exist')
            .set('Authorization', `Bearer ${user.token}`)
            .send({ encryptedContent: 'updated' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Message not found');
    });
});

describe('DELETE /api/messages/:id (delete)', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).delete('/api/messages/nonexistent-id');
        expect(res.status).toBe(401);
    });

    it('returns 404 for a message that does not exist', async () => {
        const user = await registerUser(app);
        const res = await request(app)
            .delete('/api/messages/does-not-exist')
            .set('Authorization', `Bearer ${user.token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Message not found');
    });
});
