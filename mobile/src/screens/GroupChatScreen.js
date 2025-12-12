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
    ActivityIndicator,
    Menu
} from 'react-native-paper';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import { useAuth } from '../context/AuthContext';

const GroupChatScreen = ({ route, navigation }) => {
    const { groupId, groupName, members } = route.params;
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);

    const flatListRef = useRef(null);

    useEffect(() => {
        loadMessages();

        // Listen for new messages
        const unsubscribe = SocketService.onMessage(handleNewMessage);

        return () => unsubscribe();
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

    const renderMessage = ({ item }) => (
        <MessageBubble
            message={item}
            isOwnMessage={item.sender.id === user.id}
            showSenderName={true}
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
                            // TODO: Navigate to group info
                        }}
                        title="Group info"
                    />
                    <Menu.Item
                        onPress={() => {
                            setMenuVisible(false);
                            // TODO: Add members
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
                onSend={sendMessage}
                placeholder={`Message ${groupName}`}
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
