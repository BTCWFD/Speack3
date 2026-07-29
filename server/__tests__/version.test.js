const request = require('supertest');
const { app } = require('../server');

describe('GET /api/version', () => {
    it('returns the version manifest the app polls for updates', async () => {
        const res = await request(app).get('/api/version');

        expect(res.status).toBe(200);
        expect(typeof res.body.versionCode).toBe('number');
        expect(typeof res.body.versionName).toBe('string');
        expect(typeof res.body.apkUrl).toBe('string');
    });
});
