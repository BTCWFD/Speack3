import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
    Avatar,
    Text,
    List,
    Button,
    Divider,
    Appbar
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const SettingsScreen = () => {
    const { user, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

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

    return (
        <View style={styles.container}>
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
                    <Text style={styles.email}>{user?.email || ''}</Text>
                </View>

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
                    <List.Subheader>Security</List.Subheader>
                    <List.Item
                        title="End-to-end encryption"
                        description="Direct messages are encrypted with Signal Protocol"
                        left={(props) => <List.Icon {...props} icon="lock" />}
                    />
                </List.Section>

                <View style={styles.logoutContainer}>
                    <Button
                        mode="contained"
                        buttonColor="#d32f2f"
                        icon="logout"
                        onPress={handleLogout}
                        loading={loggingOut}
                        disabled={loggingOut}
                    >
                        Log out
                    </Button>
                </View>

                <Text style={styles.version}>Speack3 · v1.0.0</Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    profile: { alignItems: 'center', paddingVertical: 24 },
    username: { fontSize: 20, fontWeight: 'bold', marginTop: 12 },
    email: { fontSize: 14, color: '#666', marginTop: 4 },
    logoutContainer: { padding: 16 },
    version: { textAlign: 'center', color: '#bbb', marginBottom: 24 }
});

export default SettingsScreen;
