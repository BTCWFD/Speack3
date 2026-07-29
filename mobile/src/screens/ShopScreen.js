import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert } from 'react-native';
import {
    Text,
    Appbar,
    Card,
    Button,
    IconButton,
    Portal,
    Dialog,
    Chip,
    TextInput,
    ActivityIndicator,
    useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import ApiService from '../services/ApiService';
import OrderTimeline from '../components/OrderTimeline';
import NotificationsBell from '../components/NotificationsBell';
import DeliveryPicker from '../components/DeliveryPicker';

const formatCOP = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

// No native date picker library is linked in this project, so delivery time
// is chosen from a small set of upcoming day + time-of-day slots instead of
// a free-form calendar — matches the "agenda" request without adding a new
// native dependency mid-release.
const SLOT_HOURS = { morning: 9, afternoon: 13, evening: 17 };

const nextDays = (count = 7) =>
    Array.from({ length: count }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1); // earliest option is tomorrow
        d.setHours(0, 0, 0, 0);
        return d;
    });

const STATUS_COLORS = {
    waitlist: '#9E9E9E',
    confirmed: '#2196F3',
    preparing: '#FF9800',
    ready: '#4CAF50',
    delivered: '#4CAF50',
    cancelled: '#F44336'
};

const PAYMENT_METHODS = ['nequi', 'crypto', 'breb'];

const ShopScreen = ({ navigation }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [tab, setTab] = useState('catalog');

    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({}); // productId -> qty
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [checkoutVisible, setCheckoutVisible] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [payOrder, setPayOrder] = useState(null);
    const [payMethod, setPayMethod] = useState(null);
    const [payRef, setPayRef] = useState('');
    const [paying, setPaying] = useState(false);

    const [repeatSource, setRepeatSource] = useState(null);
    const [destination, setDestination] = useState(null);

    const loadCatalog = useCallback(async () => {
        setLoadingCatalog(true);
        try {
            setProducts(await ApiService.getProducts());
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        } finally {
            setLoadingCatalog(false);
        }
    }, [t]);

    const loadOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            setOrders(await ApiService.getMyOrders());
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        } finally {
            setLoadingOrders(false);
        }
    }, [t]);

    useEffect(() => {
        loadCatalog();
        loadOrders();
    }, [loadCatalog, loadOrders]);

    const cartItems = useMemo(
        () =>
            Object.entries(cart)
                .filter(([, qty]) => qty > 0)
                .map(([productId, qty]) => ({ product: products.find((p) => p._id === productId), qty }))
                .filter((i) => i.product),
        [cart, products]
    );
    const cartTotal = cartItems.reduce((sum, i) => sum + i.product.priceCOP * i.qty, 0);

    const addToCart = (productId) => setCart((c) => ({ ...c, [productId]: (c[productId] || 0) + 1 }));
    const removeFromCart = (productId) =>
        setCart((c) => ({ ...c, [productId]: Math.max(0, (c[productId] || 0) - 1) }));

    const openCheckout = () => {
        setSelectedDay(null);
        setSelectedSlot(null);
        setNotes('');
        setDestination(null);
        setCheckoutVisible(true);
    };

    const submitOrder = async () => {
        if (!selectedDay || !selectedSlot) {
            return;
        }
        const requestedDeliveryTime = new Date(selectedDay);
        requestedDeliveryTime.setHours(SLOT_HOURS[selectedSlot], 0, 0, 0);

        setSubmitting(true);
        try {
            await ApiService.createOrder({
                items: cartItems.map((i) => ({ productId: i.product._id, qty: i.qty })),
                requestedDeliveryTime: requestedDeliveryTime.toISOString(),
                notes,
                ...(destination ? { destination } : {})
            });
            setCart({});
            setCheckoutVisible(false);
            setTab('orders');
            loadOrders();
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const openPay = (order) => {
        setPayOrder(order);
        setPayMethod(null);
        setPayRef('');
    };

    // Repetir reutiliza el selector de dia/hora del checkout: hay que elegir
    // una entrega nueva, y el servidor revalida cupo y precios.
    const openRepeat = (order) => {
        setRepeatSource(order);
        setSelectedDay(null);
        setSelectedSlot(null);
    };

    const submitRepeat = async () => {
        if (!repeatSource || !selectedDay || !selectedSlot) return;

        const when = new Date(selectedDay);
        when.setHours(SLOT_HOURS[selectedSlot], 0, 0, 0);

        setSubmitting(true);
        try {
            const result = await ApiService.repeatOrder(repeatSource._id, when.toISOString());
            setRepeatSource(null);
            await loadOrders();

            // El total puede haber cambiado desde el pedido original, asi que se
            // dice explicitamente en vez de dejar que lo note al pagar.
            const cambioPrecio = result.order.totalCOP !== repeatSource.totalCOP;
            const faltantes = result.unavailable?.length
                ? `\n\nNo se pudo incluir: ${result.unavailable.join(', ')}`
                : '';

            Alert.alert(
                'Pedido repetido',
                `Total: ${formatCOP(result.order.totalCOP)}` +
                (cambioPrecio ? ` (antes ${formatCOP(repeatSource.totalCOP)})` : '') +
                faltantes
            );
        } catch (error) {
            Alert.alert(t('common.error'), error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const confirmCancel = (order) => {
        Alert.alert(
            'Cancelar pedido',
            `¿Seguro que quieres cancelar este pedido de ${formatCOP(order.totalCOP)}?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí, cancelar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await ApiService.cancelOrder(order._id);
                            await loadOrders();
                            // Si ya habia pagado, el dinero NO se devuelve solo:
                            // hay que decirlo, no dejarlo esperando el reembolso.
                            if (res.refundNote) {
                                Alert.alert('Pedido cancelado', res.refundNote);
                            }
                        } catch (error) {
                            Alert.alert(t('common.error'), error.message);
                        }
                    }
                }
            ]
        );
    };

    // A donde transferir. Se consulta al abrir y no se guarda: son datos
    // personales del vendedor y no tienen por que quedar en el telefono.
    const showPayoutInfo = async (order) => {
        try {
            const info = await ApiService.getPayoutForOrder(order._id);
            const lineas = [
                info.payTo.nequi ? `Nequi: ${info.payTo.nequi}` : null,
                info.payTo.breb ? `Bre-B: ${info.payTo.breb}` : null
            ].filter(Boolean);

            Alert.alert(
                `Pagar ${formatCOP(info.amountCOP)}`,
                `A nombre de ${info.payTo.username}\n\n${lineas.join('\n')}` +
                '\n\nDespués de transferir, reporta el pago con el botón Pagar.'
            );
        } catch (error) {
            Alert.alert(t('common.error'), error.message);
        }
    };

    const submitPayment = async () => {
        if (!payMethod) return;
        if (payMethod === 'crypto' && !payRef.trim()) {
            Alert.alert(t('common.error'), t('shop.txHashRequired'));
            return;
        }
        setPaying(true);
        try {
            const extra = payMethod === 'crypto' ? { txHash: payRef.trim() } : { reference: payRef.trim() };
            await ApiService.payOrder(payOrder._id, payMethod, extra);
            setPayOrder(null);
            loadOrders();
        } catch (e) {
            Alert.alert(t('common.error'), e.message);
        } finally {
            setPaying(false);
        }
    };

    const renderProduct = ({ item }) => {
        const qty = cart[item._id] || 0;
        return (
            <Card style={styles.productCard}>
                <Card.Content style={styles.productContent}>
                    <Text style={styles.productEmoji}>{item.emoji}</Text>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={[styles.productPrice, { color: theme.colors.primary }]}>
                        {formatCOP(item.priceCOP)}
                    </Text>
                    <View style={styles.stepper}>
                        <IconButton icon="minus" size={18} onPress={() => removeFromCart(item._id)} disabled={!qty} />
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <IconButton icon="plus" size={18} onPress={() => addToCart(item._id)} />
                    </View>
                </Card.Content>
            </Card>
        );
    };

    const renderOrder = ({ item }) => (
        <Card style={styles.orderCard}>
            <Card.Content>
                <View style={styles.orderHeader}>
                    <Text style={styles.orderItems}>
                        {item.items.map((i) => `${i.emoji} ${i.qty}x ${i.name}`).join('  ·  ')}
                    </Text>
                    <Chip
                        style={{ backgroundColor: (STATUS_COLORS[item.status] || '#999') + '22' }}
                        textStyle={{ color: STATUS_COLORS[item.status] || '#999', fontSize: 12 }}
                    >
                        {t(`shop.status.${item.status}`)}
                    </Chip>
                </View>
                <Text style={[styles.orderMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {t('shop.requestedFor', {
                        date: new Date(item.confirmedDeliveryTime || item.requestedDeliveryTime).toLocaleString('es-CO')
                    })}
                </Text>
                {item.delivery ? (
                    <Text style={[styles.orderMeta, { color: theme.colors.onSurfaceVariant }]}>
                        🛵 Domicilio a {item.delivery.address || 'punto marcado'} · {formatCOP(item.delivery.feeCOP)}
                    </Text>
                ) : null}

                {item.totalSavedCOP > 0 ? (
                    <Text style={[styles.savedText, { color: '#4CAF50' }]}>
                        Ahorraste {formatCOP(item.totalSavedCOP)} con la promo
                    </Text>
                ) : null}

                <OrderTimeline order={item} />

                <View style={styles.orderFooter}>
                    <Text style={[styles.orderTotal, { color: theme.colors.primary }]}>{formatCOP(item.totalCOP)}</Text>
                    {item.paymentStatus === 'paid' ? (
                        <Chip
                            icon="check-circle"
                            style={[styles.paymentChip, { backgroundColor: '#4CAF5022' }]}
                            textStyle={{ color: '#4CAF50' }}
                        >
                            {t('shop.paymentStatus.paid')}
                        </Chip>
                    ) : item.paymentStatus === 'pending' ? (
                        <Chip
                            icon="clock-outline"
                            style={[styles.paymentChip, { backgroundColor: '#FF980022' }]}
                            textStyle={{ color: '#FF9800' }}
                        >
                            {t('shop.paymentStatus.pending')}
                        </Chip>
                    ) : (
                        <Button mode="contained" compact onPress={() => openPay(item)}>
                            {t('shop.pay')}
                        </Button>
                    )}
                </View>

                <View style={styles.orderActions}>
                    {/* Repetir solo tiene sentido en un pedido ya cerrado: si sigue
                        en curso, lo normal es esperarlo, no duplicarlo. */}
                    {['delivered', 'cancelled'].includes(item.status) && (
                        <Button
                            mode="outlined"
                            compact
                            icon="repeat"
                            onPress={() => openRepeat(item)}
                        >
                            Repetir pedido
                        </Button>
                    )}
                    {item.paymentStatus !== 'paid' && item.status !== 'cancelled' && (
                        <Button
                            mode="text"
                            compact
                            icon="bank-transfer"
                            onPress={() => showPayoutInfo(item)}
                        >
                            ¿A dónde pago?
                        </Button>
                    )}
                    {/* Solo mientras el vendedor no haya empezado a preparar:
                        despues ya invirtio producto y lo decide el. */}
                    {['waitlist', 'confirmed'].includes(item.status) && (
                        <Button
                            mode="text"
                            compact
                            icon="close-circle-outline"
                            textColor={theme.colors.error}
                            onPress={() => confirmCancel(item)}
                        >
                            Cancelar
                        </Button>
                    )}
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.Content title={t('shop.title')} />
                <NotificationsBell onOpenOrder={() => setTab('orders')} />
                {/* La pantalla decide por si sola que mostrar segun el rol, asi
                    que el acceso puede estar siempre visible. */}
                <Appbar.Action
                    icon="store-cog-outline"
                    accessibilityLabel="Mi tienda"
                    onPress={() => navigation.navigate('ShopSettings')}
                />
            </Appbar.Header>

            <View style={[styles.tabs, { borderBottomColor: theme.colors.outlineVariant || theme.colors.outline }]}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'catalog' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
                    onPress={() => setTab('catalog')}
                >
                    <Text style={[styles.tabText, tab === 'catalog' && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                        {t('shop.catalog')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'orders' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
                    onPress={() => setTab('orders')}
                >
                    <Text style={[styles.tabText, tab === 'orders' && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                        {t('shop.myOrders')}
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === 'catalog' ? (
                <>
                    <FlatList
                        data={products}
                        renderItem={renderProduct}
                        keyExtractor={(item) => item._id}
                        numColumns={2}
                        contentContainerStyle={styles.grid}
                        refreshControl={<RefreshControl refreshing={loadingCatalog} onRefresh={loadCatalog} />}
                    />
                    {cartItems.length > 0 && (
                        <View style={[styles.cartBar, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.cartBarText}>
                                {t('shop.cartSummary', { count: cartItems.reduce((s, i) => s + i.qty, 0) })} · {formatCOP(cartTotal)}
                            </Text>
                            <Button mode="contained-tonal" onPress={openCheckout}>
                                {t('shop.requestOrder')}
                            </Button>
                        </View>
                    )}
                </>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrder}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.grid}
                    refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={loadOrders} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="shopping-outline" size={56} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>{t('shop.noOrdersYet')}</Text>
                        </View>
                    }
                />
            )}

            <Portal>
                <Dialog visible={!!repeatSource} onDismiss={() => setRepeatSource(null)}>
                    <Dialog.Title>Repetir pedido</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <ScrollView>
                            <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                                {repeatSource?.items.map((i) => `${i.emoji} ${i.qty}x ${i.name}`).join('  ·  ')}
                            </Text>
                            <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                                El precio se calcula al momento de pedir, así que puede haber cambiado.
                            </Text>

                            <Text style={styles.dialogLabel}>{t('shop.pickDay')}</Text>
                            <View style={styles.chipsRow}>
                                {nextDays().map((day) => (
                                    <Chip
                                        key={day.toISOString()}
                                        selected={selectedDay?.getTime() === day.getTime()}
                                        onPress={() => setSelectedDay(day)}
                                        style={styles.chip}
                                    >
                                        {day.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </Chip>
                                ))}
                            </View>

                            <Text style={styles.dialogLabel}>{t('shop.pickSlot')}</Text>
                            <View style={styles.chipsRow}>
                                {Object.keys(SLOT_HOURS).map((slot) => (
                                    <Chip
                                        key={slot}
                                        selected={selectedSlot === slot}
                                        onPress={() => setSelectedSlot(slot)}
                                        style={styles.chip}
                                    >
                                        {t(`shop.slot.${slot}`)}
                                    </Chip>
                                ))}
                            </View>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setRepeatSource(null)}>{t('common.cancel')}</Button>
                        <Button
                            mode="contained"
                            disabled={!selectedDay || !selectedSlot || submitting}
                            loading={submitting}
                            onPress={submitRepeat}
                        >
                            Repetir
                        </Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={checkoutVisible} onDismiss={() => setCheckoutVisible(false)}>
                    <Dialog.Title>{t('shop.deliveryTime')}</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <ScrollView>
                            <Text style={styles.dialogLabel}>{t('shop.pickDay')}</Text>
                            <View style={styles.chipsRow}>
                                {nextDays().map((day) => (
                                    <Chip
                                        key={day.toISOString()}
                                        selected={selectedDay?.getTime() === day.getTime()}
                                        onPress={() => setSelectedDay(day)}
                                        style={styles.chip}
                                    >
                                        {day.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </Chip>
                                ))}
                            </View>
                            <Text style={styles.dialogLabel}>{t('shop.pickSlot')}</Text>
                            <View style={styles.chipsRow}>
                                {Object.keys(SLOT_HOURS).map((slot) => (
                                    <Chip
                                        key={slot}
                                        selected={selectedSlot === slot}
                                        onPress={() => setSelectedSlot(slot)}
                                        style={styles.chip}
                                    >
                                        {t(`shop.slot.${slot}`)}
                                    </Chip>
                                ))}
                            </View>
                            <DeliveryPicker value={destination} onChange={setDestination} />

                            <TextInput
                                mode="outlined"
                                label={t('shop.notes')}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                style={styles.notesInput}
                            />
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setCheckoutVisible(false)}>{t('common.cancel')}</Button>
                        <Button
                            mode="contained"
                            disabled={!selectedDay || !selectedSlot || submitting}
                            loading={submitting}
                            onPress={submitOrder}
                        >
                            {t('shop.requestOrder')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={!!payOrder} onDismiss={() => setPayOrder(null)}>
                    <Dialog.Title>{t('shop.payWith')}</Dialog.Title>
                    <Dialog.Content>
                        <View style={styles.chipsRow}>
                            {PAYMENT_METHODS.map((m) => (
                                <Chip key={m} selected={payMethod === m} onPress={() => setPayMethod(m)} style={styles.chip}>
                                    {t(`shop.method.${m}`)}
                                </Chip>
                            ))}
                        </View>
                        {payMethod && (
                            <TextInput
                                mode="outlined"
                                label={payMethod === 'crypto' ? t('shop.txHash') : t('shop.reference')}
                                value={payRef}
                                onChangeText={setPayRef}
                                style={styles.notesInput}
                            />
                        )}
                        {payMethod && payMethod !== 'crypto' && (
                            <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                                {t('shop.manualConfirmHint')}
                            </Text>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setPayOrder(null)}>{t('common.cancel')}</Button>
                        <Button mode="contained" disabled={!payMethod || paying} loading={paying} onPress={submitPayment}>
                            {t('shop.submitPayment')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {(loadingCatalog && tab === 'catalog' && products.length === 0) && (
                <ActivityIndicator style={styles.loader} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabText: { fontSize: 14 },
    grid: { padding: 8, flexGrow: 1 },
    productCard: { flex: 1, margin: 6 },
    productContent: { alignItems: 'center', paddingVertical: 12 },
    productEmoji: { fontSize: 40 },
    productName: { fontSize: 15, fontWeight: '600', marginTop: 4 },
    productPrice: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
    stepper: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    stepperQty: { fontSize: 16, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
    cartBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 16
    },
    cartBarText: { color: '#fff', fontWeight: '600', flex: 1 },
    orderCard: { marginHorizontal: 8, marginVertical: 6 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderItems: { flex: 1, fontSize: 14, marginRight: 8 },
    orderMeta: { fontSize: 12, marginTop: 6 },
    savedText: { fontSize: 12, marginTop: 4, fontWeight: '600' },
    orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
    orderTotal: { fontSize: 16, fontWeight: 'bold', flexShrink: 0 },
    // Payment status labels are long in Spanish ("Pago pendiente de confirmar")
    // and would otherwise push the chip past the card's right edge.
    paymentChip: { flexShrink: 1 },
    dialogArea: { maxHeight: 360 },
    dialogLabel: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { marginBottom: 4 },
    notesInput: { marginTop: 16 },
    helperText: { fontSize: 12, marginTop: 8 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, marginTop: 12 },
    loader: { position: 'absolute', top: '50%', left: 0, right: 0 }
});

export default ShopScreen;
