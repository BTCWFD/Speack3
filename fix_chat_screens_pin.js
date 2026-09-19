const fs = require('fs');

const addPinListener = (filePath) => {
    let code = fs.readFileSync(filePath, 'utf8');

    const unsubscribeOld = `        const unsubscribeDelete = SocketService.onMessageDeleted(handleMessageDeleted);`;
    const unsubscribeNew = `        const unsubscribeDelete = SocketService.onMessageDeleted(handleMessageDeleted);
        const unsubscribePin = SocketService.onMessagePinned(handleMessagePinned);`;
    code = code.replace(unsubscribeOld, unsubscribeNew);

    const cleanupOld = `            unsubscribeDelete();`;
    const cleanupNew = `            unsubscribeDelete();
            unsubscribePin();`;
    code = code.replace(cleanupOld, cleanupNew);

    const handlerOld = `    const handleMessageDeleted = (data) => {`;
    const handlerNew = `    const handleMessagePinned = (data) => {
        setMessages(prev => prev.map(msg => 
            msg.id === data.messageId ? { ...msg, pinned: data.pinned } : msg
        ));
    };

    const handleMessageDeleted = (data) => {`;
    code = code.replace(handlerOld, handlerNew);

    fs.writeFileSync(filePath, code);
};

addPinListener('mobile/src/screens/ChatScreen.js');
addPinListener('mobile/src/screens/GroupChatScreen.js');
