import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton } from 'react-native-paper';

const ChatInput = ({ onSend, onTyping, placeholder = 'Type a message...' }) => {
    const [message, setMessage] = useState('');
    const typingTimeoutRef = useRef(null);

    const handleMessageChange = (text) => {
        setMessage(text);

        // Notify typing start
        if (onTyping) {
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

    return (
        <View style={styles.container}>
            <TextInput
                value={message}
                onChangeText={handleMessageChange}
                placeholder={placeholder}
                mode="outlined"
                multiline
                maxLength={1000}
                style={styles.input}
                right={
                    <TextInput.Icon
                        icon="send"
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
    }
});

export default ChatInput;
