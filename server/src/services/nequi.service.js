const env = require('../config/env');

class NequiService {
    constructor() {
        this.baseUrl = env.NEQUI.BASE_URL;
        this.apiKey = env.NEQUI.API_KEY;
    }

    async authenticate() {
        console.log('Authenticating with Nequi Sandbox...');
        // Simulando llamada OAuth2
        return { token: 'mock_nequi_token', expiresIn: 3600 };
    }

    async createPaymentIntent(phoneNumber, amount) {
        console.log(`[NEQUI] Creating push payment for ${phoneNumber} - Amount: ${amount}`);
        // Simulando petición a API Nequi
        return {
            status: 'PENDING',
            transactionId: 'NQX-' + Math.floor(Math.random() * 1000000),
            message: 'Push notification sent to user app'
        };
    }
}

module.exports = new NequiService();
