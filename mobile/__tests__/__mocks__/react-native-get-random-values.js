// Mock for 'react-native-get-random-values'.
//
// On a device this package installs a secure global.crypto.getRandomValues
// backed by native code. Under Node (test env) global.crypto already exists and
// provides a secure getRandomValues, so this mock is intentionally empty except
// for a defensive guarantee that global.crypto.getRandomValues is present.

if (typeof global.crypto === 'undefined') {
    // Node 18+ exposes the WebCrypto API as global.crypto. Fall back to the
    // node:crypto webcrypto if for some reason it isn't already global.
    // eslint-disable-next-line global-require
    global.crypto = require('crypto').webcrypto;
}

module.exports = {};
