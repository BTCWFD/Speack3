// Round-trip tests for the Hermes crypto polyfills (mobile/src/cryptoPolyfill.js).
//
// On-device, Hermes lacks btoa/atob and TextEncoder/TextDecoder, so the app
// ships its own. Under Node those globals already exist, so cryptoPolyfill only
// installs its versions when the global is missing. To test the APP's actual
// polyfill implementations (not Node's natives), we delete the relevant globals,
// re-require the polyfill module so it installs its own, run the round-trip, and
// restore Node's natives afterwards.

const path = require('path');

const POLYFILL_PATH = path.resolve(__dirname, '../src/cryptoPolyfill.js');

// Re-require cryptoPolyfill with the given globals deleted so it installs its
// own polyfilled implementations, then return the freshly-installed globals.
function withAppPolyfills(globalsToDelete, fn) {
    const saved = {};
    for (const name of globalsToDelete) {
        saved[name] = global[name];
        // eslint-disable-next-line no-undef
        delete global[name];
    }
    try {
        jest.resetModules();
        // eslint-disable-next-line global-require
        require(POLYFILL_PATH);
        return fn();
    } finally {
        for (const name of globalsToDelete) {
            global[name] = saved[name];
        }
        jest.resetModules();
    }
}

describe('cryptoPolyfill: btoa/atob', () => {
    test('round-trips ASCII text', () => {
        withAppPolyfills(['btoa', 'atob'], () => {
            const original = 'Hello, Speack3!';
            const encoded = global.btoa(original);
            expect(global.atob(encoded)).toBe(original);
        });
    });

    test('round-trips arbitrary binary bytes (0-255)', () => {
        withAppPolyfills(['btoa', 'atob'], () => {
            // Build a binary (latin1) string covering every byte value, which is
            // the kind of data libsignal ciphertext bodies contain.
            let binary = '';
            for (let i = 0; i < 256; i++) {
                binary += String.fromCharCode(i);
            }
            const encoded = global.btoa(binary);
            const decoded = global.atob(encoded);
            expect(decoded.length).toBe(256);
            for (let i = 0; i < 256; i++) {
                expect(decoded.charCodeAt(i)).toBe(i);
            }
        });
    });

    test('handles padding for lengths not divisible by 3', () => {
        withAppPolyfills(['btoa', 'atob'], () => {
            expect(global.atob(global.btoa('a'))).toBe('a');
            expect(global.atob(global.btoa('ab'))).toBe('ab');
            expect(global.atob(global.btoa('abc'))).toBe('abc');
            expect(global.atob(global.btoa('abcd'))).toBe('abcd');
        });
    });
});

describe('cryptoPolyfill: TextEncoder/TextDecoder', () => {
    test('round-trips ASCII', () => {
        withAppPolyfills(['TextEncoder', 'TextDecoder'], () => {
            const original = 'plain ascii';
            const bytes = new global.TextEncoder().encode(original);
            expect(new global.TextDecoder().decode(bytes)).toBe(original);
        });
    });

    test('round-trips Unicode and emoji', () => {
        withAppPolyfills(['TextEncoder', 'TextDecoder'], () => {
            const original = 'hola 🔒 café — Ñoño 日本語 🚀';
            const bytes = new global.TextEncoder().encode(original);
            expect(bytes).toBeInstanceOf(Uint8Array);
            const decoded = new global.TextDecoder().decode(bytes);
            expect(decoded).toBe(original);
        });
    });

    test('app TextEncoder produces UTF-8 bytes matching Node natives', () => {
        const nodeBytes = Array.from(new TextEncoder().encode('🔒'));
        withAppPolyfills(['TextEncoder', 'TextDecoder'], () => {
            const appBytes = Array.from(new global.TextEncoder().encode('🔒'));
            expect(appBytes).toEqual(nodeBytes);
        });
    });
});

describe('cryptoPolyfill: crypto.subtle installation', () => {
    test('installs a subtle with the operations libsignal needs', () => {
        // setup.js already required cryptoPolyfill, so subtle should be present.
        expect(global.crypto).toBeDefined();
        expect(global.crypto.subtle).toBeDefined();
        expect(typeof global.crypto.subtle.encrypt).toBe('function');
        expect(typeof global.crypto.subtle.decrypt).toBe('function');
        expect(typeof global.crypto.subtle.sign).toBe('function');
        expect(typeof global.crypto.subtle.digest).toBe('function');
    });
});
