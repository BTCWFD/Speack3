import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Surface, Text, Menu, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// WhatsApp/Telegram both render the "read" tick in the same recognizable
// blue regardless of light/dark theme — it's a universal signal, not a
// themed accent, so it's a fixed color rather than theme.colors.primary.
const READ_TICK_COLOR = '#34B7F1';

const MessageBubble = ({
    message,
    isOwnMessage,
    showSenderName = false,
    // False for every message but the first in a run of consecutive
    // messages from the same sender (see mobile/src/utils/messageListGrouping.js).
    // Hides the repeated sender name and tightens spacing, matching how
    // WhatsApp/Telegram group consecutive bubbles instead of repeating the
    // name/avatar on every single one.
    isRunStart = true,
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

    // Single resolved status (priority: failed > read > delivered > sent >
    // sending) instead of independently toggled flags — the previous version
    // rendered '✓✓' for both `delivered` and `read` with no visual
    // distinction, so a read message showed a duplicated '✓✓✓✓' and never
    // gave the WhatsApp/Telegram "blue tick" read signal.
    const status = message.failed
        ? { icon: 'alert-circle-outline', color: theme.colors.error }
        : message.read
        ? { icon: 'check-all', color: READ_TICK_COLOR }
        : message.delivered
        ? { icon: 'check-all', color: ownMetaColor }
        : message.sent
        ? { icon: 'check', color: ownMetaColor }
        : message.sending
        ? { icon: 'clock-outline', color: ownMetaColor }
        : null;

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
            isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
            !isRunStart && styles.groupedContainer
        ]}>
            {!isOwnMessage && showSenderName && isRunStart && (
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

                                {isOwnMessage && !message.deleted && status && (
                                    <Icon
                                        name={status.icon}
                                        size={14}
                                        color={status.color}
                                        style={styles.statusIcon}
                                    />
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
    // Tighter gap between consecutive bubbles from the same sender in a run,
    // matching WhatsApp/Telegram's grouped-message spacing.
    groupedContainer: {
        marginTop: 1
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
        marginLeft: 4
    }
});

export default MessageBubble;
