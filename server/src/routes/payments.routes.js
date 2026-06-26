const express = require('express');
const router = express.Router();
const nequiService = require('../services/nequi.service');
const weniaService = require('../services/wenia.service');

router.post('/nequi', async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        // Integración con servicio real (Sandbox Nequi)
        const paymentIntent = await nequiService.createPaymentIntent(phoneNumber, amount || 20000);
        res.json({ success: true, method: 'nequi', paymentIntent });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/usdt', async (req, res) => {
    try {
        const { userId, amountUSDT } = req.body;
        // Integración con servicio real Wenia (Web3)
        const paymentIntent = await weniaService.createCryptoPaymentIntent(amountUSDT || 5, userId || 'anon');
        res.json({ success: true, method: 'usdt', paymentIntent });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
