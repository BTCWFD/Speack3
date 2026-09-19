// Unit tests for SocketService.distributeGroupKey's delivery reliability.
//
// Before this fix, distributeGroupKey emitted straight to the socket: a
// member who happened to be offline at the exact moment of rotation relied
// solely on socket.io's best-effort in-memory emit buffer, with no
// persisted retry. Since distributeGroupKey now routes through
// sendDirectMessage, an offline member's control message lands in the same
// persisted offline queue as regular messages and is retried by
// flushQueue() on reconnect — see docs/GROUP_ENCRYPTION_DESIGN.md.
//
// These tests force the offline branch (SocketService.connected = false),
// which never touches SignalService/the real socket, so no crypto/session
// mocking is needed.

const StorageService = require('../src/services/StorageService').default;
const SocketService = require('../src/services/SocketService').default;

describe('SocketService.distributeGroupKey (offline delivery)', () => {
    const groupId = 'group-2';

    beforeEach(async () => {
        SocketService.connected = false;
        SocketService.socket = null;
        const queue = await StorageService.getOutgoingQueue();
        await Promise.all(queue.map((item) => StorageService.removeFromQueue(item.tempId)));
    });

    test('queues the control message for an offline member instead of dropping it', async () => {
        const keyB64 = 'fake-key-b64';
        await SocketService.distributeGroupKey(groupId, keyB64, ['member-x']);

        const queue = await StorageService.getOutgoingQueue();
        const queued = queue.find((q) => q.tempId === `gk_${groupId}_member-x`);

        expect(queued).toBeDefined();
        expect(queued.kind).toBe('direct');
        expect(queued.targetId).toBe('member-x');
        expect(JSON.parse(queued.text)).toEqual({
            __speack3: 'group-key',
            groupId,
            key: keyB64
        });
    });

    test('queues one control message per remaining member, skipping the sender', async () => {
        await StorageService.saveCurrentUser({ id: 'me-id' });

        await SocketService.distributeGroupKey('group-3', 'k', ['me-id', 'member-a', 'member-b']);

        const queue = await StorageService.getOutgoingQueue();
        const targets = queue
            .filter((q) => q.tempId.startsWith('gk_group-3_'))
            .map((q) => q.targetId)
            .sort();

        expect(targets).toEqual(['member-a', 'member-b']);
    });
});
