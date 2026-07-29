import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Badge, Portal, Dialog, Button, Divider, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useNotifications from '../hooks/useNotifications';

const ICON_BY_TYPE = {
    'order:new': 'cart-plus',
    'order:status': 'progress-clock'
};

const formatWhen = (at) => {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';

    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffMin < 60 * 24) return `hace ${Math.round(diffMin / 60)} h`;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

// Campana con el contador de avisos sin leer. Se coloca en el Appbar.
const NotificationsBell = ({ onOpenOrder }) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const { notifications, unread, markRead, markAllRead, reload } = useNotifications();

    const open = () => {
        setVisible(true);
        reload();
    };

    return (
        <>
            <TouchableOpacity onPress={open} style={styles.bellButton} accessibilityLabel="Avisos">
                <Icon name="bell-outline" size={24} color={theme.colors.onSurface} />
                {unread > 0 && (
                    <Badge style={styles.badge} size={18}>
                        {unread > 99 ? '99+' : unread}
                    </Badge>
                )}
            </TouchableOpacity>

            <Portal>
                <Dialog visible={visible} onDismiss={() => setVisible(false)}>
                    <Dialog.Title>Avisos</Dialog.Title>
                    <Dialog.ScrollArea style={styles.scrollArea}>
                        {notifications.length === 0 ? (
                            <View style={styles.empty}>
                                <Icon name="bell-sleep-outline" size={40} color={theme.colors.outline} />
                                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                    No tienes avisos
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={notifications}
                                keyExtractor={(item) => item._id}
                                ItemSeparatorComponent={Divider}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.row}
                                        onPress={() => {
                                            markRead(item._id);
                                            if (item.orderId && onOpenOrder) {
                                                setVisible(false);
                                                onOpenOrder(item.orderId);
                                            }
                                        }}
                                    >
                                        <Icon
                                            name={ICON_BY_TYPE[item.type] || 'information-outline'}
                                            size={22}
                                            color={item.read ? theme.colors.outline : theme.colors.primary}
                                        />
                                        <View style={styles.rowText}>
                                            <Text style={[styles.title, !item.read && styles.titleUnread]}>
                                                {item.title}
                                            </Text>
                                            <Text
                                                style={[styles.body, { color: theme.colors.onSurfaceVariant }]}
                                                numberOfLines={2}
                                            >
                                                {item.body}
                                            </Text>
                                            <Text style={[styles.when, { color: theme.colors.outline }]}>
                                                {formatWhen(item.createdAt)}
                                            </Text>
                                        </View>
                                        {!item.read && <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        {unread > 0 && <Button onPress={markAllRead}>Marcar todo leido</Button>}
                        <Button onPress={() => setVisible(false)}>Cerrar</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </>
    );
};

const styles = StyleSheet.create({
    bellButton: { padding: 10, marginRight: 4 },
    badge: { position: 'absolute', top: 4, right: 2 },
    scrollArea: { maxHeight: 380, paddingHorizontal: 0 },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
    rowText: { flex: 1 },
    title: { fontSize: 14 },
    titleUnread: { fontWeight: 'bold' },
    body: { fontSize: 13, marginTop: 2 },
    when: { fontSize: 11, marginTop: 3 },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { marginTop: 10, fontSize: 15 }
});

export default NotificationsBell;
