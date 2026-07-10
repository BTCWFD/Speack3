import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

const Speack3Logo = ({ size = 80 }) => {
    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Blue bubble (top-left) */}
            <View style={[styles.bubble, styles.blue, { 
                top: 0, 
                left: 0, 
                width: size * 0.5, 
                height: size * 0.5,
                borderTopLeftRadius: size * 0.25,
                borderTopRightRadius: size * 0.25,
                borderBottomLeftRadius: size * 0.25,
            }]} />
            {/* Red bubble (top-right) */}
            <View style={[styles.bubble, styles.red, { 
                top: 0, 
                right: 0, 
                width: size * 0.45, 
                height: size * 0.45,
                borderRadius: size * 0.225,
            }]} />
            {/* Yellow bubble (bottom-left) */}
            <View style={[styles.bubble, styles.yellow, { 
                bottom: 0, 
                left: 0, 
                width: size * 0.45, 
                height: size * 0.45,
                borderRadius: size * 0.225,
            }]} />
            {/* Green bubble (bottom-right / tail) */}
            <View style={[styles.bubble, styles.green, { 
                bottom: 0, 
                right: 0, 
                width: size * 0.5, 
                height: size * 0.5,
                borderTopLeftRadius: size * 0.25,
                borderTopRightRadius: size * 0.25,
                borderBottomRightRadius: size * 0.25,
            }]} />
            {/* Styled "S3" inside the center */}
            <View style={styles.center}>
                <Text style={[styles.centerText, { fontSize: size * 0.26 }]}>S3</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bubble: {
        position: 'absolute',
        opacity: 0.85,
    },
    blue: {
        backgroundColor: '#4285F4',
    },
    red: {
        backgroundColor: '#EA4335',
    },
    yellow: {
        backgroundColor: '#FBBC05',
    },
    green: {
        backgroundColor: '#34A853',
    },
    center: {
        backgroundColor: '#FFFFFF',
        width: '45%',
        height: '45%',
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
    centerText: {
        fontWeight: 'bold',
        color: '#4285F4',
    }
});

export default Speack3Logo;
