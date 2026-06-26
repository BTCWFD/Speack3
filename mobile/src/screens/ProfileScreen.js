import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
    Appbar,
    Avatar,
    Text,
    List,
    Divider,
    ActivityIndicator,
    Button,
    Chip,
    useTheme
} from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';
import SignalService from '../services/SignalService';

// Persistence key for "this peer's identity was verified by me".
const verifiedKey = (id) => `identity_verified_${id}`;

// Format a base64 identity key into spaced 5-char groups so the user can
// compare a short, deterministic fingerprint out-of-band. Purely read-only.
const formatFingerprint = (identityKeyPublic) => {
    if (!identityKeyPublic) {
        return 'Unavailable';
    }
    const cleaned = String(identityKeyPublic).replace(/[^A-Za-z0-9]/g, '');
    const groups = cleaned.match(/.{1,5}/g) || [];
    // Keep it short and readable - first 8 groups (40 chars) is plenty.
    return groups.slice(0, 8).join(' ');
};

const formatLastSeen = (lastSeen) => {
    if (!lastSeen) {
        return 'Offline';
    }
    try {
        return `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
    } catch (error) {
        return 'Offline';
    }
};

const ProfileScreen = ({ route, navigation }) => {
    const { userId, username } = route.params;
    const theme = useTheme();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Safety number derived from BOTH identity keys (local + remote).
    const [safetyNumber, setSafetyNumber] = useState(null);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [userId]);

    useEffect(() => {
        // Whether this peer was previously marked as verified (local only).
        let active = true;
        AsyncStorage.getItem(verifiedKey(userId))
            .then((value) => {
                if (active) {
                    setVerified(value === 'true');
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [userId]);

    const loadProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await ApiService.getUserById(userId);
            setProfile(data);

            // Combine the LOCAL identity key with the remote one so the number
            // actually identifies *this pair* of users and is comparable on the
            // other device. Failure here is non-fatal — the rest of the profile
            // still renders.
            try {
                const localKey = await SignalService.getLocalIdentityPublicBase64();
                const number = SignalService.computeSafetyNumber(
                    localKey,
                    data?.identityKeyPublic
                );
                setSafetyNumber(number);
            } catch (numberErr) {
                setSafetyNumber(null);
            }
        } catch (err) {
            setError(err.message || 'Could not load profile');
        } finally {
            setLoading(false);
        }
    };

    const toggleVerified = async () => {
        const next = !verified;
        setVerified(next);
        try {
            if (next) {
                await AsyncStorage.setItem(verifiedKey(userId), 'true');
            } else {
                await AsyncStorage.removeItem(verifiedKey(userId));
            }
        } catch (err) {
            // Revert optimistic UI on persistence failure.
            setVerified(!next);
        }
    };

    const displayName = profile?.username || username || 'Unknown user';

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Profile" />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator style={styles.loader} size="large" />
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button mode="contained" onPress={loadProfile} style={styles.retry}>
                        Retry
                    </Button>
                </View>
            ) : (
                <ScrollView>
                    <View style={styles.header}>
                        {profile?.avatar ? (
                            <Avatar.Image size={96} source={{ uri: profile.avatar }} />
                        ) : (
                            <Avatar.Text
                                size={96}
                                label={displayName.charAt(0).toUpperCase() || '?'}
                            />
                        )}
                        <Text style={styles.username}>{displayName}</Text>
                        <Text style={styles.email}>{profile?.email || ''}</Text>
                        <Chip
                            icon={profile?.online ? 'circle' : 'circle-outline'}
                            style={[
                                styles.statusChip,
                                profile?.online ? styles.onlineChip : styles.offlineChip
                            ]}
                            textStyle={styles.statusText}
                        >
                            {profile?.online ? 'Online' : formatLastSeen(profile?.lastSeen)}
                        </Chip>
                    </View>

                    <Divider />

                    <List.Section>
                        <List.Subheader>Account</List.Subheader>
                        <List.Item
                            title="Username"
                            description={profile?.username || '—'}
                            left={(props) => <List.Icon {...props} icon="account" />}
                        />
                        <List.Item
                            title="Email"
                            description={profile?.email || '—'}
                            left={(props) => <List.Icon {...props} icon="email" />}
                        />
                    </List.Section>

                    <Divider />

                    <List.Section>
                        <List.Subheader>Verify identity</List.Subheader>
                        <View style={styles.verifySection}>
                            <View style={styles.verifyHeaderRow}>
                                <Text
                                    variant="titleMedium"
                                    style={[styles.verifyTitle, { color: theme.colors.onSurface }]}
                                >
                                    Safety number
                                </Text>
                                {verified && (
                                    <Chip
                                        icon="check-decagram"
                                        compact
                                        style={[
                                            styles.verifiedChip,
                                            { backgroundColor: theme.colors.secondaryContainer }
                                        ]}
                                        textStyle={styles.statusText}
                                    >
                                        Verified
                                    </Chip>
                                )}
                            </View>

                            <Text
                                style={[
                                    styles.safetyNumber,
                                    { color: theme.colors.onSurface }
                                ]}
                                selectable
                            >
                                {safetyNumber || 'Unavailable'}
                            </Text>

                            <Text
                                style={[
                                    styles.verifyHint,
                                    { color: theme.colors.onSurfaceVariant }
                                ]}
                            >
                                {`Compara este número con ${displayName} en persona o por otro canal para confirmar que nadie intercepta.`}
                            </Text>

                            {safetyNumber && (
                                <Button
                                    mode={verified ? 'outlined' : 'contained'}
                                    icon={verified ? 'check-decagram' : 'shield-check'}
                                    onPress={toggleVerified}
                                    style={styles.verifyButton}
                                >
                                    {verified ? 'Verified — tap to undo' : 'Mark as verified'}
                                </Button>
                            )}
                        </View>
                    </List.Section>

                    <Divider />

                    <List.Section>
                        <List.Subheader>Security</List.Subheader>
                        <List.Item
                            title="Remote identity key"
                            description={formatFingerprint(profile?.identityKeyPublic)}
                            descriptionNumberOfLines={3}
                            descriptionStyle={styles.fingerprint}
                            left={(props) => <List.Icon {...props} icon="shield-key" />}
                        />
                        <List.Item
                            title="End-to-end encryption"
                            description="Messages are secured with the Signal Protocol"
                            left={(props) => <List.Icon {...props} icon="lock" />}
                        />
                    </List.Section>
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loader: { marginTop: 48 },
    errorContainer: { padding: 24, alignItems: 'center' },
    errorText: { color: '#d32f2f', textAlign: 'center', marginBottom: 16 },
    retry: { marginTop: 8 },
    header: { alignItems: 'center', paddingVertical: 24 },
    username: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
    email: { fontSize: 14, color: '#666', marginTop: 4 },
    statusChip: { marginTop: 12 },
    onlineChip: { backgroundColor: '#e8f5e9' },
    offlineChip: { backgroundColor: '#f0f0f0' },
    statusText: { fontSize: 12 },
    fingerprint: { fontFamily: 'monospace', letterSpacing: 1 },
    verifySection: { paddingHorizontal: 16, paddingBottom: 8 },
    verifyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    verifyTitle: { fontWeight: '600' },
    verifiedChip: { height: 28 },
    safetyNumber: {
        fontFamily: 'monospace',
        fontSize: 16,
        letterSpacing: 1,
        lineHeight: 26,
        marginTop: 12
    },
    verifyHint: { fontSize: 13, marginTop: 12, lineHeight: 18 },
    verifyButton: { marginTop: 16 }
});

export default ProfileScreen;
