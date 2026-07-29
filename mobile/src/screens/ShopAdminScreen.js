import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, RefreshControl, Alert, Image, TouchableOpacity } from 'react-native';
import { Text, Appbar, Card, Chip, Button, IconButton, Menu, Portal, Dialog, ActivityIndicator, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import ApiService from '../services/ApiService';
import LocationService from '../services/LocationService';

const formatCOP = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

// Las tabs de etapa son el recorrido real del pedido; "cancelled" queda fuera
// de ese recorrido (no es un paso mas, es una salida) asi que va aparte, al
// final, sin badge de color que compita con las etapas activas.
const STAGES = ['waitlist', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered'];

// A que estado avanza el boton primario de cada tarjeta. "ready" bifurca:
// si el pedido es domicilio pasa por "on_the_way", si es para recoger salta
// directo a "delivered" (no tiene sentido un paso "en camino" sin domicilio).
const nextStatus = (order) => {
    switch (order.status) {
        case 'waitlist': return 'confirmed';
        case 'confirmed': return 'preparing';
        case 'preparing': return 'ready';
        case 'ready': return order.delivery ? 'on_the_way' : 'delivered';
        case 'on_the_way': return 'delivered';
        default: return null;
    }
};

const NEXT_LABEL = {
    confirmed: 'Confirmar',
    preparing: 'Empezar a preparar',
    ready: 'Marcar listo',
    on_the_way: 'Marcar en camino',
    delivered: 'Marcar entregado'
};

const ShopAdminScreen = ({ navigation }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [stage, setStage] = useState('waitlist');
    const [overflowFor, setOverflowFor] = useState(null);
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

    // Contador por etapa, para el badge de cada tab — es la razon de ser de
    // este diseno: ver de un vistazo cuantos pedidos hay en cada punto.
    const counts = useMemo(() => {
        const c = { waitlist: 0, confirmed: 0, preparing: 0, ready: 0, on_the_way: 0, delivered: 0, cancelled: 0 };
        for (const o of orders) {
            if (c[o.status] !== undefined) c[o.status] += 1;
        }
        return c;
    }, [orders]);

    const visibleOrders = useMemo(
        () => orders.filter((o) => o.status === stage).sort((a, b) => a.createdAt?.localeCompare(b.createdAt)),
        [orders, stage]
    );

    const setStatus = async (order, status) => {
        setOverflowFor(null);

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

            {/* Tabs de etapa con contador: es la vista de conjunto que antes no
                existia (antes cada pedido era una tarjeta suelta con un menu). */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageBar}>
                {STAGES.map((s) => (
                    <TouchableOpacity key={s} onPress={() => setStage(s)}>
                        <Chip
                            selected={stage === s}
                            style={[styles.stageChip, stage === s && { backgroundColor: theme.colors.primary }]}
                            textStyle={stage === s ? { color: theme.colors.onPrimary, fontWeight: 'bold' } : undefined}
                        >
                            {t(`shop.status.${s}`)} {counts[s] > 0 ? counts[s] : ''}
                        </Chip>
                    </TouchableOpacity>
                ))}
                {counts.cancelled > 0 && (
                    <TouchableOpacity onPress={() => setStage('cancelled')}>
                        <Chip
                            selected={stage === 'cancelled'}
                            style={[styles.stageChip, styles.cancelledChip]}
                            textStyle={{ color: theme.colors.error }}
                        >
                            {t('shop.status.cancelled')} {counts.cancelled}
                        </Chip>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <FlatList
                data={visibleOrders}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.centered}>
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                {t('shop.noOrdersYet')}
                            </Text>
                        </View>
                    )
                }
                renderItem={({ item }) => {
                    const next = nextStatus(item);
                    return (
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
                                    {item.delivery ? ' · 🛵 Domicilio' : ''}
                                </Text>
                                {!!item.notes && <Text style={styles.notes}>“{item.notes}”</Text>}

                                <Text style={[styles.total, { color: theme.colors.primary }]}>
                                    {formatCOP(item.totalCOP)}
                                </Text>

                                {/* Sin parte en efectivo: un solo chip/boton. Con
                                    ella, cada parte se confirma por separado
                                    porque son dos cobros distintos. */}
                                {!item.cashCOP ? (
                                    <View style={styles.row}>
                                        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                                            {item.paymentMethod ? t(`shop.method.${item.paymentMethod}`) : t('shop.paymentStatus.unpaid')}
                                            {item.paymentRef ? ` · ${item.paymentRef}` : ''}
                                        </Text>
                                        {item.paymentStatus === 'paid' ? (
                                            <Chip compact icon="check-circle" style={{ backgroundColor: '#4CAF5022' }} textStyle={{ color: '#4CAF50' }}>
                                                {t('shop.paymentStatus.paid')}
                                            </Chip>
                                        ) : item.paymentStatus === 'pending' ? (
                                            <Button mode="contained-tonal" compact onPress={() => confirmPayment(item, true)}>
                                                {t('shop.markPaid')}
                                            </Button>
                                        ) : (
                                            <Chip compact style={{ backgroundColor: '#9E9E9E22' }} textStyle={{ color: '#9E9E9E' }}>
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

                                {item.hasReceipt && (
                                    <Button mode="text" compact icon="receipt" onPress={() => showReceipt(item)} style={styles.receiptButton}>
                                        Ver comprobante
                                    </Button>
                                )}

                                {/* Una sola accion primaria por tarjeta: avanzar al
                                    siguiente paso. Todo lo no lineal (saltar un
                                    paso, cancelar) vive en el menu "..." para no
                                    competir visualmente con lo que se hace 9 de
                                    cada 10 veces. */}
                                {(next || item.status !== 'cancelled') && (
                                    <View style={styles.actionRow}>
                                        {next && (
                                            <Button
                                                mode="contained"
                                                icon="check"
                                                onPress={() => setStatus(item, next)}
                                                style={styles.primaryAction}
                                            >
                                                {NEXT_LABEL[next]}
                                            </Button>
                                        )}
                                        <Menu
                                            visible={overflowFor === item._id}
                                            onDismiss={() => setOverflowFor(null)}
                                            anchor={
                                                <IconButton
                                                    icon="dots-vertical"
                                                    onPress={() => setOverflowFor(item._id)}
                                                />
                                            }
                                        >
                                            {STAGES.filter((s) => s !== item.status).map((s) => (
                                                <Menu.Item key={s} title={t(`shop.status.${s}`)} onPress={() => setStatus(item, s)} />
                                            ))}
                                            {item.status !== 'cancelled' && (
                                                <Menu.Item title="Cancelar pedido" onPress={() => setStatus(item, 'cancelled')} />
                                            )}
                                        </Menu>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    );
                }}
            />

            <Portal>
                <Dialog visible={!!receiptImage} onDismiss={() => setReceiptImage(null)}>
                    <Dialog.Title>Comprobante</Dialog.Title>
                    <Dialog.Content>
                        {receiptImage ? (
                            <Image source={{ uri: receiptImage }} style={styles.receiptFull} resizeMode="contain" />
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
    stageBar: { paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
    stageChip: { marginRight: 8 },
    cancelledChip: { borderColor: '#F44336' },
    list: { padding: 8, flexGrow: 1 },
    card: { marginHorizontal: 8, marginVertical: 6 },
    buyer: { fontWeight: 'bold', fontSize: 15 },
    items: { fontSize: 14, marginTop: 4 },
    meta: { fontSize: 12, marginTop: 4 },
    notes: { fontSize: 13, fontStyle: 'italic', marginTop: 6 },
    total: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    splitPayment: { gap: 4 },
    receiptButton: { alignSelf: 'flex-start', marginTop: 4 },
    actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 4 },
    primaryAction: { flex: 1 },
    emptyText: { fontSize: 16, marginTop: 12 }
});

export default ShopAdminScreen;
