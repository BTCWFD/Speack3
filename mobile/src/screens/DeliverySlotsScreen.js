import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
    Text, Appbar, Card, Button, Chip, Portal, Dialog, TextInput,
    ActivityIndicator, IconButton, useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;

// Franjas de entrega y su cupo. Sin ninguna franja configurada la tienda acepta
// pedidos a cualquier hora, asi que se dice explicitamente para que no parezca
// que el limite ya esta puesto.
const DeliverySlotsScreen = ({ navigation }) => {
    const theme = useTheme();
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    const [visible, setVisible] = useState(false);
    const [day, setDay] = useState(null);
    const [startHour, setStartHour] = useState('14');
    const [endHour, setEndHour] = useState('18');
    const [maxOrders, setMaxOrders] = useState('10');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setSlots(await ApiService.getSlots());
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const create = async () => {
        const s = parseInt(startHour, 10);
        const e = parseInt(endHour, 10);
        const max = parseInt(maxOrders, 10);

        if (day === null) {
            Alert.alert('Falta el día', 'Elige el día de la semana.');
            return;
        }
        if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > 24 || e <= s) {
            Alert.alert('Horas inválidas', 'La hora de fin debe ser mayor que la de inicio.');
            return;
        }
        if (!Number.isInteger(max) || max < 1) {
            Alert.alert('Cupo inválido', 'El cupo debe ser al menos 1.');
            return;
        }

        setSaving(true);
        try {
            await ApiService.createSlot({ dayOfWeek: day, startHour: s, endHour: e, maxOrders: max });
            setVisible(false);
            setDay(null);
            await load();
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (slot) => {
        Alert.alert(
            'Eliminar franja',
            `${DAYS[slot.dayOfWeek]} de ${hourLabel(slot.startHour)} a ${hourLabel(slot.endHour)}`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ApiService.deleteSlot(slot._id);
                            await load();
                        } catch (error) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Cupos por franja" />
                <Appbar.Action icon="plus" onPress={() => setVisible(true)} />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator style={styles.loader} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {slots.length === 0 ? (
                        <View style={styles.empty}>
                            <Icon name="calendar-clock" size={44} color={theme.colors.outline} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                Sin franjas configuradas
                            </Text>
                            <Text style={[styles.emptyHint, { color: theme.colors.outline }]}>
                                Ahora mismo se aceptan pedidos a cualquier hora, sin límite de cantidad.
                                Crea una franja para poner cupos.
                            </Text>
                        </View>
                    ) : (
                        slots.map((slot) => (
                            <Card key={slot._id} style={styles.card}>
                                <Card.Content style={styles.row}>
                                    <View style={styles.rowText}>
                                        <Text style={styles.day}>{DAYS[slot.dayOfWeek]}</Text>
                                        <Text style={[styles.hours, { color: theme.colors.onSurfaceVariant }]}>
                                            {hourLabel(slot.startHour)} – {hourLabel(slot.endHour)}
                                        </Text>
                                    </View>
                                    <Chip compact icon="package-variant" style={styles.capacityChip}>
                                        {slot.maxOrders} pedidos
                                    </Chip>
                                    <IconButton
                                        icon="delete-outline"
                                        iconColor={theme.colors.error}
                                        onPress={() => confirmDelete(slot)}
                                    />
                                </Card.Content>
                            </Card>
                        ))
                    )}

                    {slots.length > 0 && (
                        <Text style={[styles.footnote, { color: theme.colors.onSurfaceVariant }]}>
                            El cupo es por fecha: cada {DAYS[slots[0].dayOfWeek].toLowerCase()} tiene
                            sus propios cupos. Cancelar un pedido libera el suyo.
                        </Text>
                    )}
                </ScrollView>
            )}

            <Portal>
                <Dialog visible={visible} onDismiss={() => setVisible(false)}>
                    <Dialog.Title>Nueva franja</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogArea}>
                        <ScrollView>
                            <Text style={styles.dialogLabel}>Día</Text>
                            <View style={styles.chipsRow}>
                                {DAYS.map((name, index) => (
                                    <Chip
                                        key={name}
                                        selected={day === index}
                                        onPress={() => setDay(index)}
                                        style={styles.chip}
                                    >
                                        {name.slice(0, 3)}
                                    </Chip>
                                ))}
                            </View>

                            <View style={styles.hoursRow}>
                                <TextInput
                                    mode="outlined"
                                    label="Desde (hora)"
                                    value={startHour}
                                    onChangeText={setStartHour}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    dense
                                    style={styles.hourInput}
                                />
                                <TextInput
                                    mode="outlined"
                                    label="Hasta (hora)"
                                    value={endHour}
                                    onChangeText={setEndHour}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    dense
                                    style={styles.hourInput}
                                />
                            </View>

                            <TextInput
                                mode="outlined"
                                label="Máximo de pedidos"
                                value={maxOrders}
                                onChangeText={setMaxOrders}
                                keyboardType="number-pad"
                                dense
                                style={styles.input}
                            />
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setVisible(false)}>Cancelar</Button>
                        <Button mode="contained" onPress={create} loading={saving} disabled={saving}>
                            Crear
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
    card: { marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowText: { flex: 1 },
    day: { fontSize: 16, fontWeight: '600' },
    hours: { fontSize: 13, marginTop: 2 },
    capacityChip: { marginRight: 4 },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, marginTop: 12 },
    emptyHint: { fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 26, lineHeight: 18 },
    footnote: { fontSize: 12, marginTop: 12, paddingHorizontal: 4, lineHeight: 17 },
    dialogArea: { maxHeight: 400, paddingHorizontal: 24 },
    dialogLabel: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { marginBottom: 4 },
    hoursRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    hourInput: { flex: 1 },
    input: { marginTop: 12 }
});

export default DeliverySlotsScreen;
