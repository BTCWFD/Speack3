import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import {
    Appbar,
    Text,
    ActivityIndicator,
    TouchableRipple,
    useTheme
} from 'react-native-paper';
import { formatDistanceToNow, isToday, isYesterday, isSameDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import { useAuth } from '../context/AuthContext';

const ChatScreen = ({ route, navigation }) => {
    const { contactId, contactName, contactOnline } = route.params;
    const { user } = useAuth();
    const theme = useTheme();
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'es' ? es : undefined;

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typingStatus, setTypingStatus] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [online, setOnline] = useState(!!contactOnline);
    const [lastSeen, setLastSeen] = useState(null);

    const flatListRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        loadMessages();

        // Listen for new messages
        const unsubscribe = SocketService.onMessage(handleNewMessage);

        // Listen for typing indicators
        const unsubscribeTyping = SocketService.onEvent('typing:start', handleTypingStart);
        const unsubscribeTypingStop = SocketService.onEvent('typing:stop', handleTypingStop);

        // Listen for read receipts
        const unsubscribeRead = SocketService.onEvent('message:read', handleMessageRead);

        // Listen for edit / delete broadcasts
        const unsubscribeEdited = SocketService.onMessageEdited(handleMessageEdited);
        const unsubscribeDeleted = SocketService.onMessageDeleted(handleMessageDeleted);

        // Listen for presence changes
        const unsubscribeOnline = SocketService.onEvent('user:online', handleUserOnline);
        const unsubscribeOffline = SocketService.onEvent('user:offline', handleUserOffline);

        return () => {
            unsubscribe();
            unsubscribeTyping();
            unsubscribeTypingStop();
            unsubscribeRead();
            unsubscribeEdited();
            unsubscribeDeleted();
            unsubscribeOnline();
            unsubscribeOffline();
        };
    }, [contactId]);

    const loadMessages = async () => {
        try {
            // Load from local cache first
            const cachedMessages = await StorageService.getMessages(contactId);
            if (cachedMessages.length > 0) {
                setMessages(cachedMessages);
                setLoading(false);
            }

            // Fetch from server
            const serverMessages = await ApiService.getDirectMessages(contactId);
            setMessages(serverMessages);
        } catch (error) {
            console.error('Load messages error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewMessage = (message) => {
        // Only add if it's for this chat
        if (message.messageType === 'direct' &&
            (message.sender.id === contactId || message.sender.id === user.id)) {

            setMessages(prev => [...prev, message]);

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

            // Mark as read if from contact
            if (message.sender.id === contactId) {
                SocketService.markAsRead(message.id);
            }
        }
    };

    const handleTypingStart = (data) => {
        if (data.userId === contactId) {
            setTypingStatus(true);

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Auto-stop after 3 seconds
            typingTimeoutRef.current = setTimeout(() => {
                setTypingStatus(false);
            }, 3000);
        }
    };

    const handleTypingStop = (data) => {
        if (data.userId === contactId) {
            setTypingStatus(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
    };

    const handleMessageRead = (data) => {
        // Update message read status
        setMessages(prev => prev.map(msg =>
            msg.id === data.messageId
                ? { ...msg, read: true, readAt: data.readAt }
                : msg
        ));
    };

    const matchesId = (msg, messageId) => {
        const id = msg.id ?? msg._id;
        return id?.toString() === messageId?.toString();
    };

    const handleMessageEdited = (data) => {
        setMessages(prev => prev.map(msg =>
            matchesId(msg, data.messageId)
                ? {
                    ...msg,
                    content: data.content ?? msg.content,
                    edited: true,
                    editedAt: data.editedAt
                }
                : msg
        ));

        // Update local cache
        StorageService.updateMessage(contactId, data.messageId, (msg) => ({
            ...msg,
            content: data.content ?? msg.content,
            edited: true,
            editedAt: data.editedAt
        }));
    };

    const handleMessageDeleted = (data) => {
        setMessages(prev => prev.map(msg =>
            matchesId(msg, data.messageId)
                ? { ...msg, deleted: true, content: '' }
                : msg
        ));

        StorageService.markMessageDeleted(contactId, data.messageId);
    };

    const handleUserOnline = (data) => {
        if (data.userId === contactId) {
            setOnline(true);
        }
    };

    const handleUserOffline = (data) => {
        if (data.userId === contactId) {
            setOnline(false);
            if (data.lastSeen) {
                setLastSeen(data.lastSeen);
            }
        }
    };

    const handleEdit = (message) => {
        setEditingMessage(message);
    };

    const handleDelete = (message) => {
        Alert.alert(
            t('chat.deleteTitle'),
            t('chat.deleteConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        const messageId = message.id ?? message._id;
                        try {
                            SocketService.deleteMessage(messageId);
                        } catch (error) {
                            console.error('Delete message error:', error);
                        }

                        // Optimistic update
                        setMessages(prev => prev.map(msg =>
                            matchesId(msg, messageId)
                                ? { ...msg, deleted: true, content: '' }
                                : msg
                        ));
                        StorageService.markMessageDeleted(contactId, messageId);
                    }
                }
            ]
        );
    };

    const submitEdit = async (newText) => {
        const target = editingMessage;
        setEditingMessage(null);

        if (!target) {
            return;
        }

        const messageId = target.id ?? target._id;

        // Optimistic update
        setMessages(prev => prev.map(msg =>
            matchesId(msg, messageId)
                ? { ...msg, content: newText, edited: true }
                : msg
        ));

        try {
            await SocketService.editMessage(contactId, messageId, newText, false);
            StorageService.updateMessage(contactId, messageId, (msg) => ({
                ...msg,
                content: newText,
                edited: true
            }));
        } catch (error) {
            console.error('Edit message error:', error);
        }
    };

    const getSubtitle = () => {
        if (online) {
            return t('chat.online');
        }
        if (lastSeen) {
            try {
                const time = formatDistanceToNow(new Date(lastSeen), {
                    addSuffix: true,
                    locale: dateLocale
                });
                return t('chat.lastSeen', { time });
            } catch {
                return t('chat.offline');
            }
        }
        return t('chat.offline');
    };

    const sendMessage = async (text) => {
        const tempId = Date.now().toString();

        // Optimistic update
        const tempMessage = {
            id: tempId,
            sender: { id: user.id, username: user.username },
            content: text,
            timestamp: new Date().toISOString(),
            sending: true
        };

        setMessages(prev => [...prev, tempMessage]);

        // Scroll to bottom
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            // Send via socket
            await SocketService.sendDirectMessage(contactId, text, tempId);

            // Update temp message status
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, sending: false, sent: true }
                    : msg
            ));
        } catch (error) {
            console.error('Send message error:', error);
            // Mark as failed
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, sending: false, failed: true }
                    : msg
            ));
        }
    };

    const handleTyping = (isTyping) => {
        if (isTyping) {
            SocketService.sendTypingStart(contactId);
        } else {
            SocketService.sendTypingStop(contactId);
        }
    };

    // Build a list that interleaves day-separator items between messages.
    const buildListData = () => {
        const data = [];
        let prevDate = null;
        messages.forEach((msg) => {
            const ts = msg.timestamp;
            const d = ts ? new Date(ts) : null;
            const valid = d && !isNaN(d.getTime());
            if (valid && (!prevDate || !isSameDay(d, prevDate))) {
                data.push({
                    type: 'separator',
                    id: `sep-${d.toDateString()}`,
                    date: d
                });
                prevDate = d;
            }
            data.push({ type: 'message', id: msg.id ?? msg._id, message: msg });
        });
        return data;
    };

    const formatDayLabel = (date) => {
        if (isToday(date)) return t('chat.today');
        if (isYesterday(date)) return t('chat.yesterday');
        try {
            return format(date, 'PPP', { locale: dateLocale });
        } catch {
            return '';
        }
    };

    const renderItem = ({ item }) => {
        if (item.type === 'separator') {
            return (
                <View style={styles.separatorRow}>
                    <View
                        style={[
                            styles.separatorChip,
                            { backgroundColor: theme.colors.surfaceVariant }
                        ]}
                    >
                        <Text
                            style={[
                                styles.separatorText,
                                { color: theme.colors.onSurfaceVariant }
                            ]}
                        >
                            {formatDayLabel(item.date)}
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <MessageBubble
                message={item.message}
                isOwnMessage={item.message.sender.id === user.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Icon
                name="lock-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                {t('chat.encryptedNotice')}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                {t('chat.sayHi')}
            </Text>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <TouchableRipple
                    style={styles.headerContent}
                    onPress={() => navigation.navigate('Profile', {
                        userId: contactId,
                        username: contactName
                    })}
                >
                    <Appbar.Content
                        title={contactName}
                        subtitle={getSubtitle()}
                    />
                </TouchableRipple>
            </Appbar.Header>

            <View style={styles.messagesContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={buildListData()}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id?.toString()}
                        contentContainerStyle={[
                            styles.messagesList,
                            messages.length === 0 && styles.messagesListEmpty
                        ]}
                        ListEmptyComponent={renderEmpty}
                        onContentSizeChange={() =>
                            messages.length > 0 && flatListRef.current?.scrollToEnd()
                        }
                    />
                )}

                {typingStatus && (
                    <View
                        style={[
                            styles.typingContainer,
                            { backgroundColor: theme.colors.elevation?.level2 || theme.colors.surface }
                        ]}
                    >
                        <Text style={[styles.typingText, { color: theme.colors.onSurfaceVariant }]}>
                            {t('chat.isTyping', { name: contactName })}
                        </Text>
                    </View>
                )}
            </View>

            <ChatInput
                onSend={editingMessage ? submitEdit : sendMessage}
                onTyping={handleTyping}
                editing={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    headerContent: {
        flex: 1
    },
    messagesContainer: {
        flex: 1
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    messagesList: {
        padding: 16,
        paddingBottom: 8
    },
    messagesListEmpty: {
        flexGrow: 1
    },
    separatorRow: {
        alignItems: 'center',
        marginVertical: 8
    },
    separatorChip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12
    },
    separatorText: {
        fontSize: 12,
        fontWeight: '500'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 16
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 4
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic'
    }
});

export default ChatScreen;
