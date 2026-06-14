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
    Dialog
} from 'react-native-paper';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import { useAuth } from '../context/AuthContext';

// Group members and the current user are referenced by their record id.
// AuthContext exposes it as `user.id`; user records from the API use `_id`.
const idOf = (entity) => entity?._id || entity?.id;

const GroupInfoScreen = ({ route, navigation }) => {
    const { groupId, groupName } = route.params;
    const { user } = useAuth();

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
            setError(err.message || 'Could not load group');
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

    const members = memberIds.map((mid) => usersById[mid] || { _id: mid, username: 'Unknown' });

    const handleRemove = (member) => {
        const memberId = idOf(member);
        Alert.alert(
            'Remove member',
            `Remove ${member.username || 'this member'} from the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        try {
                            await ApiService.removeGroupMember(groupId, memberId);
                            await loadData();
                        } catch (err) {
                            Alert.alert('Error', err.message || 'Could not remove member');
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
            Alert.alert('Error', err.message || 'Could not add members');
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            'Delete group',
            `Delete "${group?.name || groupName}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        try {
                            await ApiService.deleteGroup(groupId);
                            navigation.goBack();
                        } catch (err) {
                            Alert.alert('Error', err.message || 'Could not delete group');
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
                    title={item.username || 'Unknown'}
                    description={isMemberAdmin ? 'Admin' : item.email}
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
        <View style={styles.container}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content
                    title={group?.name || groupName}
                    subtitle={`${memberIds.length} members`}
                />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator style={styles.loader} size="large" />
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button mode="contained" onPress={loadData} style={styles.retry}>
                        Retry
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
                                Members ({memberIds.length})
                            </Text>
                        }
                        ListEmptyComponent={
                            <Text style={styles.empty}>No members</Text>
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
                                Add members
                            </Button>
                            <Button
                                mode="contained"
                                icon="delete"
                                buttonColor="#d32f2f"
                                onPress={handleDeleteGroup}
                                disabled={busy}
                                style={styles.actionButton}
                            >
                                Delete group
                            </Button>
                        </View>
                    )}
                </>
            )}

            <Portal>
                <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
                    <Dialog.Title>Add members</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <FlatList
                            data={candidates}
                            renderItem={renderCandidate}
                            keyExtractor={(item) => idOf(item)}
                            ListEmptyComponent={
                                <Text style={styles.empty}>No users to add</Text>
                            }
                        />
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setAddVisible(false)}>Cancel</Button>
                        <Button
                            onPress={handleAddMembers}
                            loading={busy}
                            disabled={busy || selected.size === 0}
                        >
                            Add ({selected.size})
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
