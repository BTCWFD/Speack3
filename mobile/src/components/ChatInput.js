import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton, Text } from 'react-native-paper';

const ChatInput = ({
    onSend,
    onTyping,
    placeholder = 'Type a message...',
    editing = null,
    onCancelEdit
}) => {
    const [message, setMessage] = useState('');
    const typingTimeoutRef = useRef(null);

    // When an edit starts, pre-fill the input with the text being edited.
    useEffect(() => {
        if (editing) {
            setMessage(editing.content ?? '');
        } else {
            setMessage('');
        }
    }, [editing]);

    const handleMessageChange = (text) => {
        setMessage(text);

        // Notify typing start (skip while editing)
        if (onTyping && !editing) {
            onTyping(true);

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set timeout to stop typing after 2 seconds
            typingTimeoutRef.current = setTimeout(() => {
                if (onTyping) {
                    onTyping(false);
                }
            }, 2000);
        }
    };

    const handleSend = () => {
        if (message.trim()) {
            onSend(message.trim());
            setMessage('');

            // Stop typing indicator
            if (onTyping) {
                onTyping(false);
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
    };

    const handleCancel = () => {
        setMessage('');
        if (onCancelEdit) {
            onCancelEdit();
        }
    };

    return (
        <View style={styles.container}>
            {editing && (
                <View style={styles.editBanner}>
                    <View style={styles.editBannerText}>
                        <Text style={styles.editLabel}>Editing message</Text>
                        <Text style={styles.editPreview} numberOfLines={1}>
                            {editing.content}
                        </Text>
                    </View>
                    <IconButton
                        icon="close"
                        size={18}
                        onPress={handleCancel}
                    />
                </View>
            )}

            <TextInput
                value={message}
                onChangeText={handleMessageChange}
                placeholder={editing ? 'Edit message...' : placeholder}
                mode="outlined"
                multiline
                maxLength={1000}
                style={styles.input}
                right={
                    <TextInput.Icon
                        icon={editing ? 'check' : 'send'}
                        disabled={!message.trim()}
                        onPress={handleSend}
                        color={message.trim() ? '#6200ee' : '#ccc'}
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0'
    },
    input: {
        maxHeight: 100,
        backgroundColor: '#fff'
    },
    editBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        marginBottom: 4,
        borderLeftWidth: 3,
        borderLeftColor: '#6200ee',
        backgroundColor: '#f3effc',
        borderRadius: 4
    },
    editBannerText: {
        flex: 1
    },
    editLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6200ee'
    },
    editPreview: {
        fontSize: 13,
        color: '#666'
    }
});

export default ChatInput;
