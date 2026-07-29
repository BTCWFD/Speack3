import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Alert, Image } from 'react-native';
import { Text, Appbar, Card, Chip, Button, Menu, Portal, Dialog, ActivityIndicator, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import ApiService from '../services/ApiService';
import LocationService from '../services/LocationService';

const formatCOP = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

const STATUS_FLOW = ['waitlist', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'];

const ShopAdminScreen = ({ navigation }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [menuFor, setMenuFor] = useState(null);
    const [receiptImage, setReceiptImage] = useState(null);
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setOrders(await ApiService.getAllOrders());
            setForbidden(false);
        } catch (e) {
            if (e.message?.toLowerCase().includes('shop admin')) {
                setForbidden(true);
            } else {
                Alert.alert(t('common.error'), e.message);
            }
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const setStatus = async (order, status) => {
        setMenuFor(null);

        // Al marcar "en camino" en un pedido con domicilio, se ofrece
        // compartir la ubicacion actual. No es tracking en vivo, es una foto
        // del punto de partida; por eso se pide una sola vez aqui y no se
        // repite en cada cambio de estado.
        if (status === 'on_the_way' && order.delivery) {
            Alert.alert(
                'Compartir ubicación',
                '¿Quieres que el comprador vea desde dónde saliste?',
                [
                    { text: 'No, gracias', onPress: () => applyStatus(order, status) },
                    { text: 'Compartir ubicación', onPress: () => applyStatus(order, status, true) }
                ]
            );
            return;
        }

        applyStatus(order, status);
    };

    const applyStatus = async (order, status, shareLocation = false) => {
        try {
            let courierLocation;
            if (shareLocation) {
                try {
                    const pos = await LocationService.getCurrentPosition();
                    courierLocation = { lat: pos.lat, lng: pos.lng };
                } catch (locError) {
                    // No dejar sin actualizar el pedido solo porque el GPS
                    // fallo: se avisa y se sigue sin ubicacion.
                    Alert.alert(t('common.error'), locError.message);
                }
            }
            await ApiService.updateOrderStatus(order._id, status, null, courierLocation);
            load();
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        }
    };

    const confirmPayment = async (order, paid) => {
        try {
            await ApiService.confirmOrderPayment(order._id, paid);
            load();
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        }
    };

    // La imagen se pide solo al abrirla y no se guarda en el estado de la
    // lista: son datos bancarios y no tienen por que quedar cargados en
    // memoria mientras se navega.
    const showReceipt = async (order) => {
        setLoadingReceipt(true);
        try {
            const data = await ApiService.getOrderReceipt(order._id);
            setReceiptImage(data.image);
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        } finally {
            setLoadingReceipt(false);
        }
    };

    if (forbidden) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
                <Appbar.Header>
                    <Appbar.BackAction onPress={() => navigation.goBack()} />
                    <Appbar.Content title={t('shop.adminTitle')} />
                </Appbar.Header>
                <Icon name="lock-outline" size={56} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>{t('shop.noAccess')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title={t('shop.adminTitle')} />
                <Appbar.Action
                    icon="bank-transfer"
                    accessibilityLabel="Datos de cobro"
                    onPress={() => navigation.navigate('PayoutMethods')}
                />
            </Appbar.Header>

            <FlatList
                data={orders}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.centered}>
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('shop.noOrdersYet')}</Text>
                        </View>
                    )
                }
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text style={styles.buyer}>{item.buyer?.username || item.buyerId}</Text>
                            <Text style={styles.items}>
                                {item.items.map((i) => `${i.emoji} ${i.qty}x ${i.name}`).join('  ·  ')}
                            </Text>
                            <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                                {t('shop.requestedFor', {
                                    date: new Date(
                                        item.confirmedDeliveryTime || item.requestedDeliveryTime
                                    ).toLocaleString('es-CO')
                                })}
                            </Text>
                            {!!item.notes && <Text style={styles.notes}>“{item.notes}”</Text>}

                            <View style={styles.row}>
                                <Text style={[styles.total, { color: theme.colors.primary }]}>
                                    {formatCOP(item.totalCOP)}
                                </Text>
                                <Menu
                                    visible={menuFor === item._id}
                                    onDismiss={() => setMenuFor(null)}
                                    anchor={
                                        <Chip icon="chevron-down" onPress={() => setMenuFor(item._id)}>
                                            {t(`shop.status.${item.status}`)}
                                        </Chip>
                                    }
                                >
                                    {STATUS_FLOW.map((s) => (
                                        <Menu.Item key={s} title={t(`shop.status.${s}`)} onPress={() => setStatus(item, s)} />
                                    ))}
                                </Menu>
                            </View>

                            {/* Sin parte en efectivo: exactamente el mismo bloque de
                                siempre. Con ella, cada parte se confirma por
                                separado porque son dos cobros distintos. */}
                            {!item.cashCOP ? (
                                <View style={styles.row}>
                                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                                        {item.paymentMethod ? t(`shop.method.${item.paymentMethod}`) : t('shop.paymentStatus.unpaid')}
                                        {item.paymentRef ? ` · ${item.paymentRef}` : ''}
                                    </Text>
                                    {item.paymentStatus === 'paid' ? (
                                        <Chip icon="check-circle" style={{ backgroundColor: '#4CAF5022' }} textStyle={{ color: '#4CAF50' }}>
                                            {t('shop.paymentStatus.paid')}
                                        </Chip>
                                    ) : item.paymentStatus === 'pending' ? (
                                        <Button mode="contained-tonal" compact onPress={() => confirmPayment(item, true)}>
                                            {t('shop.markPaid')}
                                        </Button>
                                    ) : (
                                        <Chip style={{ backgroundColor: '#9E9E9E22' }} textStyle={{ color: '#9E9E9E' }}>
                                            {t('shop.paymentStatus.unpaid')}
                                        </Chip>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.splitPayment}>
                                    {item.totalCOP - item.cashCOP > 0 && (
                                        <View style={styles.row}>
                                            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                                                {item.paymentMethod ? t(`shop.method.${item.paymentMethod}`) : ''}
                                                {' · '}{formatCOP(item.totalCOP - item.cashCOP)}
                                                {item.paymentRef ? ` · ${item.paymentRef}` : ''}
                                            </Text>
                                            {item.electronicStatus === 'paid' ? (
                                                <Chip compact icon="check-circle" style={{ backgroundColor: '#4CAF5022' }} textStyle={{ color: '#4CAF50' }}>
                                                    {t('shop.paymentStatus.paid')}
                                                </Chip>
                                            ) : (
                                                <Button mode="contained-tonal" compact onPress={() => confirmPayment(item, true)}>
                                                    {t('shop.markPaid')}
                                                </Button>
                                            )}
                                        </View>
                                    )}
                                    <View style={styles.row}>
                                        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                                            Efectivo · {formatCOP(item.cashCOP)}
                                        </Text>
                                        {item.cashCollected ? (
                                            <Chip compact icon="check-circle" style={{ backgroundColor: '#4CAF5022' }} textStyle={{ color: '#4CAF50' }}>
                                                Cobrado
                                            </Chip>
                                        ) : (
                                            <Button
                                                mode="contained-tonal"
                                                compact
                                                onPress={() => ApiService.confirmOrderCash(item._id, true).then(load).catch((e) => Alert.alert(t('common.error'), e.message))}
                                            >
                                                Marcar cobrado
                                            </Button>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Ver la captura de la transferencia antes de dar
                                el pago por bueno, en vez de buscarla a ciegas
                                en el historial del banco. */}
                            {item.hasReceipt && (
                                <Button
                                    mode="text"
                                    compact
                                    icon="receipt"
                                    onPress={() => showReceipt(item)}
                                >
                                    Ver comprobante
                                </Button>
                            )}
                        </Card.Content>
                    </Card>
                )}
            />

            <Portal>
                <Dialog visible={!!receiptImage} onDismiss={() => setReceiptImage(null)}>
                    <Dialog.Title>Comprobante</Dialog.Title>
                    <Dialog.Content>
                        {receiptImage ? (
                            <Image
                                source={{ uri: receiptImage }}
                                style={styles.receiptFull}
                                resizeMode="contain"
                            />
                        ) : null}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setReceiptImage(null)}>Cerrar</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {loadingReceipt && <ActivityIndicator style={styles.receiptLoader} />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    receiptFull: { width: '100%', height: 420, borderRadius: 8 },
    receiptLoader: { position: 'absolute', top: '50%', left: 0, right: 0 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    list: { padding: 8, flexGrow: 1 },
    card: { marginHorizontal: 8, marginVertical: 6 },
    buyer: { fontWeight: 'bold', fontSize: 15 },
    items: { fontSize: 14, marginTop: 4 },
    meta: { fontSize: 12, marginTop: 4 },
    notes: { fontSize: 13, fontStyle: 'italic', marginTop: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    splitPayment: { gap: 4 },
    total: { fontSize: 16, fontWeight: 'bold' },
    emptyText: { fontSize: 16, marginTop: 12 }
});

export default ShopAdminScreen;
