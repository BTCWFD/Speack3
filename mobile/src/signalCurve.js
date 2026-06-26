// Pure-JS Curve25519 backend for libsignal, compatible with React Native/Hermes.
//
// The default curve in @privacyresearch/libsignal-protocol-typescript is an
// Emscripten (WASM/asm.js) module that fails to initialize under Hermes
// ("Cannot read property 'prototype' of undefined"), so all key generation /
// signing crashes. We replace it via the library's setCurve() with curve25519-js
// (a pure-JS port of curve25519-donna + XEdDSA) that runs fine in Hermes.
//
// Must be imported at startup, before any Signal key operations.

import { setCurve } from '@privacyresearch/libsignal-protocol-typescript';
import * as curve from 'curve25519-js';

const toU8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
// Always return a fresh, exact-length ArrayBuffer.
const abOf = (u8) => new Uint8Array(u8).buffer;

const rand64 = () => {
    const r = new Uint8Array(64);
    (global.crypto || globalThis.crypto).getRandomValues(r);
    return r;
};

// Implements the interface libsignal's AsyncCurve expects from its _curve25519.
const adapter = {
    // privKey: ArrayBuffer(32) -> { pubKey: ArrayBuffer(32), privKey: ArrayBuffer(32) }
    keyPair(privKey) {
        const kp = curve.generateKeyPair(toU8(privKey));
        return { pubKey: abOf(kp.public), privKey: abOf(kp.private) };
    },

    // (theirPub, myPriv) -> ArrayBuffer(32)
    sharedSecret(pubKey, privKey) {
        return abOf(curve.sharedKey(toU8(privKey), toU8(pubKey)));
    },

    // (myPriv, message) -> ArrayBuffer(64)  (XEdDSA)
    sign(privKey, message) {
        return abOf(curve.sign(toU8(privKey), toU8(message), rand64()));
    },

    // libsignal's Ed25519Verify treats a TRUTHY result as INVALID (donna
    // convention), whereas curve25519-js returns TRUE for a VALID signature.
    // So invert: return false (valid) / true (invalid).
    verify(pubKey, message, sig) {
        return !curve.verify(toU8(pubKey), toU8(message), toU8(sig));
    }
};

setCurve(adapter);

export default adapter;
