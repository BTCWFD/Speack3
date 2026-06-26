// WebCrypto polyfill for React Native / Hermes.
//
// @privacyresearch/libsignal-protocol-typescript reads `globalThis.crypto` at
// module load; if absent it falls back to a bundled `msrcrypto` that crashes in
// Hermes ("Cannot read property 'prototype' of undefined"). We provide a working
// `crypto` global BEFORE that library loads:
//   - getRandomValues: secure native source (react-native-get-random-values)
//   - subtle: the exact subset the library uses (AES-CBC, HMAC-SHA256, SHA-512),
//     backed by crypto-js.
//
// IMPORTANT: this file must be imported FIRST in index.js, before App/SignalService.

import 'react-native-get-random-values';
import CryptoJS from 'crypto-js';

// ---- ArrayBuffer/TypedArray <-> CryptoJS WordArray ----
function toU8(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    return new Uint8Array(x);
}

function toWordArray(x) {
    const u8 = toU8(x);
    const words = [];
    for (let i = 0; i < u8.length; i++) {
        words[i >>> 2] |= u8[i] << (24 - (i % 4) * 8);
    }
    return CryptoJS.lib.WordArray.create(words, u8.length);
}

function wordArrayToArrayBuffer(wa) {
    const { words, sigBytes } = wa;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8.buffer;
}

// A minimal SubtleCrypto implementing only what libsignal calls.
const subtle = {
    // Returns an opaque key object holding the raw key material.
    async importKey(_format, keyData, algorithm /*, extractable, usages */) {
        return { raw: toWordArray(keyData), algorithm };
    },

    async encrypt(algorithm, key, data) {
        // AES-CBC, PKCS7 padding (matches WebCrypto AES-CBC)
        const cfg = {
            iv: toWordArray(algorithm.iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        };
        const out = CryptoJS.AES.encrypt(toWordArray(data), key.raw, cfg);
        return wordArrayToArrayBuffer(out.ciphertext);
    },

    async decrypt(algorithm, key, data) {
        const cfg = {
            iv: toWordArray(algorithm.iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        };
        const params = CryptoJS.lib.CipherParams.create({ ciphertext: toWordArray(data) });
        const out = CryptoJS.AES.decrypt(params, key.raw, cfg);
        return wordArrayToArrayBuffer(out);
    },

    async sign(_algorithm, key, data) {
        // HMAC-SHA256
        const mac = CryptoJS.HmacSHA256(toWordArray(data), key.raw);
        return wordArrayToArrayBuffer(mac);
    },

    async digest(_algorithm, data) {
        // libsignal only requests SHA-512
        const hash = CryptoJS.SHA512(toWordArray(data));
        return wordArrayToArrayBuffer(hash);
    }
};

// react-native-get-random-values created global.crypto with getRandomValues.
// Attach our subtle so libsignal sees a complete WebCrypto.
if (typeof global.crypto === 'undefined') {
    global.crypto = {};
}
if (!global.crypto.subtle) {
    global.crypto.subtle = subtle;
}

export default global.crypto;
