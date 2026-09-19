const fs = require('fs');
let code = fs.readFileSync('mobile/src/components/MessageBubble.js', 'utf8');

// Add Image from react-native
code = code.replace(
    `import { View, StyleSheet, Pressable } from 'react-native';`,
    `import { View, StyleSheet, Pressable, Image, TouchableOpacity, Linking } from 'react-native';`
);

// Add state for MediaCryptoService decrypted URLs
code = code.replace(
    `const [menuVisible, setMenuVisible] = useState(false);`,
    `const [menuVisible, setMenuVisible] = useState(false);
    const [decryptedMediaUrl, setDecryptedMediaUrl] = useState(null);
    const [mediaError, setMediaError] = useState(false);`
);

// Add useEffect to decrypt media if needed
code = code.replace(
    `const { colors } = theme;`,
    `const { colors } = theme;
    
    let isMedia = false;
    let mediaData = null;
    try {
        if (message.content && message.content.startsWith('{"__speack3_media"')) {
            mediaData = JSON.parse(message.content);
            isMedia = true;
        }
    } catch (e) {}`
);

const renderBodyOld = `    const renderBody = () => {
        if (message.deleted) {
            return (
                <Text style={[styles.deletedText, { color: textColor }]}>
                    {t('message.deleted')}
                </Text>
            );
        }

        return (
            <Text style={[styles.messageText, { color: textColor }]}>
                {message.content}
            </Text>
        );
    };`;

const renderBodyNew = `    const renderBody = () => {
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
            }
        }

        return (
            <Text style={[styles.messageText, { color: textColor }]}>
                {message.content}
            </Text>
        );
    };`;

code = code.replace(renderBodyOld, renderBodyNew);

// Add Pinned icon if pinned
const metaOld = `                            <View style={styles.metadata}>
                                {message.edited && !message.deleted && (`;

const metaNew = `                            <View style={styles.metadata}>
                                {message.pinned && (
                                    <Icon name="pin" size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                                )}
                                {message.edited && !message.deleted && (`;

code = code.replace(metaOld, metaNew);

// Add styles
const stylesOld = `    statusIcon: {
        marginLeft: 4
    }
});`;

const stylesNew = `    statusIcon: {
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
});`;

code = code.replace(stylesOld, stylesNew);

fs.writeFileSync('mobile/src/components/MessageBubble.js', code);
