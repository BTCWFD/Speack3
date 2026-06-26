import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Surface, Text, Menu, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const MessageBubble = ({
    message,
    isOwnMessage,
    showSenderName = false,
    onEdit,
    onDelete
}) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const theme = useTheme();
    const { t } = useTranslation();
    const { colors } = theme;

    // Theme-aware colors: own bubble uses primary, other uses an elevated surface.
    const otherBubbleColor =
        colors.elevation?.level2 || colors.surfaceVariant;
    const ownTextColor = colors.onPrimary;
    const otherTextColor = colors.onSurface;
    const ownMetaColor = colors.onPrimary;
    const otherMetaColor = colors.onSurfaceVariant;

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

    const textColor = isOwnMessage ? ownTextColor : otherTextColor;
    const metaColor = isOwnMessage ? ownMetaColor : otherMetaColor;

    const renderBody = () => {
        if (message.deleted) {
            return (
                <Text style={[styles.deletedText, { color: textColor }]}>
                    {t('message.deleted')}
                </Text>
            );
        }

        return (
            <Text style={[styles.messageText, { color: textColor }]}>
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
                <Text style={[styles.senderName, { color: colors.onSurfaceVariant }]}>
                    {message.sender?.username}
                </Text>
            )}

            <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                    <Pressable
                        onLongPress={handleLongPress}
                        delayLongPress={300}
                    >
                        <Surface
                            style={[
                                styles.bubble,
                                isOwnMessage ? styles.ownBubble : styles.otherBubble,
                                {
                                    backgroundColor: isOwnMessage
                                        ? colors.primary
                                        : otherBubbleColor
                                }
                            ]}
                        >
                            {renderBody()}

                            <View style={styles.metadata}>
                                {message.edited && !message.deleted && (
                                    <Text style={[
                                        styles.editedText,
                                        { color: metaColor, opacity: 0.7 }
                                    ]}>
                                        {t('message.edited')}
                                    </Text>
                                )}

                                <Text style={[
                                    styles.timeText,
                                    { color: metaColor, opacity: 0.7 }
                                ]}>
                                    {formatTime(message.timestamp)}
                                </Text>

                                {isOwnMessage && !message.deleted && (
                                    <Text style={[
                                        styles.statusIcon,
                                        { color: ownMetaColor, opacity: 0.9 }
                                    ]}>
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
                        title={t('message.edit')}
                        leadingIcon="pencil"
                    />
                )}
                {onDelete && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onDelete(message);
                        }}
                        title={t('message.delete')}
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
        borderBottomRightRadius: 4
    },
    otherBubble: {
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
    statusIcon: {
        fontSize: 12,
        marginLeft: 4
    }
});

export default MessageBubble;
