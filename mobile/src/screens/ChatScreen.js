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
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import AttachmentMenu from '../components/AttachmentMenu';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import { useAuth } from '../context/AuthContext';
import { buildMessageListData } from '../utils/messageListGrouping';
import * as ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import MediaCryptoService from '../services/MediaCryptoService';
import AudioRecord from 'react-native-audio-record';
import EventDialog from '../components/EventDialog';

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
    const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);

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
            // Load from local cache
            const cachedMessages = await StorageService.getMessages(contactId);
            if (cachedMessages.length > 0) {
                setMessages(cachedMessages);
            }
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

    const handleMessagePinned = (data) => {
        setMessages(prev => prev.map(msg => 
            msg.id === data.messageId ? { ...msg, pinned: data.pinned } : msg
        ));
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

    const sendJsonPayload = async (type, data) => {
        const payload = JSON.stringify({ __speack3_media: true, type, ...data });
        const tempId = Date.now().toString();
        
        setMessages(prev => [...prev, {
            id: tempId,
            sender: { id: user.id, username: user.username },
            content: payload,
            timestamp: new Date().toISOString(),
            sending: true
        }]);
        
        setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
        
        try {
            await SocketService.sendDirectMessage(contactId, payload, tempId);
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? { ...msg, sending: false, sent: true } : msg
            ));
        } catch (e) {
            console.error('Error sending payload', e);
        }
    };

    const sendMediaMessage = async (mediaType, uri, mimeType, filename) => {
        try {
            const text = JSON.stringify({ __speack3_media: true, type: mediaType, state: 'uploading', filename });
            const tempId = Date.now().toString();
            
            setMessages(prev => [...prev, {
                id: tempId,
                sender: { id: user.id, username: user.username },
                content: text,
                timestamp: new Date().toISOString(),
                sending: true
            }]);
            
            setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
            
            const { url, key } = await MediaCryptoService.encryptAndUpload(uri, mimeType);
            
            const finalPayload = JSON.stringify({
                __speack3_media: true,
                type: mediaType,
                url,
                key,
                mimeType,
                filename
            });
            
            await SocketService.sendDirectMessage(contactId, finalPayload, tempId);
            
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? { ...msg, content: finalPayload, sending: false, sent: true } : msg
            ));
        } catch (error) {
            console.error('Media upload error:', error);
            Alert.alert('Error', 'No se pudo enviar el archivo');
        }
    };

    const handleAttachmentSelect = async (type) => {
        setAttachmentMenuVisible(false);
        
        if (type === 'gallery' || type === 'camera') {
            const options = { mediaType: 'mixed', selectionLimit: 1 };
            const action = type === 'camera' ? ImagePicker.launchCamera : ImagePicker.launchImageLibrary;
            
            action(options, async (response) => {
                if (response.didCancel || response.errorCode) return;
                if (response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    await sendMediaMessage('image', asset.uri, asset.type, asset.fileName || 'image.jpg');
                }
            });
        } else if (type === 'document') {
            try {
                const res = await DocumentPicker.pick({
                    type: [DocumentPicker.types.allFiles],
                });
                if (res && res.length > 0) {
                    const file = res[0];
                    await sendMediaMessage('file', file.uri, file.type, file.name);
                }
            } catch (err) {
                if (!DocumentPicker.isCancel(err)) {
                    console.error('DocumentPicker error:', err);
                }
            }
        } else if (type === 'event') {
            setEventDialogVisible(true);
        } else if (type === 'contact') {
            // Fake sharing a contact for MVP
            sendJsonPayload('contact', { contactName: 'Usuario de Prueba', contactUsername: 'prueba123' });
        } else {
            Alert.alert('En desarrollo', `Se seleccionó: ${type}`);
        }
    };

    const handleRecordStart = () => {
        console.log('Iniciando grabación...');
        AudioRecord.init({
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,
            wavFile: `audio_${Date.now()}.wav`
        });
        AudioRecord.start();
    };

    const handleRecordStop = async () => {
        console.log('Deteniendo grabación...');
        try {
            const audioFile = await AudioRecord.stop();
            if (audioFile) {
                const uri = Platform.OS === 'ios' ? (audioFile.startsWith('file://') ? audioFile : `file://${audioFile}`) : `file://${audioFile}`;
                await sendMediaMessage('audio', uri, 'audio/wav', 'voice_note.wav');
            }
        } catch (error) {
            console.error('Stop recording error:', error);
        }
    };

    const handleTyping = (isTyping) => {
        if (isTyping) {
            SocketService.sendTypingStart(contactId);
        } else {
            SocketService.sendTypingStop(contactId);
        }
    };

    // Build a list that interleaves day-separator items between messages
    // (and marks consecutive same-sender runs) — shared with GroupChatScreen.
    const buildListData = () => buildMessageListData(messages);

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
                isRunStart={item.isRunStart}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPin={handlePin}
            />
        );
    };

    const pinnedMessage = messages.slice().reverse().find(m => m.pinned);
    
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
                <Appbar.Action
                    icon="shield-check"
                    color={theme.colors.primary}
                    onPress={() =>
                        Alert.alert(
                            t('chat.encryptionBadgeTitle'),
                            t('chat.encryptionBadgeBody', { name: contactName }),
                            [{ text: t('common.ok') }]
                        )
                    }
                />
            </Appbar.Header>

            {pinnedMessage && (
                <View style={[styles.pinnedBanner, { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary }]}>
                    <Icon name="pin" size={20} color={theme.colors.primary} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.primary }}>Mensaje fijado</Text>
                        <Text numberOfLines={1} style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                            {pinnedMessage.content?.includes('__speack3_media') ? 'Multimedia adjunta' : pinnedMessage.content}
                        </Text>
                    </View>
                </View>
            )}

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

            <AttachmentMenu 
                visible={attachmentMenuVisible} 
                onSelect={handleAttachmentSelect} 
            />

            <EventDialog 
                visible={eventDialogVisible}
                onDismiss={() => setEventDialogVisible(false)}
                onSubmit={(eventData) => sendJsonPayload('event', { eventTitle: eventData.title, eventDate: eventData.date, eventTime: eventData.time })}
            />
            <ChatInput
                onSend={editingMessage ? submitEdit : sendMessage}
                onTyping={handleTyping}
                editing={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onAttachmentPress={() => setAttachmentMenuVisible(!attachmentMenuVisible)}
                onRecordStart={handleRecordStart}
                onRecordStop={handleRecordStop}

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
    pinnedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderLeftWidth: 4,
        elevation: 2,
        zIndex: 10
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
