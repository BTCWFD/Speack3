import CryptoJS from 'crypto-js';

/**
 * Symmetric group-message encryption (interim scheme).
 *
 * Each group has a random 32-byte key. Messages are encrypted with
 * AES-256-CBC and authenticated with HMAC-SHA256 (encrypt-then-MAC). The
 * master key is split into independent encryption/MAC subkeys via SHA-256
 * domain separation. The key itself is distributed to members over their
 * pairwise Signal sessions (see SocketService.distributeGroupKey).
 *
 * Randomness: the group key and per-message IVs are drawn from the platform
 * CSPRNG via `global.crypto.getRandomValues` (provided on-device by
 * react-native-get-random-values; see mobile/src/cryptoPolyfill.js). We do NOT
 * use crypto-js's `WordArray.random`, whose RNG falls back to Math.random and
 * is therefore not cryptographically secure.
 *
 * DRAFT / NOT YET DEVICE-VERIFIED (group path). Limitations that remain even
 * with secure randomness:
 *  - It is still a *static* symmetric key: no per-message forward secrecy and
 *    no automatic re-key when a member leaves (a removed member who kept the
 *    key can still read future traffic). This is NOT Signal "sender keys".
 *  - The key is only as good as its pairwise-Signal distribution path.
 * See docs/GROUP_ENCRYPTION_DESIGN.md.
 */

// Protocol version embedded in every payload and folded into the MAC.
const VERSION = 1;

/**
 * Cryptographically-secure random bytes as a CryptoJS WordArray.
 *
 * Fills a Uint8Array from the platform CSPRNG (global.crypto.getRandomValues)
 * and packs it into a WordArray. Throws if no secure RNG is available rather
 * than silently degrading to an insecure source.
 */
const secureRandomWordArray = (byteLength) => {
    if (
        typeof global === 'undefined' ||
        !global.crypto ||
        typeof global.crypto.getRandomValues !== 'function'
    ) {
        throw new Error(
            'Secure RNG unavailable: global.crypto.getRandomValues is missing ' +
            '(import cryptoPolyfill / react-native-get-random-values first)'
        );
    }
    const bytes = new Uint8Array(byteLength);
    global.crypto.getRandomValues(bytes);
    const words = [];
    for (let i = 0; i < bytes.length; i++) {
        words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
    }
    return CryptoJS.lib.WordArray.create(words, bytes.length);
};

const deriveKeys = (keyB64) => {
    const master = CryptoJS.enc.Base64.parse(keyB64);
    const encKey = CryptoJS.SHA256(
        master.clone().concat(CryptoJS.enc.Utf8.parse('speack3-enc'))
    );
    const macKey = CryptoJS.SHA256(
        master.clone().concat(CryptoJS.enc.Utf8.parse('speack3-mac'))
    );
    return { encKey, macKey };
};

// Authenticated bytes for the MAC. The version is bound in so a payload signed
// for one protocol version can't be reinterpreted under another (context
// confusion). Field order/separators are fixed and shared by encrypt/decrypt.
const macInput = (version, ivB64, ctB64) => `${version}.${ivB64}.${ctB64}`;

// Constant-time-ish comparison of two base64 MAC strings. Avoids the early-out
// of `===` (which can leak how many leading bytes matched). Note: this is JS in
// Hermes, so true constant time isn't guaranteed, but it removes the obvious
// data-dependent short-circuit.
const macEquals = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
};

const generateGroupKey = () =>
    secureRandomWordArray(32).toString(CryptoJS.enc.Base64);

const encrypt = (plaintext, keyB64) => {
    const { encKey, macKey } = deriveKeys(keyB64);
    const iv = secureRandomWordArray(16);
    const cipher = CryptoJS.AES.encrypt(plaintext, encKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    const ivB64 = iv.toString(CryptoJS.enc.Base64);
    const ctB64 = cipher.ciphertext.toString(CryptoJS.enc.Base64);
    const mac = CryptoJS.HmacSHA256(
        macInput(VERSION, ivB64, ctB64),
        macKey
    ).toString(CryptoJS.enc.Base64);
    return JSON.stringify({ v: VERSION, iv: ivB64, ct: ctB64, mac });
};

const decrypt = (payloadStr, keyB64) => {
    const { encKey, macKey } = deriveKeys(keyB64);
    const { v, iv, ct, mac } = JSON.parse(payloadStr);

    // Bind the payload's declared version into the verification. A tampered or
    // foreign version yields a different expected MAC and fails closed.
    const expectedMac = CryptoJS.HmacSHA256(
        macInput(v, iv, ct),
        macKey
    ).toString(CryptoJS.enc.Base64);
    if (!macEquals(expectedMac, mac)) {
        throw new Error('Group message MAC verification failed');
    }

    const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(ct)
    });
    const plaintext = CryptoJS.AES.decrypt(cipherParams, encKey, {
        iv: CryptoJS.enc.Base64.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return plaintext.toString(CryptoJS.enc.Utf8);
};

// True if a string looks like one of our group-cipher payloads.
const isGroupPayload = (str) => {
    try {
        const o = JSON.parse(str);
        return o && o.v === VERSION && o.iv && o.ct && o.mac;
    } catch {
        return false;
    }
};

export default { generateGroupKey, encrypt, decrypt, isGroupPayload };
