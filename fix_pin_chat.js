const fs = require('fs');

const addPinHandler = (filePath) => {
    let code = fs.readFileSync(filePath, 'utf8');

    // Add handlePin function
    const handleEditStr = `    const handleEdit = (msg) => {`;
    const handlePinStr = `    const handlePin = (msg) => {
        const newPinnedState = !msg.pinned;
        // Optimistic update
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned: newPinnedState } : m));
        // Send to socket
        SocketService.socket.emit('message:pin', { messageId: msg.id, pinned: newPinnedState });
    };

    const handleEdit = (msg) => {`;
    
    code = code.replace(handleEditStr, handlePinStr);

    // Pass onPin to MessageBubble
    const renderBubbleOld = `            <MessageBubble
                message={item.message}
                isOwnMessage={item.message.sender.id === user.id}
                isRunStart={item.isRunStart}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />`;

    const renderBubbleNew = `            <MessageBubble
                message={item.message}
                isOwnMessage={item.message.sender.id === user.id}
                isRunStart={item.isRunStart}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPin={handlePin}
            />`;

    code = code.replace(renderBubbleOld, renderBubbleNew);

    fs.writeFileSync(filePath, code);
};

addPinHandler('mobile/src/screens/ChatScreen.js');
addPinHandler('mobile/src/screens/GroupChatScreen.js');
