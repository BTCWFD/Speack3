import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
    Appbar,
    Avatar,
    Text,
    List,
    Divider,
    Button,
    Checkbox,
    ActivityIndicator,
    IconButton,
    Portal,
    Dialog,
    useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import { useAuth } from '../context/AuthContext';

// Group members and the current user are referenced by their record id.
// AuthContext exposes it as `user.id`; user records from the API use `_id`.
const idOf = (entity) => entity?._id || entity?.id;

const GroupInfoScreen = ({ route, navigation }) => {
    const { groupId, groupName } = route.params;
    const { user } = useAuth();
    const theme = useTheme();
    const { t } = useTranslation();

    const [group, setGroup] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    // Add-members dialog state
    const [addVisible, setAddVisible] = useState(false);
    const [selected, setSelected] = useState(new Set());

    useEffect(() => {
        loadData();
    }, [groupId]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [groupData, userData] = await Promise.all([
                ApiService.getGroupById(groupId),
                ApiService.getUsers()
            ]);
            setGroup(groupData);
            setUsers(userData || []);
        } catch (err) {
            setError(err.message || t('group.couldNotLoad'));
        } finally {
            setLoading(false);
        }
    };

    const memberIds = group?.members || [];
    const isAdmin = !!group && group.admin === idOf(user);

    const usersById = users.reduce((acc, u) => {
        acc[idOf(u)] = u;
        return acc;
    }, {});

    const members = memberIds.map((mid) => usersById[mid] || { _id: mid, username: t('group.unknown') });

    const handleRemove = (member) => {
        const memberId = idOf(member);
        Alert.alert(
            t('group.removeMember'),
            t('group.removeConfirm', { name: member.username || t('group.thisMember') }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        try {
                            await ApiService.removeGroupMember(groupId, memberId);
                            await loadData();
                        } catch (err) {
                            Alert.alert(t('common.error'), err.message || t('group.couldNotRemove'));
                        } finally {
                            setBusy(false);
                        }
                    }
                }
            ]
        );
    };

    const toggleSelected = (userId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    const openAddDialog = () => {
        setSelected(new Set());
        setAddVisible(true);
    };

    const handleAddMembers = async () => {
        if (selected.size < 1) {
            setAddVisible(false);
            return;
        }
        setBusy(true);
        try {
            const newIds = Array.from(selected);
            await ApiService.addGroupMembers(groupId, newIds);
            // Share the existing group key with the newly added members.
            try {
                const key = await SocketService.getOrCreateGroupKey(groupId, memberIds);
                await SocketService.distributeGroupKey(groupId, key, newIds);
            } catch (keyErr) {
                console.error('Group key share error:', keyErr);
            }
            setAddVisible(false);
            await loadData();
        } catch (err) {
            Alert.alert(t('common.error'), err.message || t('group.couldNotAdd'));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            t('group.deleteGroupTitle'),
            t('group.deleteGroupConfirm', { name: group?.name || groupName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        try {
                            await ApiService.deleteGroup(groupId);
                            navigation.goBack();
                        } catch (err) {
                            Alert.alert(t('common.error'), err.message || t('group.couldNotDelete'));
                            setBusy(false);
                        }
                    }
                }
            ]
        );
    };

    // Users eligible to be added: everyone not already a member.
    const candidates = users.filter((u) => !memberIds.includes(idOf(u)));

    const renderMember = ({ item }) => {
        const memberId = idOf(item);
        const isMemberAdmin = group?.admin === memberId;
        return (
            <>
                <List.Item
                    title={item.username || t('group.unknown')}
                    description={isMemberAdmin ? t('group.admin') : item.email}
                    onPress={() =>
                        navigation.navigate('Profile', {
                            userId: memberId,
                            username: item.username
                        })
                    }
                    left={() => (
                        <Avatar.Text
                            size={40}
                            label={item.username?.charAt(0).toUpperCase() || '?'}
                        />
                    )}
                    right={() =>
                        isAdmin && !isMemberAdmin ? (
                            <IconButton
                                icon="account-remove"
                                disabled={busy}
                                onPress={() => handleRemove(item)}
                            />
                        ) : null
                    }
                />
                <Divider />
            </>
        );
    };

    const renderCandidate = ({ item }) => {
        const id = idOf(item);
        return (
            <>
                <List.Item
                    title={item.username}
                    description={item.email}
                    onPress={() => toggleSelected(id)}
                    left={() => (
                        <Avatar.Text
                            size={40}
                            label={item.username?.charAt(0).toUpperCase() || '?'}
                        />
                    )}
                    right={() => (
                        <Checkbox status={selected.has(id) ? 'checked' : 'unchecked'} />
                    )}
                />
                <Divider />
            </>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content
                    title={group?.name || groupName}
                    subtitle={t('group.members', { count: memberIds.length })}
                />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator style={styles.loader} size="large" />
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button mode="contained" onPress={loadData} style={styles.retry}>
                        {t('common.retry')}
                    </Button>
                </View>
            ) : (
                <>
                    <FlatList
                        data={members}
                        renderItem={renderMember}
                        keyExtractor={(item) => idOf(item)}
                        ListHeaderComponent={
                            <Text style={styles.sectionLabel}>
                                {t('group.membersCount', { count: memberIds.length })}
                            </Text>
                        }
                        ListEmptyComponent={
                            <Text style={styles.empty}>{t('group.noMembers')}</Text>
                        }
                    />

                    {isAdmin && (
                        <View style={styles.adminActions}>
                            <Button
                                mode="contained"
                                icon="account-plus"
                                onPress={openAddDialog}
                                disabled={busy || candidates.length === 0}
                                style={styles.actionButton}
                            >
                                {t('group.addMembers')}
                            </Button>
                            <Button
                                mode="contained"
                                icon="delete"
                                buttonColor="#d32f2f"
                                onPress={handleDeleteGroup}
                                disabled={busy}
                                style={styles.actionButton}
                            >
                                {t('group.deleteGroup')}
                            </Button>
                        </View>
                    )}
                </>
            )}

            <Portal>
                <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
                    <Dialog.Title>{t('group.addMembers')}</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <FlatList
                            data={candidates}
                            renderItem={renderCandidate}
                            keyExtractor={(item) => idOf(item)}
                            ListEmptyComponent={
                                <Text style={styles.empty}>{t('group.noUsersToAdd')}</Text>
                            }
                        />
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setAddVisible(false)}>{t('common.cancel')}</Button>
                        <Button
                            onPress={handleAddMembers}
                            loading={busy}
                            disabled={busy || selected.size === 0}
                        >
                            {t('group.addCount', { count: selected.size })}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loader: { marginTop: 48 },
    errorContainer: { padding: 24, alignItems: 'center' },
    errorText: { color: '#d32f2f', textAlign: 'center', marginBottom: 16 },
    retry: { marginTop: 8 },
    sectionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        padding: 12
    },
    empty: { textAlign: 'center', color: '#999', marginTop: 24 },
    adminActions: { padding: 12 },
    actionButton: { marginBottom: 8 },
    dialogArea: { paddingHorizontal: 0, maxHeight: 360 }
});

export default GroupInfoScreen;
