// Unit tests for buildMessageListData (mobile/src/utils/messageListGrouping.js):
// the day-separator + consecutive-run grouping shared by ChatScreen and
// GroupChatScreen, used to show a sender's name/avatar only once per run of
// consecutive messages (WhatsApp/Telegram pattern) instead of on every bubble.

const { buildMessageListData } = require('../src/utils/messageListGrouping');

const msg = (id, senderId, timestamp) => ({
    id,
    sender: { id: senderId },
    content: `msg-${id}`,
    timestamp
});

describe('buildMessageListData', () => {
    test('empty input returns empty list', () => {
        expect(buildMessageListData([])).toEqual([]);
        expect(buildMessageListData(undefined)).toEqual([]);
    });

    test('inserts one separator before the first message of a day', () => {
        const data = buildMessageListData([msg('1', 'a', '2024-01-01T10:00:00Z')]);
        expect(data.map((d) => d.type)).toEqual(['separator', 'message']);
        expect(data[1].isRunStart).toBe(true);
    });

    test('consecutive messages from the same sender on the same day form one run', () => {
        const data = buildMessageListData([
            msg('1', 'a', '2024-01-01T10:00:00Z'),
            msg('2', 'a', '2024-01-01T10:01:00Z'),
            msg('3', 'a', '2024-01-01T10:02:00Z')
        ]);
        const messages = data.filter((d) => d.type === 'message');
        expect(messages.map((m) => m.isRunStart)).toEqual([true, false, false]);
    });

    test('a message from a different sender starts a new run', () => {
        const data = buildMessageListData([
            msg('1', 'a', '2024-01-01T10:00:00Z'),
            msg('2', 'a', '2024-01-01T10:01:00Z'),
            msg('3', 'b', '2024-01-01T10:02:00Z'),
            msg('4', 'a', '2024-01-01T10:03:00Z')
        ]);
        const messages = data.filter((d) => d.type === 'message');
        expect(messages.map((m) => m.isRunStart)).toEqual([true, false, true, true]);
    });

    test('crossing a day boundary always starts a new run, even for the same sender', () => {
        const data = buildMessageListData([
            msg('1', 'a', '2024-01-01T23:50:00Z'),
            msg('2', 'a', '2024-01-02T00:10:00Z')
        ]);
        const separators = data.filter((d) => d.type === 'separator');
        const messages = data.filter((d) => d.type === 'message');
        expect(separators).toHaveLength(2);
        expect(messages.map((m) => m.isRunStart)).toEqual([true, true]);
    });

    test('a message with an invalid/missing timestamp does not insert a separator or crash', () => {
        const data = buildMessageListData([
            msg('1', 'a', undefined),
            msg('2', 'a', '2024-01-01T10:00:00Z')
        ]);
        expect(data.filter((d) => d.type === 'separator')).toHaveLength(1);
        expect(data).toHaveLength(3);
    });

    test('preserves message order and ids', () => {
        const data = buildMessageListData([
            msg('1', 'a', '2024-01-01T10:00:00Z'),
            msg('2', 'b', '2024-01-01T10:01:00Z')
        ]);
        const ids = data.filter((d) => d.type === 'message').map((m) => m.id);
        expect(ids).toEqual(['1', '2']);
    });
});
