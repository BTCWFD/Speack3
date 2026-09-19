const fs = require('fs');
let code = fs.readFileSync('mobile/src/components/MessageBubble.js', 'utf8');

const eventOld = `            } else if (type === 'file') {
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="file-document" size={36} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, marginLeft: 8 }]}>{filename}</Text>
                    </View>
                );
            }`;

const eventNew = `            } else if (type === 'file') {
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="file-document" size={36} color={textColor} />
                        <Text style={[styles.messageText, { color: textColor, marginLeft: 8 }]}>{filename}</Text>
                    </View>
                );
            } else if (type === 'event') {
                const { eventTitle, eventDate, eventTime } = mediaData;
                return (
                    <View style={[styles.mediaContainer, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 12, minWidth: 200, padding: 16 }]}>
                        <Icon name="calendar-clock" size={48} color={theme.colors.primary} />
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8, color: textColor }}>{eventTitle}</Text>
                        <Text style={{ fontSize: 14, marginTop: 4, color: textColor }}>📅 {eventDate}</Text>
                        {eventTime ? <Text style={{ fontSize: 14, marginTop: 4, color: textColor }}>⏰ {eventTime}</Text> : null}
                    </View>
                );
            } else if (type === 'contact') {
                const { contactName, contactUsername } = mediaData;
                return (
                    <View style={styles.mediaContainerRow}>
                        <Icon name="account-circle" size={48} color={theme.colors.primary} />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>{contactName}</Text>
                            <Text style={{ fontSize: 14, color: textColor }}>@{contactUsername}</Text>
                        </View>
                    </View>
                );
            }`;

code = code.replace(eventOld, eventNew);
fs.writeFileSync('mobile/src/components/MessageBubble.js', code);
