const fs = require('fs');

const addBanner = (filePath) => {
    let code = fs.readFileSync(filePath, 'utf8');

    // Add pinnedMessage
    const renderEmptyOld = `    const renderEmpty = () => (`;
    const renderEmptyNew = `    const pinnedMessage = messages.slice().reverse().find(m => m.pinned);
    
    const renderEmpty = () => (`;
    code = code.replace(renderEmptyOld, renderEmptyNew);

    // Render banner
    const bannerOld = `            </Appbar.Header>

            <View style={styles.messagesContainer}>`;
    const bannerNew = `            </Appbar.Header>

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

            <View style={styles.messagesContainer}>`;
    code = code.replace(bannerOld, bannerNew);

    // Add banner styles
    const stylesOld = `    headerContent: {
        flex: 1
    },`;
    const stylesNew = `    headerContent: {
        flex: 1
    },
    pinnedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderLeftWidth: 4,
        elevation: 2,
        zIndex: 10
    },`;
    code = code.replace(stylesOld, stylesNew);

    fs.writeFileSync(filePath, code);
};

addBanner('mobile/src/screens/ChatScreen.js');
addBanner('mobile/src/screens/GroupChatScreen.js');
