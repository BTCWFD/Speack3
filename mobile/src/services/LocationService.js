import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Obtener la ubicacion del dispositivo, para marcar a donde va un domicilio o
// desde donde sale la tienda.
//
// El permiso se pide en el momento en que hace falta (no al abrir la app), que
// es cuando el usuario entiende para que se le pide.
class LocationService {
    async requestPermission() {
        if (Platform.OS !== 'android') return true;

        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: 'Permitir ubicación',
                message: 'Speack3 necesita tu ubicación para calcular el domicilio.',
                buttonPositive: 'Permitir',
                buttonNegative: 'Ahora no'
            }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    // Devuelve { lat, lng, accuracy } o lanza un error con un mensaje que se
    // pueda mostrar tal cual al usuario.
    async getCurrentPosition({ timeout = 15000 } = {}) {
        const allowed = await this.requestPermission();
        if (!allowed) {
            throw new Error('Necesito permiso de ubicación para calcular el domicilio.');
        }

        return await new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
                (position) => resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }),
                (error) => {
                    // Los codigos de la API son opacos; se traducen a algo
                    // sobre lo que el usuario pueda actuar.
                    if (error.code === 1) {
                        reject(new Error('Permiso de ubicación denegado.'));
                    } else if (error.code === 2) {
                        reject(new Error('No se pudo obtener la ubicación. Revisa que el GPS esté encendido.'));
                    } else if (error.code === 3) {
                        reject(new Error('La ubicación tardó demasiado. Inténtalo de nuevo al aire libre.'));
                    } else {
                        reject(new Error(error.message || 'No se pudo obtener la ubicación.'));
                    }
                },
                { enableHighAccuracy: true, timeout, maximumAge: 10000 }
            );
        });
    }
}

export default new LocationService();
