require('dotenv').config();

module.exports = {
  NEQUI: {
    API_KEY: process.env.NEQUI_API_KEY || 'sandbox_api_key',
    CLIENT_ID: process.env.NEQUI_CLIENT_ID || 'sandbox_client_id',
    CLIENT_SECRET: process.env.NEQUI_CLIENT_SECRET || 'sandbox_secret',
    BASE_URL: process.env.NEQUI_BASE_URL || 'https://api-sandbox.nequi.com'
  },
  WENIA: {
    API_KEY: process.env.WENIA_API_KEY || 'wenia_sandbox_key',
    WALLET_ADDRESS: process.env.WENIA_WALLET_ADDRESS || '0xWeniaTargetAddress'
  },
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE'
  }
};
