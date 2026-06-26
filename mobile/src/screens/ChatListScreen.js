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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
                            {item.avatar ? (
                                <Avatar.Image size={48} source={{ uri: item.avatar }} />
                            ) : (
                                <Avatar.Text
                                    size={48}
                                    label={item.username?.charAt(0).toUpperCase() || '?'}
                                />
                            )}
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
                        <Text style={[styles.memberCount, { color: theme.colors.onSurfaceVariant }]}>
                            {item.members?.length || 0}
                        </Text>
                    )}
                />
            </TouchableOpacity>
            <Divider />
        </>
    );

    const renderEmptyState = ({ icon, title, subtitle }) => (
        <View style={styles.emptyContainer}>
            <Icon name={icon} size={56} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                {title}
            </Text>
            {subtitle ? (
                <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Searchbar
                placeholder="Search users or groups..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchbar}
            />

            <View
                style={[
                    styles.tabs,
                    { borderBottomColor: theme.colors.outlineVariant || theme.colors.outline }
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.tab,
                        tab === 'direct' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
                    ]}
                    onPress={() => setTab('direct')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: theme.colors.onSurfaceVariant },
                            tab === 'direct' && { color: theme.colors.primary, fontWeight: 'bold' }
                        ]}
                    >
                        Direct Messages
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        tab === 'groups' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
                    ]}
                    onPress={() => setTab('groups')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: theme.colors.onSurfaceVariant },
                            tab === 'groups' && { color: theme.colors.primary, fontWeight: 'bold' }
                        ]}
                    >
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
                    contentContainerStyle={filteredUsers.length === 0 && styles.emptyListContent}
                    ListEmptyComponent={renderEmptyState({
                        icon: 'account-search-outline',
                        title: searchQuery ? 'No contacts found' : 'No contacts yet',
                        subtitle: searchQuery
                            ? 'Try a different name or email'
                            : 'People you can chat with will appear here'
                    })}
                />
            ) : (
                <FlatList
                    data={filteredGroups}
                    renderItem={renderGroup}
                    keyExtractor={(item) => item._id || item.id}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadData} />
                    }
                    contentContainerStyle={filteredGroups.length === 0 && styles.emptyListContent}
                    ListEmptyComponent={renderEmptyState({
                        icon: 'account-group-outline',
                        title: searchQuery ? 'No groups found' : 'No groups yet',
                        subtitle: searchQuery
                            ? 'Try a different group name'
                            : 'Tap + to create a new group'
                    })}
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
        flex: 1
    },
    searchbar: {
        margin: 8,
        elevation: 2
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center'
    },
    tabText: {
        fontSize: 14
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
        fontSize: 12,
        alignSelf: 'center'
    },
    emptyListContent: {
        flexGrow: 1
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32
    },
    emptyText: {
        fontSize: 17,
        fontWeight: '500',
        marginTop: 16,
        marginBottom: 6,
        textAlign: 'center'
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center'
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16
    }
});

export default ChatListScreen;
