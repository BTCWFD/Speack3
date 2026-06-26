import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGE_STORAGE_KEY = 'app_language';

i18n
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v3', // Required on RN/Hermes for plural handling.
        resources: {
            en: { translation: en },
            es: { translation: es }
        },
        lng: 'es', // Default language: Spanish.
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // React already escapes by default.
        }
    });

/**
 * Reads the persisted language choice (if any) and applies it. Safe to call
 * at app startup; failures are non-fatal and leave the default ('es') in place.
 */
export const loadSavedLanguage = async () => {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved && saved !== i18n.language) {
            await i18n.changeLanguage(saved);
        }
    } catch (error) {
        // Ignore — keep the default language.
    }
    return i18n.language;
};

/**
 * Changes the active language live and persists the choice.
 */
export const setAppLanguage = async (lng) => {
    try {
        await i18n.changeLanguage(lng);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch (error) {
        // Ignore persistence failure; the in-memory change still applies.
    }
};

export default i18n;
