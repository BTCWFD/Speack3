import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const AttachmentMenu = ({ onSelect, visible }) => {
    const theme = useTheme();

    if (!visible) return null;

    const items = [
        { id: 'gallery', icon: 'image-multiple', label: 'Galería', color: '#B04DF6' },
        { id: 'camera', icon: 'camera', label: 'Cámara', color: '#FF3B30' },
        { id: 'document', icon: 'file-document', label: 'Documento', color: '#007AFF' },
        { id: 'contact', icon: 'account', label: 'Contacto', color: '#34C759' },
        { id: 'location', icon: 'map-marker', label: 'Ubicación', color: '#FF9500' },
        { id: 'event', icon: 'calendar', label: 'Evento', color: '#AF52DE' }
    ];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]}>
            {items.map((item) => (
                <TouchableOpacity
                    key={item.id}
                    style={styles.item}
                    onPress={() => onSelect(item.id)}
                >
                    <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                        <Icon name={item.icon} size={24} color="#FFF" />
                    </View>
                    <Text style={styles.label}>{item.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        justifyContent: 'space-around',
    },
    item: {
        alignItems: 'center',
        width: '30%',
        marginBottom: 16,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        textAlign: 'center',
    }
});

export default AttachmentMenu;
