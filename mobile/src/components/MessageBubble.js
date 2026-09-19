import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, TouchableOpacity, Linking } from 'react-native';
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
    onDelete,
    onPin
}) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [decryptedMediaUrl, setDecryptedMediaUrl] = useState(null);
    const [mediaError, setMediaError] = useState(false);
    const theme = useTheme();
    const { t } = useTranslation();
    const { colors } = theme;
    
    let isMedia = false;
    let mediaData = null;
    try {
        if (message.content && message.content.startsWith('{"__speack3_media"')) {
            mediaData = JSON.parse(message.content);
            isMedia = true;
        }
    } catch (e) {}

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

        if (isMedia && mediaData) {
            const { type, state, filename } = mediaData;
            
            if (state === 'uploading') {
                return (
                    <View style={styles.mediaContainer}>
                        <Icon name="cloud-upload" size={32} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, marginTop: 4 }]}>Subiendo {filename}...</Text>
                    </View>
                );
            }

            if (type === 'image') {
                // For MVP, we render a placeholder since real decryption requires downloading
                return (
                    <View style={styles.mediaContainer}>
                        <Icon name="image" size={48} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, fontSize: 12 }]}>{filename}</Text>
                        <Text style={[styles.messageText, { color: textColor, fontSize: 10, marginTop: 4 }]}>(Imagen Encriptada)</Text>
                    </View>
                );
            } else if (type === 'audio') {
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="play-circle" size={36} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, marginLeft: 8 }]}>Audio / Nota de voz</Text>
                    </View>
                );
            } else if (type === 'file') {
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="file-document" size={36} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, marginLeft: 8 }]}>{filename}</Text>
                    </View>
                );
            } else if (type === 'event') {
                const { eventTitle, eventDate, eventTime } = mediaData;
                return (
                    <View style={[styles.mediaContainer, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, minWidth: 200, padding: 16 }]}>
                        <Icon name="calendar-clock" size={48} color={theme.colors.primary} />
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8, color: textColor }}>{eventTitle}</Text>
                        <Text style={{ fontSize: 14, marginTop: 4, color: textColor }}>📅 {eventDate}</Text>
                        {eventTime ? <Text style={{ fontSize: 14, marginTop: 4, color: textColor }}>⏰ {eventTime}</Text> : null}
                    </View>
                );
            } else if (type === 'contact') {
                const { contactName, contactUsername } = mediaData;
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="account-circle" size={48} color={theme.colors.primary} />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>{contactName}</Text>
                            <Text style={{ fontSize: 14, color: textColor }}>@{contactUsername}</Text>
                        </View>
                    </View>
                );
            }
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
                                {message.pinned && (
                                    <Icon name="pin" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                                )}
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
                {onPin && !message.deleted && (
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            onPin(message);
                        }}
                        title={message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
                        leadingIcon={message.pinned ? 'pin-off' : 'pin'}
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
    },
    mediaContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        minWidth: 120,
        minHeight: 120,
    },
    mediaContainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        minWidth: 150,
    }
});

export default MessageBubble;
