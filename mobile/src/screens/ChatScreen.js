import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import {
    Appbar,
    Text,
    ActivityIndicator
} from 'react-native-paper';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import { useAuth } from '../context/AuthContext';

const ChatScreen = ({ route, navigation }) => {
    const { contactId, contactName, contactOnline } = route.params;
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typingStatus, setTypingStatus] = useState(false);

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

        return () => {
            unsubscribe();
            unsubscribeTyping();
            unsubscribeTypingStop();
            unsubscribeRead();
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

    const renderMessage = ({ item }) => (
        <MessageBubble
            message={item}
            isOwnMessage={item.sender.id === user.id}
        />
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content
                    title={contactName}
                    subtitle={contactOnline ? 'Online' : 'Offline'}
                />
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

                {typingStatus && (
                    <View style={styles.typingContainer}>
                        <Text style={styles.typingText}>{contactName} is typing...</Text>
                    </View>
                )}
            </View>

            <ChatInput
                onSend={sendMessage}
                onTyping={handleTyping}
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
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff'
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#666'
    }
});

export default ChatScreen;
