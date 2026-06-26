import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import {
    Avatar,
    Text,
    List,
    Divider,
    Appbar,
    Switch,
    useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import MirrorButton from '../components/MirrorButton';

const SettingsScreen = () => {
    const { user, logout, updateAvatar } = useAuth();
    const { isDark, toggleTheme, palette, setThemePalette, palettes } = useThemeMode();
    const theme = useTheme();

    const [loggingOut, setLoggingOut] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [readReceipts, setReadReceipts] = useState(true);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const handlePickPhoto = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                includeBase64: true,
                maxWidth: 512,
                maxHeight: 512,
                quality: 0.7
            });
            if (result.didCancel || !result.assets || !result.assets.length) {
                return;
            }
            const asset = result.assets[0];
            if (!asset.base64) {
                Alert.alert('Error', 'Could not read the selected image.');
                return;
            }
            const dataUri = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
            setUploadingPhoto(true);
            await updateAvatar(dataUri);
        } catch (e) {
            Alert.alert('Error', e.message || 'Could not update photo.');
        } finally {
            setUploadingPhoto(false);
        }
    };

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
                    <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto}>
                        <View>
                            {user?.avatar ? (
                                <Avatar.Image size={88} source={{ uri: user.avatar }} />
                            ) : (
                                <Avatar.Text
                                    size={88}
                                    label={user?.username?.charAt(0).toUpperCase() || '?'}
                                />
                            )}
                            <View
                                style={[
                                    styles.cameraBadge,
                                    { backgroundColor: theme.colors.primary }
                                ]}
                            >
                                <Icon name="camera" size={18} color="#fff" />
                            </View>
                        </View>
                    </Pressable>
                    <Text style={styles.username}>{user?.username || 'Unknown user'}</Text>
                    <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>
                        {uploadingPhoto ? 'Uploading photo…' : user?.email || ''}
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
                    <List.Item
                        title="Color theme"
                        description={palettes[palette]?.name}
                        left={(props) => <List.Icon {...props} icon="palette" />}
                    />
                    <View style={styles.swatchRow}>
                        {Object.keys(palettes).map((key) => {
                            const c = palettes[key][isDark ? 'dark' : 'light'];
                            const selected = key === palette;
                            return (
                                <Pressable
                                    key={key}
                                    onPress={() => setThemePalette(key)}
                                    style={[
                                        styles.swatch,
                                        { backgroundColor: c },
                                        selected && {
                                            borderColor: theme.colors.onSurface,
                                            borderWidth: 3
                                        }
                                    ]}
                                >
                                    {selected ? (
                                        <Icon name="check" size={20} color="#fff" />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
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
                    <MirrorButton
                        icon="logout"
                        color={theme.colors.error}
                        onPress={handleLogout}
                        loading={loggingOut}
                        disabled={loggingOut}
                    >
                        Log out
                    </MirrorButton>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    profile: { alignItems: 'center', paddingVertical: 24 },
    cameraBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)'
    },
    username: { fontSize: 20, fontWeight: 'bold', marginTop: 12 },
    email: { fontSize: 14, marginTop: 4 },
    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 14
    },
    swatch: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: 'rgba(0,0,0,0.15)',
        borderWidth: 1
    },
    logoutContainer: { padding: 16, paddingBottom: 32 }
});

export default SettingsScreen;
