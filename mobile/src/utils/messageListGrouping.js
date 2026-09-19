import { isSameDay } from 'date-fns';

// Shared by ChatScreen and GroupChatScreen: turns a flat message array into
// FlatList data with WhatsApp/Telegram-style day separators interleaved, and
// marks each message as starting a new "run" (first message after a day
// separator, or the first from a given sender after someone else's message)
// so screens can show the sender name/avatar only once per run and tighten
// the spacing between grouped bubbles instead of repeating it on every one.
const senderIdOf = (message) =>
    message?.sender?.id ?? message?.sender?._id ?? message?.sender;

export const buildMessageListData = (messages) => {
    const data = [];
    let prevDate = null;
    let prevSenderId = null;

    (messages || []).forEach((msg) => {
        const ts = msg.timestamp;
        const d = ts ? new Date(ts) : null;
        const valid = d && !isNaN(d.getTime());
        const dayChanged = valid && (!prevDate || !isSameDay(d, prevDate));

        if (dayChanged) {
            data.push({
                type: 'separator',
                id: `sep-${d.toDateString()}`,
                date: d
            });
            prevDate = d;
            prevSenderId = null; // a new day always starts a fresh run
        }

        const senderId = senderIdOf(msg);
        const isRunStart = dayChanged || senderId === undefined || senderId !== prevSenderId;

        data.push({
            type: 'message',
            id: msg.id ?? msg._id,
            message: msg,
            isRunStart
        });
        prevSenderId = senderId;
    });

    return data;
};
