import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
    TextInput,
    Button,
    List,
    Avatar,
    Checkbox,
    Text,
    Divider,
    Appbar,
    ActivityIndicator,
    useTheme
} from 'react-native-paper';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';

const CreateGroupScreen = ({ navigation }) => {
    const theme = useTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [users, setUsers] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await ApiService.getUsers();
            setUsers(data || []);
        } catch (error) {
            Alert.alert('Error', error.message || 'Could not load users');
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = (userId) => {
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

    const handleCreate = async () => {
        const trimmedName = name.trim();
        if (trimmedName.length < 1) {
            Alert.alert('Validation', 'Group name is required');
            return;
        }
        if (selected.size < 1) {
            Alert.alert('Validation', 'Select at least one member');
            return;
        }

        setCreating(true);
        try {
            const group = await ApiService.createGroup({
                name: trimmedName,
                description: description.trim(),
                members: Array.from(selected)
            });
            // Generate the group encryption key and hand it to every member
            // over their pairwise Signal session.
            try {
                const gid = group?._id || group?.id;
                if (gid) {
                    await SocketService.getOrCreateGroupKey(gid, group?.members || []);
                }
            } catch (keyErr) {
                console.error('Group key setup error:', keyErr);
            }
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', error.message || 'Could not create group');
        } finally {
            setCreating(false);
        }
    };

    const renderUser = ({ item }) => {
        const id = item._id || item.id;
        return (
            <>
                <List.Item
                    title={item.username}
                    description={item.email}
                    onPress={() => toggleMember(id)}
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
                <Appbar.Content title="New Group" />
            </Appbar.Header>

            <View style={styles.form}>
                <TextInput
                    label="Group name"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    maxLength={50}
                    style={styles.input}
                />
                <TextInput
                    label="Description (optional)"
                    value={description}
                    onChangeText={setDescription}
                    mode="outlined"
                    style={styles.input}
                />
                <Text style={styles.sectionLabel}>
                    Members ({selected.size} selected)
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} />
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUser}
                    keyExtractor={(item) => item._id || item.id}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No users available</Text>
                    }
                />
            )}

            <Button
                mode="contained"
                onPress={handleCreate}
                loading={creating}
                disabled={creating}
                style={styles.createButton}
            >
                Create Group
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    form: { padding: 12 },
    input: { marginBottom: 12 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#666', marginTop: 4 },
    loader: { marginTop: 24 },
    empty: { textAlign: 'center', color: '#999', marginTop: 24 },
    createButton: { margin: 12 }
});

export default CreateGroupScreen;
