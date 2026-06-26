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
    Menu,
    useTheme
} from 'react-native-paper';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import { useAuth } from '../context/AuthContext';

const GroupChatScreen = ({ route, navigation }) => {
    const { groupId, groupName, members } = route.params;
    const { user } = useAuth();
    const theme = useTheme();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);

    const flatListRef = useRef(null);

    useEffect(() => {
        loadMessages();

        // Listen for new messages
        const unsubscribe = SocketService.onMessage(handleNewMessage);

        // Listen for edit / delete broadcasts
        const unsubscribeEdited = SocketService.onMessageEdited(handleMessageEdited);
        const unsubscribeDeleted = SocketService.onMessageDeleted(handleMessageDeleted);

        return () => {
            unsubscribe();
            unsubscribeEdited();
            unsubscribeDeleted();
        };
    }, [groupId]);

    const loadMessages = async () => {
        try {
            const serverMessages = await ApiService.getGroupMessages(groupId);
            setMessages(serverMessages);
        } catch (error) {
            console.error('Load group messages error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewMessage = (message) => {
        // Only add if it's for this group
        if (message.messageType === 'group' && message.groupId === groupId) {
            setMessages(prev => [...prev, message]);

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
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
            await SocketService.sendGroupMessage(groupId, text, tempId);

            // Update temp message status
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, sending: false, sent: true }
                    : msg
            ));
        } catch (error) {
            console.error('Send group message error:', error);
            // Mark as failed
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, sending: false, failed: true }
                    : msg
            ));
        }
    };

    const matchesId = (msg, messageId) => {
        const id = msg.id ?? msg._id;
        return id?.toString() === messageId?.toString();
    };

    const handleMessageEdited = (data) => {
        // Group edits are scoped by groupId when present
        if (data.groupId && data.groupId !== groupId) {
            return;
        }

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

        StorageService.updateMessage(groupId, data.messageId, (msg) => ({
            ...msg,
            content: data.content ?? msg.content,
            edited: true,
            editedAt: data.editedAt
        }));
    };

    const handleMessageDeleted = (data) => {
        if (data.groupId && data.groupId !== groupId) {
            return;
        }

        setMessages(prev => prev.map(msg =>
            matchesId(msg, data.messageId)
                ? { ...msg, deleted: true, content: '' }
                : msg
        ));

        StorageService.markMessageDeleted(groupId, data.messageId);
    };

    const handleEdit = (message) => {
        setEditingMessage(message);
    };

    const handleDelete = (message) => {
        Alert.alert(
            'Delete message',
            'Are you sure you want to delete this message?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        const messageId = message.id ?? message._id;
                        try {
                            SocketService.deleteMessage(messageId);
                        } catch (error) {
                            console.error('Delete message error:', error);
                        }

                        setMessages(prev => prev.map(msg =>
                            matchesId(msg, messageId)
                                ? { ...msg, deleted: true, content: '' }
                                : msg
                        ));
                        StorageService.markMessageDeleted(groupId, messageId);
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

        setMessages(prev => prev.map(msg =>
            matchesId(msg, messageId)
                ? { ...msg, content: newText, edited: true }
                : msg
        ));

        try {
            await SocketService.editMessage(groupId, messageId, newText, true);
            StorageService.updateMessage(groupId, messageId, (msg) => ({
                ...msg,
                content: newText,
                edited: true
            }));
        } catch (error) {
            console.error('Edit group message error:', error);
        }
    };

    const renderMessage = ({ item }) => (
        <MessageBubble
            message={item}
            isOwnMessage={item.sender.id === user.id}
            showSenderName={true}
            onEdit={handleEdit}
            onDelete={handleDelete}
        />
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content
                    title={groupName}
                    subtitle={`${members?.length || 0} members`}
                />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <Appbar.Action
                            icon="dots-vertical"
                            onPress={() => setMenuVisible(true)}
                        />
                    }
                >
                    <Menu.Item
                        onPress={() => {
                            setMenuVisible(false);
                            navigation.navigate('GroupInfo', { groupId, groupName });
                        }}
                        title="Group info"
                    />
                    <Menu.Item
                        onPress={() => {
                            setMenuVisible(false);
                            navigation.navigate('GroupInfo', { groupId, groupName });
                        }}
                        title="Add members"
                    />
                </Menu>
            </Appbar.Header>

            <View style={styles.messagesContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id?.toString() || item._id?.toString()}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    />
                )}
            </View>

            <ChatInput
                onSend={editingMessage ? submitEdit : sendMessage}
                placeholder={`Message ${groupName}`}
                editing={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
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
    }
});

export default GroupChatScreen;
