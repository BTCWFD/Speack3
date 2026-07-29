import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
    Text, Appbar, Card, Button, TextInput, Chip, Divider,
    ActivityIndicator, useTheme
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

const formatCOP = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;

const STATUS_LABEL = {
    reported: 'Pendiente de confirmar',
    confirmed: 'Confirmado',
    rejected: 'No encontrado'
};

const STATUS_COLOR = {
    reported: '#FF9800',
    confirmed: '#4CAF50',
    rejected: '#F44336'
};

const METHOD_LABEL = { nequi: 'Nequi', breb: 'Bre-B', crypto: 'Cripto' };

// Aporte voluntario para sostener el desarrollo. La pantalla insiste en que es
// opcional: quien no aporte no pierde nada, y eso debe quedar claro antes de
// pedir plata, no en letra chica.
const DonationsScreen = ({ navigation }) => {
    const theme = useTheme();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState(null);
    const [reference, setReference] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setInfo(await ApiService.getDonationInfo());
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        const amountCOP = parseInt(amount, 10);
        if (!Number.isInteger(amountCOP) || amountCOP < 1) {
            Alert.alert('Monto inválido', 'Escribe un monto en pesos.');
            return;
        }
        if (!method) {
            Alert.alert('Falta el medio', 'Elige cómo hiciste la transferencia.');
            return;
        }
        if (method === 'crypto' && !reference.trim()) {
            Alert.alert('Falta el hash', 'Para cripto necesito el hash de la transacción.');
            return;
        }

        setSending(true);
        try {
            const extra = method === 'crypto'
                ? { txHash: reference.trim() }
                : { reference: reference.trim() };
            const res = await ApiService.reportDonation(amountCOP, method, extra);
            setAmount('');
            setReference('');
            setMethod(null);
            await load();
            Alert.alert('¡Gracias!', res.message);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator />
            </View>
        );
    }

    const payTo = info?.payTo;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Apoyar el desarrollo" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={styles.voluntaryRow}>
                            <Icon name="heart-outline" size={20} color={theme.colors.primary} />
                            <Text style={[styles.voluntaryText, { color: theme.colors.onSurface }]}>
                                Aportar es completamente voluntario. Tu cuenta de vendedor
                                funciona igual aportes o no.
                            </Text>
                        </View>
                    </Card.Content>
                </Card>

                {!payTo ? (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text style={{ color: theme.colors.onSurfaceVariant }}>
                                Todavía no hay datos de cobro configurados para recibir aportes.
                            </Text>
                        </Card.Content>
                    </Card>
                ) : (
                    <>
                        <Text style={styles.label}>¿A dónde transferir?</Text>
                        <Card style={styles.card}>
                            <Card.Content>
                                <Text style={styles.payToName}>{payTo.username}</Text>
                                {payTo.nequi ? (
                                    <Text style={styles.payToLine}>Nequi: {payTo.nequi}</Text>
                                ) : null}
                                {payTo.breb ? (
                                    <Text style={styles.payToLine}>Bre-B: {payTo.breb}</Text>
                                ) : null}
                            </Card.Content>
                        </Card>

                        <Text style={styles.label}>Monto</Text>
                        <View style={styles.chipsRow}>
                            {(info.suggestedCOP || []).map((s) => (
                                <Chip
                                    key={s}
                                    selected={amount === String(s)}
                                    onPress={() => setAmount(String(s))}
                                    style={styles.chip}
                                >
                                    {formatCOP(s)}
                                </Chip>
                            ))}
                        </View>
                        <TextInput
                            mode="outlined"
                            label="Otro monto (COP)"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="number-pad"
                            dense
                            style={styles.input}
                        />

                        <Text style={styles.label}>¿Cómo transferiste?</Text>
                        <View style={styles.chipsRow}>
                            {Object.keys(METHOD_LABEL).map((m) => (
                                <Chip
                                    key={m}
                                    selected={method === m}
                                    onPress={() => setMethod(m)}
                                    style={styles.chip}
                                >
                                    {METHOD_LABEL[m]}
                                </Chip>
                            ))}
                        </View>

                        {method ? (
                            <TextInput
                                mode="outlined"
                                label={method === 'crypto' ? 'Hash de la transacción' : 'Referencia (opcional)'}
                                value={reference}
                                onChangeText={setReference}
                                autoCapitalize="none"
                                dense
                                style={styles.input}
                            />
                        ) : null}

                        <Button
                            mode="contained"
                            onPress={submit}
                            loading={sending}
                            disabled={sending}
                            style={styles.submitButton}
                            icon="hand-heart-outline"
                        >
                            Reportar aporte
                        </Button>

                        <Text style={[styles.footnote, { color: theme.colors.onSurfaceVariant }]}>
                            Primero haz la transferencia y luego repórtala aquí. Los aportes por
                            Nequi o Bre-B quedan pendientes hasta que se confirmen a mano.
                        </Text>
                    </>
                )}

                {info?.myDonations?.length > 0 && (
                    <>
                        <Divider style={styles.divider} />
                        <Text style={styles.label}>Tus aportes</Text>
                        {info.myDonations.map((d) => (
                            <Card key={d._id} style={styles.donationCard}>
                                <Card.Content style={styles.donationRow}>
                                    <View>
                                        <Text style={styles.donationAmount}>{formatCOP(d.amountCOP)}</Text>
                                        <Text style={[styles.donationMeta, { color: theme.colors.onSurfaceVariant }]}>
                                            {METHOD_LABEL[d.method] || d.method} ·{' '}
                                            {new Date(d.createdAt).toLocaleDateString('es-CO')}
                                        </Text>
                                    </View>
                                    <Chip
                                        compact
                                        style={{ backgroundColor: (STATUS_COLOR[d.status] || '#999') + '22' }}
                                        textStyle={{ color: STATUS_COLOR[d.status] || '#999', fontSize: 11 }}
                                    >
                                        {STATUS_LABEL[d.status] || d.status}
                                    </Chip>
                                </Card.Content>
                            </Card>
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16, paddingBottom: 40 },
    card: { marginBottom: 16 },
    voluntaryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    voluntaryText: { flex: 1, fontSize: 14, lineHeight: 20 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
    payToName: { fontSize: 15, fontWeight: '600' },
    payToLine: { fontSize: 14, marginTop: 4 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: { marginBottom: 4 },
    input: { marginBottom: 12 },
    submitButton: { marginTop: 8 },
    footnote: { fontSize: 12, marginTop: 12, lineHeight: 17 },
    divider: { marginVertical: 20 },
    donationCard: { marginBottom: 8 },
    donationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    donationAmount: { fontSize: 15, fontWeight: '600' },
    donationMeta: { fontSize: 12, marginTop: 2 }
});

export default DonationsScreen;
