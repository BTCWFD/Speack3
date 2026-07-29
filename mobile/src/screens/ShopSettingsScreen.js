import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
    Text, Appbar, Card, Button, Switch, List, Divider,
    ActivityIndicator, useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';
import LocationService from '../services/LocationService';

// Centro de mando del vendedor: abrir/cerrar la tienda, ponerse en linea, fijar
// desde donde salen los domicilios, y los accesos al resto de la administracion.
const ShopSettingsScreen = ({ navigation }) => {
    const theme = useTheme();
    const [status, setStatus] = useState(null);
    const [origin, setOrigin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [st, cfg] = await Promise.all([
                ApiService.getShopStatus(),
                ApiService.getDeliveryConfig()
            ]);
            setStatus(st);
            setOrigin(cfg.origin);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleShop = async (open) => {
        // Optimista para que el switch no se sienta trabado; se recarga al final.
        setStatus((s) => ({ ...s, open }));
        try {
            await ApiService.setShopOpen(open);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            load();
        }
    };

    const toggleAvailability = async (available) => {
        setStatus((s) => ({ ...s, me: { ...s.me, available } }));
        try {
            await ApiService.setMyAvailability(available);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            load();
        }
    };

    const useCurrentLocation = async () => {
        setLocating(true);
        try {
            const pos = await LocationService.getCurrentPosition();
            const saved = await ApiService.setDeliveryOrigin(pos.lat, pos.lng, 'Ubicación actual');
            setOrigin(saved);
            Alert.alert(
                'Ubicación actualizada',
                'Los domicilios se cobrarán desde este punto.'
            );
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLocating(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator />
            </View>
        );
    }

    const isAdmin = status?.me?.isAdmin;
    const isSeller = status?.me?.isSeller || isAdmin;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Mi tienda" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                {isAdmin && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.switchRow}>
                                <View style={styles.switchText}>
                                    <Text style={styles.switchTitle}>
                                        {status.open ? 'Tienda abierta' : 'Tienda cerrada'}
                                    </Text>
                                    <Text style={[styles.switchHint, { color: theme.colors.onSurfaceVariant }]}>
                                        {status.open
                                            ? 'Los clientes pueden hacer pedidos'
                                            : 'No entran pedidos nuevos'}
                                    </Text>
                                </View>
                                <Switch value={!!status.open} onValueChange={toggleShop} />
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {isSeller && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.switchRow}>
                                <View style={styles.switchText}>
                                    <Text style={styles.switchTitle}>
                                        {status.me.available ? 'En línea' : 'Fuera de línea'}
                                    </Text>
                                    <Text style={[styles.switchHint, { color: theme.colors.onSurfaceVariant }]}>
                                        {status.me.available
                                            ? 'Recibes avisos de pedidos nuevos'
                                            : 'No recibes avisos de pedidos nuevos'}
                                    </Text>
                                </View>
                                <Switch
                                    value={status.me.available !== false}
                                    onValueChange={toggleAvailability}
                                />
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {isAdmin && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text style={styles.sectionTitle}>Punto de salida de domicilios</Text>
                            {origin ? (
                                <View style={styles.originRow}>
                                    <Icon name="map-marker" size={18} color={theme.colors.primary} />
                                    <Text style={[styles.originText, { color: theme.colors.onSurfaceVariant }]}>
                                        {origin.address || 'Sin nombre'}
                                        {'\n'}
                                        {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[styles.originText, { color: theme.colors.error }]}>
                                    Sin configurar: no se pueden cobrar domicilios.
                                </Text>
                            )}
                            <Button
                                mode="outlined"
                                icon="crosshairs-gps"
                                onPress={useCurrentLocation}
                                loading={locating}
                                disabled={locating}
                                style={styles.locationButton}
                            >
                                Usar mi ubicación actual
                            </Button>
                        </Card.Content>
                    </Card>
                )}

                <Card style={styles.card}>
                    {isAdmin && (
                        <>
                            <List.Item
                                title="Vendedores"
                                description="Habilitar y controlar quién puede vender"
                                left={(p) => <List.Icon {...p} icon="account-group-outline" />}
                                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                                onPress={() => navigation.navigate('Sellers')}
                            />
                            <Divider />
                            <List.Item
                                title="Cupos por franja"
                                description="Cuántos pedidos aceptas por horario"
                                left={(p) => <List.Icon {...p} icon="calendar-clock" />}
                                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                                onPress={() => navigation.navigate('DeliverySlots')}
                            />
                            <Divider />
                            <List.Item
                                title="Pedidos"
                                description="Ver y gestionar todos los pedidos"
                                left={(p) => <List.Icon {...p} icon="clipboard-list-outline" />}
                                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                                onPress={() => navigation.navigate('ShopAdmin')}
                            />
                            <Divider />
                        </>
                    )}
                    {/* Solo para quien vende: a un comprador estas pantallas le
                        responderian 403, asi que no se le ofrecen. */}
                    {isSeller && (
                        <>
                            <List.Item
                                title="Datos de cobro"
                                description="Tu Nequi o llave Bre-B"
                                left={(p) => <List.Icon {...p} icon="bank-transfer" />}
                                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                                onPress={() => navigation.navigate('PayoutMethods')}
                            />
                            <Divider />
                            <List.Item
                                title="Apoyar el desarrollo"
                                description="Aporte voluntario"
                                left={(p) => <List.Icon {...p} icon="heart-outline" />}
                                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                                onPress={() => navigation.navigate('Donations')}
                            />
                        </>
                    )}
                </Card>

                {!isSeller && (
                    <Text style={[styles.buyerNote, { color: theme.colors.onSurfaceVariant }]}>
                        Esta sección es para vendedores. Si quieres vender en Speack3, pídele
                        al administrador que habilite tu cuenta.
                    </Text>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    content: { padding: 12, paddingBottom: 40 },
    card: { marginBottom: 12 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchText: { flex: 1, paddingRight: 12 },
    switchTitle: { fontSize: 16, fontWeight: '600' },
    switchHint: { fontSize: 13, marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
    originRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    originText: { flex: 1, fontSize: 13, lineHeight: 19 },
    locationButton: { marginTop: 14 },
    buyerNote: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24, marginTop: 8, lineHeight: 19 }
});

export default ShopSettingsScreen;
