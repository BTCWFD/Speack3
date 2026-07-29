import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import {
    Text, Appbar, Card, Button, TextInput, Chip, Portal, Dialog,
    ActivityIndicator, Switch, Divider, useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

// Alta y control de vendedores. La cuenta la crea la persona; aqui solo se le
// habilita, porque manejar contrasenas de terceros no es cosa del admin.
const SellersScreen = ({ navigation }) => {
    const theme = useTheme();
    const [sellers, setSellers] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const [addVisible, setAddVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [picked, setPicked] = useState([]);
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [data, svc] = await Promise.all([
                ApiService.getSellers(),
                ApiService.getSellerServices()
            ]);
            setSellers(data.sellers || []);
            setServices(svc || []);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleService = (id) =>
        setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const addSeller = async () => {
        if (!email.trim()) {
            Alert.alert('Falta el correo', 'Escribe el correo con el que se registró.');
            return;
        }
        if (picked.length === 0) {
            Alert.alert('Falta el servicio', 'Marca al menos un servicio que pueda ofrecer.');
            return;
        }

        setAdding(true);
        try {
            const res = await ApiService.addSeller(email.trim().toLowerCase(), picked);
            setAddVisible(false);
            setEmail('');
            setPicked([]);
            await load();

            Alert.alert(
                'Vendedor habilitado',
                res.pendingLegalAcceptance
                    ? 'Todavía no puede vender: debe abrir la app y aceptar los términos y la política de privacidad.'
                    : 'Ya puede operar.'
            );
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setAdding(false);
        }
    };

    const setActive = async (seller, active) => {
        try {
            await ApiService.updateSeller(seller.id, { active });
            await load();
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    const confirmRemove = (seller) => {
        Alert.alert(
            'Quitar vendedor',
            `${seller.username} dejará de ser vendedor. Su cuenta sigue existiendo como comprador.`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Quitar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ApiService.removeSeller(seller.id);
                            await load();
                        } catch (error) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const labelFor = (id) => services.find((s) => s.id === id)?.label || id;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Vendedores" />
                <Appbar.Action icon="account-plus" onPress={() => setAddVisible(true)} />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator style={styles.loader} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
                >
                    {sellers.length === 0 ? (
                        <View style={styles.empty}>
                            <Icon name="account-group-outline" size={44} color={theme.colors.outline} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                Todavía no has habilitado vendedores
                            </Text>
                            <Text style={[styles.emptyHint, { color: theme.colors.outline }]}>
                                La persona debe registrarse primero en la app; luego la habilitas por su correo.
                            </Text>
                        </View>
                    ) : (
                        sellers.map((s) => (
                            <Card key={s.id} style={styles.card}>
                                <Card.Content>
                                    <View style={styles.headerRow}>
                                        <View style={styles.headerText}>
                                            <Text style={styles.username}>{s.username}</Text>
                                            <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>
                                                {s.email}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={s.sellerActive}
                                            onValueChange={(v) => setActive(s, v)}
                                        />
                                    </View>

                                    {/* Un vendedor que no acepto los documentos NO puede vender,
                                        asi que se avisa aqui y no cuando falle al intentarlo. */}
                                    {!s.legalUpToDate && (
                                        <View style={styles.warnRow}>
                                            <Icon name="alert-circle-outline" size={16} color="#FF9800" />
                                            <Text style={styles.warnText}>
                                                Pendiente de aceptar términos y privacidad
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.chipsRow}>
                                        {(s.services || []).map((id) => (
                                            <Chip key={id} compact style={styles.serviceChip}>
                                                {labelFor(id)}
                                            </Chip>
                                        ))}
                                    </View>

                                    <Divider style={styles.divider} />
                                    <Button
                                        mode="text"
                                        compact
                                        textColor={theme.colors.error}
                                        onPress={() => confirmRemove(s)}
                                    >
                                        Quitar vendedor
                                    </Button>
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>
            )}

            <Portal>
                <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
                    <Dialog.Title>Habilitar vendedor</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <ScrollView>
                            <Text style={[styles.dialogHint, { color: theme.colors.onSurfaceVariant }]}>
                                La persona debe haberse registrado ya en la app.
                            </Text>
                            <TextInput
                                mode="outlined"
                                label="Correo del usuario"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                dense
                                style={styles.input}
                            />

                            <Text style={styles.dialogLabel}>¿Qué puede ofrecer?</Text>
                            <View style={styles.chipsRow}>
                                {services.map((svc) => (
                                    <Chip
                                        key={svc.id}
                                        selected={picked.includes(svc.id)}
                                        onPress={() => toggleService(svc.id)}
                                        style={styles.chip}
                                    >
                                        {svc.label}
                                    </Chip>
                                ))}
                            </View>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setAddVisible(false)}>Cancelar</Button>
                        <Button mode="contained" onPress={addSeller} loading={adding} disabled={adding}>
                            Habilitar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 12, paddingBottom: 40 },
    loader: { marginTop: 40 },
    card: { marginBottom: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerText: { flex: 1 },
    username: { fontSize: 16, fontWeight: '600' },
    email: { fontSize: 13, marginTop: 2 },
    warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    warnText: { fontSize: 12, color: '#FF9800' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    serviceChip: { marginBottom: 4 },
    chip: { marginBottom: 4 },
    divider: { marginTop: 12, marginBottom: 4 },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, marginTop: 12 },
    emptyHint: { fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
    dialogArea: { maxHeight: 380, paddingHorizontal: 0 },
    dialogHint: { fontSize: 12, marginBottom: 10, paddingHorizontal: 24 },
    dialogLabel: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6, paddingHorizontal: 24 },
    input: { marginHorizontal: 24 }
});

export default SellersScreen;
