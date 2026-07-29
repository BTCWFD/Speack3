import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Appbar, TextInput, Button, Card, HelperText, ActivityIndicator, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';

// Mismo formato que valida el servidor, para avisar antes de mandar la peticion.
const NEQUI_RE = /^3\d{9}$/;

const PayoutMethodsScreen = ({ navigation }) => {
    const theme = useTheme();
    const [nequi, setNequi] = useState('');
    const [breb, setBreb] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const payout = await ApiService.getMyPayoutMethods();
            setNequi(payout?.nequi || '');
            setBreb(payout?.breb || '');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const nequiInvalid = nequi.length > 0 && !NEQUI_RE.test(nequi);

    const save = async () => {
        if (nequiInvalid) return;
        if (!nequi && !breb) {
            Alert.alert('Falta un dato', 'Registra al menos Nequi o una llave Bre-B.');
            return;
        }

        setSaving(true);
        try {
            // Vaciar el campo borra el metodo, en vez de dejarlo colgado.
            await ApiService.setMyPayoutMethods({
                nequi: nequi ? nequi : null,
                breb: breb ? breb : null
            });
            Alert.alert('Guardado', 'Tus datos de cobro quedaron actualizados.');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Datos de cobro" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={styles.privacyRow}>
                            <Icon name="shield-lock-outline" size={20} color={theme.colors.primary} />
                            <Text style={[styles.privacyText, { color: theme.colors.onSurfaceVariant }]}>
                                Estos datos no aparecen en el catálogo. Solo los ve quien tenga un
                                pedido tuyo sin pagar, para saber a dónde transferir.
                            </Text>
                        </View>
                    </Card.Content>
                </Card>

                <TextInput
                    mode="outlined"
                    label="Número de Nequi"
                    value={nequi}
                    onChangeText={setNequi}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="3001234567"
                    left={<TextInput.Icon icon="cellphone" />}
                    error={nequiInvalid}
                    style={styles.input}
                />
                <HelperText type={nequiInvalid ? 'error' : 'info'} visible>
                    {nequiInvalid
                        ? 'Debe ser un celular de 10 dígitos que empiece por 3'
                        : 'Celular colombiano de 10 dígitos. Déjalo vacío para no usar Nequi.'}
                </HelperText>

                <TextInput
                    mode="outlined"
                    label="Llave Bre-B"
                    value={breb}
                    onChangeText={setBreb}
                    autoCapitalize="none"
                    placeholder="correo, celular o cédula"
                    left={<TextInput.Icon icon="key-variant" />}
                    style={styles.input}
                />
                <HelperText type="info" visible>
                    Tu llave registrada en Bre-B. Déjala vacía para no usarla.
                </HelperText>

                <Button
                    mode="contained"
                    onPress={save}
                    loading={saving}
                    disabled={saving || nequiInvalid}
                    style={styles.saveButton}
                >
                    Guardar
                </Button>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16 },
    card: { marginBottom: 20 },
    privacyRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    privacyText: { flex: 1, fontSize: 13, lineHeight: 19 },
    input: { marginTop: 4 },
    saveButton: { marginTop: 20 }
});

export default PayoutMethodsScreen;
