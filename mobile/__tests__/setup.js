// Jest setup (setupFilesAfterEach) for the crypto round-trip tests.
//
// Responsibilities:
//   1. Guarantee global.crypto exists (Node 18+ provides it; be defensive).
//   2. Install the app's crypto polyfills (btoa/atob, TextEncoder/TextDecoder
//      and crypto.subtle) by importing ../src/cryptoPolyfill so the services
//      under test behave exactly as they do on-device.
//
// Native modules are mocked via jest.config.js moduleNameMapper, so importing
// cryptoPolyfill (which imports 'react-native-get-random-values') is safe here.

if (typeof global.crypto === 'undefined') {
    // eslint-disable-next-line global-require
    global.crypto = require('crypto').webcrypto;
}

// Some environments expose getRandomValues only on webcrypto; ensure it's
// reachable as global.crypto.getRandomValues (used by signalCurve & group RNG).
if (typeof global.crypto.getRandomValues !== 'function') {
    // eslint-disable-next-line global-require
    const { webcrypto } = require('crypto');
    global.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
}

// Install the app polyfills (btoa/atob, TextEncoder/TextDecoder, crypto.subtle).
// Node already has TextEncoder/TextDecoder/btoa/atob, but cryptoPolyfill only
// installs its versions when missing, and—critically—it installs crypto.subtle
// (AES-CBC / HMAC-SHA256 / SHA-512 via crypto-js) which libsignal needs.
require('../src/cryptoPolyfill');
