import React from 'react';
import { Image, StyleSheet } from 'react-native';

const Speack3Logo = ({ size = 80 }) => {
    return (
        <Image 
            source={require('../../assets/logo.jpg')} 
            style={[styles.logo, { width: size, height: size, borderRadius: size * 0.15 }]} 
            resizeMode="cover"
        />
    );
};

const styles = StyleSheet.create({
    logo: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
    }
});

export default Speack3Logo;

export default Speack3Logo;
