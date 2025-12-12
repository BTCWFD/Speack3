import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { format } from 'date-fns';

const MessageBubble = ({ message, isOwnMessage, showSenderName = false }) => {
    const formatTime = (timestamp) => {
        try {
            return format(new Date(timestamp), 'HH:mm');
        } catch {
            return '';
        }
    };

    return (
        <View style={[
            styles.container,
            isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
            {!isOwnMessage && showSenderName && (
                <Text style={styles.senderName}>{message.sender?.username}</Text>
            )}

            <Surface style={[
                styles.bubble,
                isOwnMessage ? styles.ownBubble : styles.otherBubble
            ]}>
                <Text style={[
                    styles.messageText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                    {message.content}
                </Text>

                <View style={styles.metadata}>
                    <Text style={[
                        styles.timeText,
                        isOwnMessage ? styles.ownTimeText : styles.otherTimeText
                    ]}>
                        {formatTime(message.timestamp)}
                    </Text>

                    {isOwnMessage && (
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
