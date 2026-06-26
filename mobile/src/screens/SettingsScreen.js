import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import {
    Avatar,
    Text,
    List,
    Divider,
    Appbar,
    Switch,
    SegmentedButtons,
    useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { setAppLanguage } from '../i18n';
import MirrorButton from '../components/MirrorButton';

const SettingsScreen = () => {
    const { user, logout, updateAvatar } = useAuth();
    const { isDark, mode, setThemeMode, palette, setThemePalette, palettes } = useThemeMode();
    const theme = useTheme();
    const { t, i18n } = useTranslation();

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
                Alert.alert(t('common.error'), t('settings.couldNotReadImage'));
                return;
            }
            const dataUri = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
            setUploadingPhoto(true);
            await updateAvatar(dataUri);
        } catch (e) {
            Alert.alert(t('common.error'), e.message || t('settings.couldNotUpdatePhoto'));
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('settings.logout'),
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
            t('settings.clearCacheTitle'),
            t('settings.clearCacheConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.clear'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                            const keys = await AsyncStorage.getAllKeys();
                            const msgKeys = keys.filter((k) => k.startsWith('messages_'));
                            if (msgKeys.length) {
                                await AsyncStorage.multiRemove(msgKeys);
                            }
                            Alert.alert(t('common.done'), t('settings.cacheCleared'));
                        } catch (e) {
                            Alert.alert(t('common.error'), t('settings.couldNotClearCache'));
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.Content title={t('settings.title')} />
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
                    <Text style={styles.username}>{user?.username || t('common.unknownUser')}</Text>
                    <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>
                        {uploadingPhoto ? t('settings.uploadingPhoto') : user?.email || ''}
                    </Text>
                </View>

                <Divider />

                <List.Section>
                    <List.Subheader>{t('settings.appearance')}</List.Subheader>
                    <List.Item
                        title={t('settings.theme')}
                        description={
                            mode === 'system'
                                ? t('settings.systemTheme', { mode: isDark ? t('settings.dark') : t('settings.light') })
                                : isDark ? t('settings.dark') : t('settings.light')
                        }
                        left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                    />
                    <View style={styles.segmentRow}>
                        <SegmentedButtons
                            value={mode}
                            onValueChange={setThemeMode}
                            buttons={[
                                { value: 'light', label: t('settings.modeLight'), icon: 'white-balance-sunny' },
                                { value: 'dark', label: t('settings.modeDark'), icon: 'moon-waning-crescent' },
                                { value: 'system', label: t('settings.modeSystem'), icon: 'cellphone' }
                            ]}
                        />
                    </View>
                    <List.Item
                        title={t('settings.colorTheme')}
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
                    <List.Subheader>{t('settings.language')}</List.Subheader>
                    <List.Item
                        title={t('settings.language')}
                        left={(props) => <List.Icon {...props} icon="translate" />}
                    />
                    <View style={styles.segmentRow}>
                        <SegmentedButtons
                            value={i18n.language}
                            onValueChange={setAppLanguage}
                            buttons={[
                                { value: 'es', label: 'Español' },
                                { value: 'en', label: 'English' }
                            ]}
                        />
                    </View>
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>{t('settings.notifications')}</List.Subheader>
                    <List.Item
                        title={t('settings.pushNotifications')}
                        description={t('settings.pushNotificationsDesc')}
                        left={(props) => <List.Icon {...props} icon="bell" />}
                        right={() => (
                            <Switch value={notifications} onValueChange={setNotifications} />
                        )}
                    />
                    <List.Item
                        title={t('settings.readReceipts')}
                        description={t('settings.readReceiptsDesc')}
                        left={(props) => <List.Icon {...props} icon="check-all" />}
                        right={() => (
                            <Switch value={readReceipts} onValueChange={setReadReceipts} />
                        )}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>{t('settings.account')}</List.Subheader>
                    <List.Item
                        title={t('settings.username')}
                        description={user?.username || '—'}
                        left={(props) => <List.Icon {...props} icon="account" />}
                    />
                    <List.Item
                        title={t('settings.email')}
                        description={user?.email || '—'}
                        left={(props) => <List.Icon {...props} icon="email" />}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>{t('settings.privacySecurity')}</List.Subheader>
                    <List.Item
                        title={t('settings.endToEndEncryption')}
                        description={t('settings.directMessagesSignal')}
                        left={(props) => <List.Icon {...props} icon="lock" />}
                    />
                    <List.Item
                        title={t('settings.clearCache')}
                        description={t('settings.clearCacheDesc')}
                        left={(props) => <List.Icon {...props} icon="delete-sweep" />}
                        onPress={handleClearCache}
                    />
                </List.Section>

                <Divider />

                <List.Section>
                    <List.Subheader>{t('settings.about')}</List.Subheader>
                    <List.Item
                        title={t('settings.version')}
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
                        {t('settings.logout')}
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
    segmentRow: {
        paddingHorizontal: 16,
        paddingBottom: 8
    },
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
