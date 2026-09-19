import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

const ChatInput = ({
    onSend,
    onTyping,
    placeholder,
    editing = null,
    onCancelEdit,
    onAttachmentPress,
    onRecordStart,
    onRecordStop
}) => {
    const [message, setMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const typingTimeoutRef = useRef(null);
    const { colors } = useTheme();
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('chatInput.typeMessage');
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

    const handleRecordStart = () => {
        setIsRecording(true);
        if (onRecordStart) onRecordStart();
    };

    const handleRecordStop = () => {
        setIsRecording(false);
        if (onRecordStop) onRecordStop();
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
                            {t('chatInput.editingMessage')}
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

            <View style={styles.inputRow}>
                <IconButton
                    icon="paperclip"
                    size={24}
                    onPress={onAttachmentPress}
                    iconColor={colors.primary}
                />

                <TextInput
                    value={isRecording ? 'Grabando audio...' : message}
                    onChangeText={handleMessageChange}
                    placeholder={editing ? t('chatInput.editMessage') : resolvedPlaceholder}
                    mode="outlined"
                    multiline
                    maxLength={1000}
                    disabled={isRecording}
                    style={[styles.input, { backgroundColor: surface }]}
                />

                {(message.trim() || editing) ? (
                    <IconButton
                        icon={editing ? 'check' : 'send'}
                        size={24}
                        onPress={handleSend}
                        iconColor={colors.primary}
                    />
                ) : (
                    <IconButton
                        icon="microphone"
                        size={24}
                        onPressIn={handleRecordStart}
                        onPressOut={handleRecordStop}
                        iconColor={isRecording ? colors.error : colors.primary}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
        borderTopWidth: 1
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        width: '100%',
    },
    input: {
        flex: 1,
        maxHeight: 100,
        marginHorizontal: 4,
        paddingBottom: 4
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
