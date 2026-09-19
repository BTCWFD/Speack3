const fs = require('fs');
let code = fs.readFileSync('mobile/src/components/MessageBubble.js', 'utf8');

// Add onPin prop
code = code.replace(
    `    isRunStart = true,
    onEdit,
    onDelete
}) => {`,
    `    isRunStart = true,
    onEdit,
    onDelete,
    onPin
}) => {`
);

// Add Pin to menu
const menuOld = `                {onDelete && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onDelete(message);
                        }}
                        title={t('message.delete')}
                        leadingIcon="delete"
                    />
                )}`;

const menuNew = `                {onDelete && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onDelete(message);
                        }}
                        title={t('message.delete')}
                        leadingIcon="delete"
                    />
                )}
                {onPin && !message.deleted && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onPin(message);
                        }}
                        title={message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
                        leadingIcon={message.pinned ? 'pin-off' : 'pin'}
                    />
                )}`;

code = code.replace(menuOld, menuNew);

fs.writeFileSync('mobile/src/components/MessageBubble.js', code);
