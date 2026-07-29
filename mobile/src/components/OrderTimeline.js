import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Pasos por los que pasa un pedido, en orden. "cancelado" no esta aqui porque
// no es un paso mas: corta la linea, y se dibuja aparte.
const STEPS = [
    { status: 'waitlist', label: 'En espera', icon: 'clock-outline' },
    { status: 'confirmed', label: 'Confirmado', icon: 'check-circle-outline' },
    { status: 'preparing', label: 'Preparando', icon: 'package-variant' },
    { status: 'ready', label: 'Listo', icon: 'check-all' },
    { status: 'delivered', label: 'Entregado', icon: 'hand-heart-outline' }
];

const formatWhen = (at) => {
    if (!at) return '';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CO', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
    });
};

// Linea de tiempo del pedido. Se apoya en statusHistory (lo que REALMENTE
// paso, con su hora) y no solo en el estado actual, para que el cliente vea
// cuando avanzo cada paso en vez de un unico rotulo.
const OrderTimeline = ({ order }) => {
    const theme = useTheme();
    const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];

    // Pedidos creados antes de que existiera el historial no lo traen; se
    // muestra al menos el estado actual en vez de una linea vacia.
    const effectiveHistory = history.length > 0
        ? history
        : [{ status: order?.status || 'waitlist', at: order?.createdAt }];

    const whenByStatus = {};
    for (const entry of effectiveHistory) {
        if (!whenByStatus[entry.status]) whenByStatus[entry.status] = entry.at;
    }

    if (order?.status === 'cancelled') {
        return (
            <View style={styles.cancelledRow}>
                <Icon name="close-circle" size={20} color={theme.colors.error} />
                <Text style={[styles.cancelledText, { color: theme.colors.error }]}>
                    Pedido cancelado{whenByStatus.cancelled ? ` · ${formatWhen(whenByStatus.cancelled)}` : ''}
                </Text>
            </View>
        );
    }

    const currentIndex = STEPS.findIndex((s) => s.status === order?.status);

    return (
        <View style={styles.container}>
            {STEPS.map((step, index) => {
                const reached = index <= currentIndex;
                const isCurrent = index === currentIndex;
                const color = reached ? theme.colors.primary : theme.colors.outline;

                return (
                    <View key={step.status} style={styles.step}>
                        <View style={styles.railColumn}>
                            <Icon
                                name={reached ? step.icon : 'circle-small'}
                                size={reached ? 20 : 16}
                                color={color}
                            />
                            {index < STEPS.length - 1 && (
                                <View
                                    style={[
                                        styles.rail,
                                        { backgroundColor: index < currentIndex ? theme.colors.primary : theme.colors.outlineVariant }
                                    ]}
                                />
                            )}
                        </View>

                        <View style={styles.stepText}>
                            <Text
                                style={[
                                    styles.stepLabel,
                                    { color: reached ? theme.colors.onSurface : theme.colors.outline },
                                    isCurrent && styles.stepLabelCurrent
                                ]}
                            >
                                {step.label}
                            </Text>
                            {whenByStatus[step.status] ? (
                                <Text style={[styles.stepWhen, { color: theme.colors.onSurfaceVariant }]}>
                                    {formatWhen(whenByStatus[step.status])}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 8 },
    step: { flexDirection: 'row', alignItems: 'flex-start' },
    railColumn: { alignItems: 'center', width: 24 },
    rail: { width: 2, height: 18, marginVertical: 1 },
    stepText: { flex: 1, paddingLeft: 8, paddingBottom: 6 },
    stepLabel: { fontSize: 14 },
    stepLabelCurrent: { fontWeight: 'bold' },
    stepWhen: { fontSize: 11, marginTop: 1 },
    cancelledRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
    cancelledText: { fontSize: 14, fontWeight: '600' }
});

export default OrderTimeline;
