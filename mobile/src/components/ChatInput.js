import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton, Text, useTheme } from 'react-native-paper';

const ChatInput = ({
    onSend,
    onTyping,
    placeholder = 'Type a message...',
    editing = null,
    onCancelEdit
}) => {
    const [message, setMessage] = useState('');
    const typingTimeoutRef = useRef(null);
    const { colors } = useTheme();
    const surface = colors.elevation?.level2 || colors.surface;

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
        <View
            style={[
                styles.container,
                {
                    backgroundColor: surface,
                    borderTopColor: colors.outlineVariant || colors.outline
                }
            ]}
        >
            {editing && (
                <View
                    style={[
                        styles.editBanner,
                        {
                            borderLeftColor: colors.primary,
                            backgroundColor: colors.surfaceVariant
                        }
                    ]}
                >
                    <View style={styles.editBannerText}>
                        <Text style={[styles.editLabel, { color: colors.primary }]}>
                            Editing message
                        </Text>
                        <Text
                            style={[styles.editPreview, { color: colors.onSurfaceVariant }]}
                            numberOfLines={1}
                        >
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
                style={[styles.input, { backgroundColor: surface }]}
                right={
                    <TextInput.Icon
                        icon={editing ? 'check' : 'send'}
                        disabled={!message.trim()}
                        onPress={handleSend}
                        color={message.trim() ? colors.primary : colors.onSurfaceDisabled}
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
        borderTopWidth: 1
    },
    input: {
        maxHeight: 100
    },
    editBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        marginBottom: 4,
        borderLeftWidth: 3,
        borderRadius: 4
    },
    editBannerText: {
        flex: 1
    },
    editLabel: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    editPreview: {
        fontSize: 13
    }
});

export default ChatInput;
