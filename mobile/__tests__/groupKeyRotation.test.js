// Unit tests for SocketService.rotateGroupKey (mobile/src/services/
// SocketService.js): the fix for the "removed member keeps decrypting
// future group traffic" gap called out in docs/GROUP_ENCRYPTION_DESIGN.md.
//
// distributeGroupKey (the pairwise-Signal fan-out) is stubbed out here so
// these tests isolate the rotation *decision* — a fresh key is generated,
// persisted locally, and handed only to the remaining members — from the
// unrelated concern of Signal session/encryption plumbing.

const StorageService = require('../src/services/StorageService').default;
const SocketService = require('../src/services/SocketService').default;

describe('SocketService.rotateGroupKey', () => {
    const groupId = 'group-1';

    beforeEach(async () => {
        await StorageService.saveGroupKey(groupId, 'old-key-placeholder');
        SocketService.distributeGroupKey = jest.fn().mockResolvedValue(undefined);
    });

    test('replaces the locally stored key with a new one', async () => {
        const before = await StorageService.getGroupKey(groupId);
        const rotated = await SocketService.rotateGroupKey(groupId, ['member-a', 'member-b']);
        const after = await StorageService.getGroupKey(groupId);

        expect(rotated).not.toBe(before);
        expect(after).toBe(rotated);
    });

    test('distributes the new key only to the given (remaining) members', async () => {
        const rotated = await SocketService.rotateGroupKey(groupId, ['member-a', 'member-b']);

        expect(SocketService.distributeGroupKey).toHaveBeenCalledTimes(1);
        expect(SocketService.distributeGroupKey).toHaveBeenCalledWith(
            groupId,
            rotated,
            ['member-a', 'member-b']
        );
    });

    test('skips distribution when no members remain', async () => {
        await SocketService.rotateGroupKey(groupId, []);
        expect(SocketService.distributeGroupKey).not.toHaveBeenCalled();
    });

    test('two rotations produce different keys (no reuse)', async () => {
        const first = await SocketService.rotateGroupKey(groupId, ['member-a']);
        const second = await SocketService.rotateGroupKey(groupId, ['member-a']);
        expect(first).not.toBe(second);
    });
});
