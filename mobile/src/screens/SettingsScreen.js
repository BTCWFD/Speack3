import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
    Avatar,
    Text,
    List,
    Button,
    Divider,
    Appbar,
    Switch,
    useTheme
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import StorageService from '../services/StorageService';

const SettingsScreen = () => {
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useThemeMode();
    const theme = useTheme();

    const [loggingOut, setLoggingOut] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [readReceipts, setReadReceipts] = useState(true);

    const handleLogout = () => {
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    setLoggingOut(true);
                    try {
                        await logout();
                    } finally {
                        setLoggingOut(false);
                    }
                }
            }
        ]);
    };

    const handleClearCache = () => {
        Alert.alert(
            'Clear message cache',
            'This removes locally cached messages on this device. Your account and keys are kept.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                            const keys = await AsyncStorage.getAllKeys();
                            const msgKeys = keys.filter((k) => k.startsWith('messages_'));
                            if (msgKeys.length) {
                                await AsyncStorage.multiRemove(msgKeys);
                            }
                            Alert.alert('Done', 'Message cache cleared.');
                        } catch (e) {
                            Alert.alert('Error', 'Could not clear cache.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.Content title="Settings" />
            </Appbar.Header>

            <ScrollView>
                <View style={styles.profile}>
                    <Avatar.Text
                        size={72}
                        label={user?.username?.charAt(0).toUpperCase() || '?'}
                    />
                    <Text style={styles.username}>{user?.username || 'Unknown user'}</Text>
                    <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>
                        {user?.email || ''}
                    </Text>
                </View>

                <Divider />

                <List.Section>
                    <List.Subheader>Appearance</List.Subheader>
                    <List.Item
                        title="Dark mode"
                        description={isDark ? 'On' : 'Off'}
                        left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                        right={() => <Switch value={isDark} onValueChange={toggleTheme} />}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>Notifications</List.Subheader>
                    <List.Item
                        title="Push notifications"
                        description="Notify me about new messages"
                        left={(props) => <List.Icon {...props} icon="bell" />}
                        right={() => (
                            <Switch value={notifications} onValueChange={setNotifications} />
                        )}
                    />
                    <List.Item
                        title="Read receipts"
                        description="Let others know when you've read messages"
                        left={(props) => <List.Icon {...props} icon="check-all" />}
                        right={() => (
                            <Switch value={readReceipts} onValueChange={setReadReceipts} />
                        )}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>Account</List.Subheader>
                    <List.Item
                        title="Username"
                        description={user?.username || '—'}
                        left={(props) => <List.Icon {...props} icon="account" />}
                    />
                    <List.Item
                        title="Email"
                        description={user?.email || '—'}
                        left={(props) => <List.Icon {...props} icon="email" />}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>Privacy & security</List.Subheader>
                    <List.Item
                        title="End-to-end encryption"
                        description="Direct messages use the Signal Protocol"
                        left={(props) => <List.Icon {...props} icon="lock" />}
                    />
                    <List.Item
                        title="Clear message cache"
                        description="Remove locally cached messages"
                        left={(props) => <List.Icon {...props} icon="delete-sweep" />}
                        onPress={handleClearCache}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>About</List.Subheader>
                    <List.Item
                        title="Version"
                        description="Speack3 1.0.0"
                        left={(props) => <List.Icon {...props} icon="information" />}
                    />
                </List.Section>

                <View style={styles.logoutContainer}>
                    <Button
                        mode="contained"
                        buttonColor={theme.colors.error}
                        icon="logout"
                        onPress={handleLogout}
                        loading={loggingOut}
                        disabled={loggingOut}
                    >
                        Log out
                    </Button>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    profile: { alignItems: 'center', paddingVertical: 24 },
    username: { fontSize: 20, fontWeight: 'bold', marginTop: 12 },
    email: { fontSize: 14, marginTop: 4 },
    logoutContainer: { padding: 16, paddingBottom: 32 }
});

export default SettingsScreen;
