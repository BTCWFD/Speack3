// Jest config for the Speack3 mobile crypto round-trip tests.
//
// These tests exercise the pure-JS crypto chain (cryptoPolyfill, the
// curve25519 adapter, the symmetric group cipher and the Signal 1-to-1
// session) WITHOUT a device. We run in the Node environment because Node 18+
// already provides global.crypto.getRandomValues, TextEncoder/TextDecoder and
// Buffer, which is exactly what the polyfills and the curve need to run.
//
// Native modules (react-native-get-random-values, react-native-keychain,
// @react-native-async-storage/async-storage) are mocked in __tests__/setup.js.

module.exports = {
    testEnvironment: 'node',

    // Only pick up our crypto round-trip tests under __tests__.
    testMatch: ['<rootDir>/__tests__/**/*.test.js'],

    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

    // Map native modules to in-memory mocks so importing the services under
    // test does not pull in real native code.
    moduleNameMapper: {
        '^react-native-get-random-values$':
            '<rootDir>/__tests__/__mocks__/react-native-get-random-values.js',
        '^react-native-keychain$':
            '<rootDir>/__tests__/__mocks__/react-native-keychain.js',
        '^@react-native-async-storage/async-storage$':
            '@react-native-async-storage/async-storage/jest/async-storage-mock',
    },

    // libsignal and curve25519-js ship ES modules / TS-compiled code that needs
    // Babel transpilation; by default node_modules is ignored, so whitelist the
    // crypto packages we import.
    transformIgnorePatterns: [
        'node_modules/(?!(@privacyresearch|curve25519-js)/)',
    ],
};
