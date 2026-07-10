// API Configuration
//
// Single source of truth for the backend host. Override SERVER_HOST with the
// LAN IP of the machine running the server when testing on a physical device
// (e.g. '192.168.1.50'). 'localhost' only works on an emulator that shares the
// host network. For production, set PROD_HOST to your deployed domain.
//
// NOTE: this is intentionally a build-time constant. A proper setup should read
// these from react-native-config / .env so secrets and hosts are not committed
// (tracked as a follow-up hardening task).

const SERVER_HOST = '192.168.1.9'; // <-- change to your server's LAN IP for device testing
const SERVER_PORT = 3000;
const PROD_HOST = '192.168.1.9'; // <-- change before release

export const API_URL = 'https://speack3app.loca.lt';

export const WS_URL = 'wss://speack3app.loca.lt';

export const API_TIMEOUT = 10000;
