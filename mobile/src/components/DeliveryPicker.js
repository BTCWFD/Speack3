import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput, ActivityIndicator, Divider, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ApiService from '../services/ApiService';
import LocationService from '../services/LocationService';

const formatCOP = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`;

// Elegir entre recoger en tienda o pedir domicilio. Si pide domicilio, toma la
// ubicacion del telefono y cotiza contra el servidor ANTES de pedir, para que
// el precio no sea una sorpresa al final.
//
// El valor cotizado no se manda como precio: el servidor lo recalcula al crear
// el pedido. Aqui solo se muestra.
const DeliveryPicker = ({ value, onChange }) => {
    const theme = useTheme();
    const [config, setConfig] = useState(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [locating, setLocating] = useState(false);
    const [quote, setQuote] = useState(null);
    const [error, setError] = useState(null);
    const [address, setAddress] = useState(value?.address || '');

    useEffect(() => {
        (async () => {
            try {
                setConfig(await ApiService.getDeliveryConfig());
            } catch (e) {
                setError(e.message);
            } finally {
                setLoadingConfig(false);
            }
        })();
    }, []);

    const useMyLocation = useCallback(async () => {
        setLocating(true);
        setError(null);
        try {
            const pos = await LocationService.getCurrentPosition();
            const q = await ApiService.quoteDelivery(pos.lat, pos.lng);

            setQuote(q);
            onChange({ lat: pos.lat, lng: pos.lng, address });
        } catch (e) {
            setError(e.message);
            setQuote(null);
            onChange(null);
        } finally {
            setLocating(false);
        }
    }, [address, onChange]);

    const clearDelivery = () => {
        setQuote(null);
        setError(null);
        onChange(null);
    };

    if (loadingConfig) {
        return <ActivityIndicator style={styles.loader} />;
    }

    // Sin ubicacion de tienda configurada no se puede cotizar nada; se dice en
    // vez de mostrar un boton que siempre falla.
    if (config && !config.configured) {
        return (
            <View style={styles.unavailable}>
                <Icon name="store-off-outline" size={18} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.unavailableText, { color: theme.colors.onSurfaceVariant }]}>
                    Domicilios no disponibles todavía. Puedes recoger en el punto.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Divider style={styles.divider} />
            <Text style={styles.label}>¿Cómo lo recibes?</Text>

            <View style={styles.options}>
                <Button
                    mode={!value ? 'contained' : 'outlined'}
                    compact
                    icon="storefront-outline"
                    onPress={clearDelivery}
                    style={styles.optionButton}
                >
                    Recoger
                </Button>
                <Button
                    mode={value ? 'contained' : 'outlined'}
                    compact
                    icon="moped"
                    loading={locating}
                    disabled={locating}
                    onPress={useMyLocation}
                    style={styles.optionButton}
                >
                    Domicilio
                </Button>
            </View>

            {config?.copPerKm ? (
                <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                    {formatCOP(config.copPerKm)} por km desde {config.origin?.address || 'la tienda'}
                </Text>
            ) : null}

            {error ? (
                <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
            ) : null}

            {quote ? (
                <View style={[styles.quoteBox, { borderColor: theme.colors.primary }]}>
                    <Icon name="map-marker-check" size={18} color={theme.colors.primary} />
                    <Text style={[styles.quoteText, { color: theme.colors.onSurface }]}>
                        {quote.km} km · domicilio {formatCOP(quote.feeCOP)}
                    </Text>
                </View>
            ) : null}

            {value ? (
                <TextInput
                    mode="outlined"
                    label="Punto de referencia (opcional)"
                    placeholder="Apto, torre, color de la puerta…"
                    value={address}
                    onChangeText={(text) => {
                        setAddress(text);
                        onChange({ ...value, address: text });
                    }}
                    dense
                    style={styles.addressInput}
                />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 4 },
    divider: { marginVertical: 12 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    options: { flexDirection: 'row', gap: 8 },
    optionButton: { flex: 1 },
    hint: { fontSize: 11, marginTop: 8 },
    error: { fontSize: 12, marginTop: 8 },
    quoteBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10
    },
    quoteText: { fontSize: 14, fontWeight: '600' },
    addressInput: { marginTop: 10 },
    loader: { marginVertical: 16 },
    unavailable: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    unavailableText: { flex: 1, fontSize: 12 }
});

export default DeliveryPicker;
