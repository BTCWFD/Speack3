import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Surface, Text, Menu } from 'react-native-paper';
import { format } from 'date-fns';

const MessageBubble = ({
    message,
    isOwnMessage,
    showSenderName = false,
    onEdit,
    onDelete
}) => {
    const [menuVisible, setMenuVisible] = useState(false);

    const formatTime = (timestamp) => {
        try {
            return format(new Date(timestamp), 'HH:mm');
        } catch {
            return '';
        }
    };

    // Only the user's own, non-deleted messages can be edited / deleted.
    const canModify = isOwnMessage && !message.deleted && (onEdit || onDelete);

    const handleLongPress = () => {
        if (canModify) {
            setMenuVisible(true);
        }
    };

    const closeMenu = () => setMenuVisible(false);

    const renderBody = () => {
        if (message.deleted) {
            return (
                <Text style={[
                    styles.deletedText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                    Message deleted
                </Text>
            );
        }

        return (
            <Text style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
                {message.content}
            </Text>
        );
    };

    return (
        <View style={[
            styles.container,
            isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
            {!isOwnMessage && showSenderName && (
                <Text style={styles.senderName}>{message.sender?.username}</Text>
            )}

            <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                    <Pressable
                        onLongPress={handleLongPress}
                        delayLongPress={300}
                    >
                        <Surface style={[
                            styles.bubble,
                            isOwnMessage ? styles.ownBubble : styles.otherBubble
                        ]}>
                            {renderBody()}

                            <View style={styles.metadata}>
                                {message.edited && !message.deleted && (
                                    <Text style={[
                                        styles.editedText,
                                        isOwnMessage ? styles.ownTimeText : styles.otherTimeText
                                    ]}>
                                        (edited)
                                    </Text>
                                )}

                                <Text style={[
                                    styles.timeText,
                                    isOwnMessage ? styles.ownTimeText : styles.otherTimeText
                                ]}>
                                    {formatTime(message.timestamp)}
                                </Text>

                                {isOwnMessage && !message.deleted && (
                                    <Text style={styles.statusIcon}>
                                        {message.sending && '○'}
                                        {message.sent && '✓'}
                                        {message.delivered && '✓✓'}
                                        {message.read && '✓✓'}
                                        {message.failed && '!'}
                                    </Text>
                                )}
                            </View>
                        </Surface>
                    </Pressable>
                }
            >
                {onEdit && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onEdit(message);
                        }}
                        title="Edit"
                        leadingIcon="pencil"
                    />
                )}
                {onDelete && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onDelete(message);
                        }}
                        title="Delete"
                        leadingIcon="delete"
                    />
                )}
            </Menu>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 4,
        maxWidth: '80%'
    },
    ownMessageContainer: {
        alignSelf: 'flex-end'
    },
    otherMessageContainer: {
        alignSelf: 'flex-start'
    },
    senderName: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        marginLeft: 12
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        elevation: 1
    },
    ownBubble: {
        backgroundColor: '#6200ee',
        borderBottomRightRadius: 4
    },
    otherBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20
    },
    deletedText: {
        fontSize: 15,
        lineHeight: 20,
        fontStyle: 'italic',
        opacity: 0.7
    },
    ownMessageText: {
        color: '#fff'
    },
    otherMessageText: {
        color: '#000'
    },
    metadata: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        justifyContent: 'flex-end'
    },
    editedText: {
        fontSize: 11,
        fontStyle: 'italic',
        marginRight: 4
    },
    timeText: {
        fontSize: 11
    },
    ownTimeText: {
        color: 'rgba(255, 255, 255, 0.7)'
    },
    otherTimeText: {
        color: '#999'
    },
    statusIcon: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginLeft: 4
    }
});

export default MessageBubble;
