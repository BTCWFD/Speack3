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
 * DRAFT / NOT YET DEVICE-VERIFIED. Limitations:
 *  - crypto-js's RNG is not a hardware CSPRNG. A production build should use a
 *    platform secure-random source (and ideally true Signal "sender keys").
 *  - No forward secrecy per message and no automatic re-key on membership
 *    change yet.
 * See docs/GROUP_ENCRYPTION_DESIGN.md.
 */

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

const generateGroupKey = () =>
    CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64);

const encrypt = (plaintext, keyB64) => {
    const { encKey, macKey } = deriveKeys(keyB64);
    const iv = CryptoJS.lib.WordArray.random(16);
    const cipher = CryptoJS.AES.encrypt(plaintext, encKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    const ivB64 = iv.toString(CryptoJS.enc.Base64);
    const ctB64 = cipher.ciphertext.toString(CryptoJS.enc.Base64);
    const mac = CryptoJS.HmacSHA256(`${ivB64}.${ctB64}`, macKey).toString(
        CryptoJS.enc.Base64
    );
    return JSON.stringify({ v: 1, iv: ivB64, ct: ctB64, mac });
};

const decrypt = (payloadStr, keyB64) => {
    const { encKey, macKey } = deriveKeys(keyB64);
    const { iv, ct, mac } = JSON.parse(payloadStr);

    const expectedMac = CryptoJS.HmacSHA256(`${iv}.${ct}`, macKey).toString(
        CryptoJS.enc.Base64
    );
    if (expectedMac !== mac) {
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
        return o && o.v === 1 && o.iv && o.ct && o.mac;
    } catch {
        return false;
    }
};

export default { generateGroupKey, encrypt, decrypt, isGroupPayload };
