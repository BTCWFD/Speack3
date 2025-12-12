// API Configuration
// TODO: Update these with your server's IP address
export const API_URL = __DEV__
    ? 'http://10.68.77.175:3000'  // Change to your local IP
    : 'https://your-production-server.com';

export const WS_URL = __DEV__
    ? 'ws://10.68.77.175:3000'    // Change to your local IP
    : 'wss://your-production-server.com';

export const API_TIMEOUT = 10000;
