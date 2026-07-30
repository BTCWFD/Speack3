import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Dialog, Portal, Button, Chip, useTheme } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

const formatCOP = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;

// El QR codifica el numero/llave tal cual, para que el que va a pagar lo
// escanee y le autocomplete el destino en su propia app de Nequi/Bre-B en vez
// de copiar y pegar (y equivocarse un digito). No es un estandar oficial de
// cobro certificado por Nequi/Bre-B — es un atajo para no transcribir a mano.
const PayoutQRDialog = ({ visible, onDismiss, info }) => {
    const theme = useTheme();
    const [method, setMethod] = useState(info?.payTo?.nequi ? 'nequi' : 'breb');

    if (!info) return null;

    const value = method === 'nequi' ? info.payTo.nequi : info.payTo.breb;
    const hasBoth = info.payTo.nequi && info.payTo.breb;

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>Pagar {formatCOP(info.amountCOP)}</Dialog.Title>
                <Dialog.Content style={styles.content}>
                    <Text style={[styles.toName, { color: theme.colors.onSurfaceVariant }]}>
                        A nombre de {info.payTo.username}
                    </Text>

                    {hasBoth && (
                        <View style={styles.methodRow}>
                            <Chip selected={method === 'nequi'} onPress={() => setMethod('nequi')} style={styles.methodChip}>
                                Nequi
                            </Chip>
                            <Chip selected={method === 'breb'} onPress={() => setMethod('breb')} style={styles.methodChip}>
                                Bre-B
                            </Chip>
                        </View>
                    )}

                    {value ? (
                        <>
                            <View style={styles.qrBox}>
                                <QRCode value={value} size={200} />
                            </View>
                            <Text style={styles.value}>{value}</Text>
                            <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                                Escanéalo desde tu app de {method === 'nequi' ? 'Nequi' : 'Bre-B'} para no transcribirlo a mano.
                            </Text>
                        </>
                    ) : (
                        <Text style={{ color: theme.colors.onSurfaceVariant }}>
                            El vendedor no tiene {method === 'nequi' ? 'Nequi' : 'Bre-B'} registrado.
                        </Text>
                    )}

                    <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant, marginTop: 12 }]}>
                        Después de transferir, reporta el pago con el botón Pagar.
                    </Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cerrar</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    content: { alignItems: 'center' },
    toName: { fontSize: 13, marginBottom: 12 },
    methodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    methodChip: { marginBottom: 4 },
    qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
    value: { fontSize: 16, fontWeight: '600', marginTop: 12, letterSpacing: 0.5 },
    hint: { fontSize: 12, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 }
});

export default PayoutQRDialog;
