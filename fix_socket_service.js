const fs = require('fs');
let code = fs.readFileSync('mobile/src/services/SocketService.js', 'utf8');

// Add pinnedHandlers
code = code.replace(
    `this.deletedHandlers = new Set();`,
    `this.deletedHandlers = new Set();\
        this.pinnedHandlers = new Set();`
);

// Add onMessagePinned
code = code.replace(
    `    onMessageDeleted(handler) {
        this.deletedHandlers.add(handler);
        return () => this.deletedHandlers.delete(handler);
    }`,
    `    onMessageDeleted(handler) {
        this.deletedHandlers.add(handler);
        return () => this.deletedHandlers.delete(handler);
    }

    onMessagePinned(handler) {
        this.pinnedHandlers.add(handler);
        return () => this.pinnedHandlers.delete(handler);
    }`
);

// Add socket.on('message:pinned')
code = code.replace(
    `        this.socket.on('message:deleted', (data) => {
            this.deletedHandlers.forEach(handler => handler(data));
        });`,
    `        this.socket.on('message:deleted', (data) => {
            this.deletedHandlers.forEach(handler => handler(data));
        });
        
        this.socket.on('message:pinned', (data) => {
            this.pinnedHandlers.forEach(handler => handler(data));
        });`
);

fs.writeFileSync('mobile/src/services/SocketService.js', code);
