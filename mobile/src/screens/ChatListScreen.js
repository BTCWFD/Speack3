import React, { useState, useEffect } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import {
    List,
    Avatar,
    Badge,
    Text,
    Searchbar,
    FAB,
    Divider,
    useTheme
} from 'react-native-paper';
import { format } from 'date-fns';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';
import { useAuth } from '../context/AuthContext';

const ChatListScreen = ({ navigation }) => {
    const { user } = useAuth();
    const theme = useTheme();
    const [chats, setChats] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('direct'); // 'direct' or 'groups'

    useEffect(() => {
        loadData();

        // Listen for new messages
        const unsubscribe = SocketService.onMessage(handleNewMessage);

        return () => unsubscribe();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, groupsData] = await Promise.all([
                ApiService.getUsers(),
                ApiService.getGroups()
            ]);

            setUsers(usersData);
            setGroups(groupsData);
        } catch (error) {
            console.error('Load data error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewMessage = (message) => {
        // Update chat list when new message arrives
        loadData();
    };

    const openChat = (contact) => {
        navigation.navigate('Chat', {
            contactId: contact._id || contact.id,
            contactName: contact.username,
            contactOnline: contact.online
        });
    };

    const openGroupChat = (group) => {
        navigation.navigate('GroupChat', {
            groupId: group._id || group.id,
            groupName: group.name,
            members: group.members
        });
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = groups.filter(g =>
        g.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderUser = ({ item }) => (
        <>
            <TouchableOpacity onPress={() => openChat(item)}>
                <List.Item
                    title={item.username}
                    description={item.email}
                    left={() => (
                        <View>
                            <Avatar.Text
                                size={48}
                                label={item.username?.charAt(0).toUpperCase() || '?'}
                            />
                            {item.online && (
                                <Badge
                                    size={12}
                                    style={styles.onlineBadge}
                                />
                            )}
                        </View>
                    )}
                    right={() => (
                        item.online ? (
                            <Text style={styles.onlineText}>Online</Text>
                        ) : null
                    )}
                />
            </TouchableOpacity>
            <Divider />
        </>
    );

    const renderGroup = ({ item }) => (
        <>
            <TouchableOpacity onPress={() => openGroupChat(item)}>
                <List.Item
                    title={item.name}
                    description={`${item.members?.length || 0} members`}
                    left={() => (
                        <Avatar.Icon
                            size={48}
                            icon="account-group"
                        />
                    )}
                    right={() => (
                        <Text style={styles.memberCount}>
                            {item.members?.length || 0}
                        </Text>
                    )}
                />
            </TouchableOpacity>
            <Divider />
        </>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Searchbar
                placeholder="Search users or groups..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchbar}
            />

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'direct' && styles.activeTab]}
                    onPress={() => setTab('direct')}
                >
                    <Text style={[styles.tabText, tab === 'direct' && styles.activeTabText]}>
                        Direct Messages
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, tab === 'groups' && styles.activeTab]}
                    onPress={() => setTab('groups')}
                >
                    <Text style={[styles.tabText, tab === 'groups' && styles.activeTabText]}>
                        Groups
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === 'direct' ? (
                <FlatList
                    data={filteredUsers}
                    renderItem={renderUser}
                    keyExtractor={(item) => item._id || item.id}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadData} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No contacts found</Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={filteredGroups}
                    renderItem={renderGroup}
                    keyExtractor={(item) => item._id || item.id}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadData} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No groups yet</Text>
                            <Text style={styles.emptySubtext}>
                                Tap + to create a new group
                            </Text>
                        </View>
                    }
                />
            )}

            {tab === 'groups' && (
                <FAB
                    icon="plus"
                    style={styles.fab}
                    onPress={() => navigation.navigate('CreateGroup')}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    searchbar: {
        margin: 8,
        elevation: 2
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0'
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center'
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#6200ee'
    },
    tabText: {
        fontSize: 14,
        color: '#666'
    },
    activeTabText: {
        color: '#6200ee',
        fontWeight: 'bold'
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#4caf50'
    },
    onlineText: {
        color: '#4caf50',
        fontSize: 12,
        alignSelf: 'center'
    },
    memberCount: {
        color: '#666',
        fontSize: 12,
        alignSelf: 'center'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginBottom: 8
    },
    emptySubtext: {
        fontSize: 14,
        color: '#ccc'
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16
    }
});

export default ChatListScreen;
