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

// Hermes has no btoa/atob (used by SignalService for base64). Polyfill them
// (binary-string safe, charCodes 0-255).
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
if (typeof global.btoa === 'undefined') {
    global.btoa = (input) => {
        const str = String(input);
        let output = '';
        for (let i = 0; i < str.length; i += 3) {
            const c1 = str.charCodeAt(i);
            const c2 = str.charCodeAt(i + 1);
            const c3 = str.charCodeAt(i + 2);
            const e1 = c1 >> 2;
            const e2 = ((c1 & 3) << 4) | (c2 >> 4);
            let e3 = ((c2 & 15) << 2) | (c3 >> 6);
            let e4 = c3 & 63;
            if (isNaN(c2)) { e3 = 64; e4 = 64; }
            else if (isNaN(c3)) { e4 = 64; }
            output += B64_CHARS.charAt(e1) + B64_CHARS.charAt(e2) +
                (e3 === 64 ? '=' : B64_CHARS.charAt(e3)) +
                (e4 === 64 ? '=' : B64_CHARS.charAt(e4));
        }
        return output;
    };
}
if (typeof global.atob === 'undefined') {
    global.atob = (input) => {
        const str = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
        let output = '';
        for (let i = 0; i < str.length; i += 4) {
            const e1 = B64_CHARS.indexOf(str.charAt(i));
            const e2 = B64_CHARS.indexOf(str.charAt(i + 1));
            const e3 = B64_CHARS.indexOf(str.charAt(i + 2));
            const e4 = B64_CHARS.indexOf(str.charAt(i + 3));
            output += String.fromCharCode((e1 << 2) | (e2 >> 4));
            if (e3 !== 64 && e3 >= 0) output += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
            if (e4 !== 64 && e4 >= 0) output += String.fromCharCode(((e3 & 3) << 6) | e4);
        }
        return output;
    };
}

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
