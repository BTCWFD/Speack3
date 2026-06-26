import React from 'react';
import { Pressable, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';

/**
 * "Mirror" / glass-style button. A solid accent base with a translucent top
 * sheen, a light rim and elevation — a glossy/reflective look without native
 * blur or gradient libraries. Drop-in for primary actions.
 *
 * Props: onPress, children (label), icon, loading, disabled, color (override),
 * style, textStyle.
 */
const MirrorButton = ({
    onPress,
    children,
    icon,
    loading = false,
    disabled = false,
    color,
    style,
    textStyle
}) => {
    const theme = useTheme();
    const base = color || theme.colors.primary;
    const inactive = disabled || loading;

    return (
        <Pressable
            onPress={inactive ? undefined : onPress}
            android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: base, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
                style
            ]}
        >
            {/* top sheen — the "mirror" highlight */}
            <View style={styles.sheen} pointerEvents="none" />
            {/* thin bright rim at the very top */}
            <View style={styles.rim} pointerEvents="none" />

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        {icon ? (
                            <Icon name={icon} size={20} color="#fff" style={styles.icon} />
                        ) : null}
                        <Text style={[styles.label, textStyle]}>{children}</Text>
                    </>
                )}
            </View>
        </Pressable>
    );
};

const RADIUS = 28;

const styles = StyleSheet.create({
    button: {
        borderRadius: RADIUS,
        minHeight: 52,
        justifyContent: 'center',
        overflow: 'hidden',
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.30)',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 }
    },
    sheen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '52%',
        backgroundColor: 'rgba(255,255,255,0.20)',
        borderTopLeftRadius: RADIUS,
        borderTopRightRadius: RADIUS
    },
    rim: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        height: 1.5,
        backgroundColor: 'rgba(255,255,255,0.55)'
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16
    },
    icon: { marginRight: 8 },
    label: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.3 }
});

export default MirrorButton;
