// Round-trip tests for the symmetric group cipher (mobile/src/services/
// GroupCryptoService.js): AES-256-CBC encrypt-then-MAC (HMAC-SHA256) with a
// random 32-byte group key. These tests assert BEHAVIOUR (round-trip + MAC
// rejection), not internal layout, so they survive internal refactors.
//
// GroupCryptoService draws randomness from global.crypto.getRandomValues, which
// __tests__/setup.js guarantees exists.

const GroupCryptoService = require('../src/services/GroupCryptoService').default;

describe('GroupCryptoService round-trip', () => {
    test('generateGroupKey returns a 32-byte base64 key', () => {
        const key = GroupCryptoService.generateGroupKey();
        expect(typeof key).toBe('string');
        // 32 bytes -> 44 base64 chars (with padding).
        const raw = Buffer.from(key, 'base64');
        expect(raw.length).toBe(32);
    });

    test('two generated keys differ (randomness wired up)', () => {
        expect(GroupCryptoService.generateGroupKey())
            .not.toBe(GroupCryptoService.generateGroupKey());
    });

    test('encrypt -> decrypt returns the original plaintext', () => {
        const key = GroupCryptoService.generateGroupKey();
        const msg = 'Reunión del equipo a las 5pm';
        const payload = GroupCryptoService.encrypt(msg, key);
        expect(GroupCryptoService.decrypt(payload, key)).toBe(msg);
    });

    test('round-trips Unicode and emoji', () => {
        const key = GroupCryptoService.generateGroupKey();
        const msg = 'hola 🔒 café — Ñoño 日本語 🚀';
        const payload = GroupCryptoService.encrypt(msg, key);
        expect(GroupCryptoService.decrypt(payload, key)).toBe(msg);
    });

    test('produces a recognizable group payload', () => {
        const key = GroupCryptoService.generateGroupKey();
        const payload = GroupCryptoService.encrypt('x', key);
        // isGroupPayload returns a truthy value (not strictly boolean true) for
        // a valid payload, and a falsy value otherwise.
        expect(GroupCryptoService.isGroupPayload(payload)).toBeTruthy();
        expect(GroupCryptoService.isGroupPayload('not-a-payload')).toBeFalsy();
    });

    test('different IVs: encrypting the same message twice differs', () => {
        const key = GroupCryptoService.generateGroupKey();
        const a = GroupCryptoService.encrypt('same', key);
        const b = GroupCryptoService.encrypt('same', key);
        expect(a).not.toBe(b);
        // ...but both decrypt to the same plaintext.
        expect(GroupCryptoService.decrypt(a, key)).toBe('same');
        expect(GroupCryptoService.decrypt(b, key)).toBe('same');
    });

    test('decrypt with the wrong key fails (MAC rejection)', () => {
        const key = GroupCryptoService.generateGroupKey();
        const wrongKey = GroupCryptoService.generateGroupKey();
        const payload = GroupCryptoService.encrypt('secret', key);
        expect(() => GroupCryptoService.decrypt(payload, wrongKey)).toThrow();
    });

    test('tampered ciphertext is rejected by the MAC', () => {
        const key = GroupCryptoService.generateGroupKey();
        const payload = JSON.parse(GroupCryptoService.encrypt('secret', key));

        // Flip a byte in the ciphertext.
        const ctBytes = Buffer.from(payload.ct, 'base64');
        ctBytes[0] ^= 0xff;
        payload.ct = ctBytes.toString('base64');

        expect(() => GroupCryptoService.decrypt(JSON.stringify(payload), key))
            .toThrow(/MAC/i);
    });

    test('tampered MAC is rejected', () => {
        const key = GroupCryptoService.generateGroupKey();
        const payload = JSON.parse(GroupCryptoService.encrypt('secret', key));

        const macBytes = Buffer.from(payload.mac, 'base64');
        macBytes[0] ^= 0xff;
        payload.mac = macBytes.toString('base64');

        expect(() => GroupCryptoService.decrypt(JSON.stringify(payload), key))
            .toThrow(/MAC/i);
    });

    test('tampered version is rejected (version bound into MAC)', () => {
        const key = GroupCryptoService.generateGroupKey();
        const payload = JSON.parse(GroupCryptoService.encrypt('secret', key));
        payload.v = 999;
        expect(() => GroupCryptoService.decrypt(JSON.stringify(payload), key))
            .toThrow(/MAC/i);
    });
});
