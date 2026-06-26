import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import {
    DefaultTheme as NavLight,
    DarkTheme as NavDark
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MODE_KEY = 'theme_mode';
const PALETTE_KEY = 'theme_palette';

// Selectable color themes. Each has a primary for light and dark.
export const PALETTES = {
    violet: { name: 'Violet', light: '#6200ee', dark: '#bb86fc' },
    ocean: { name: 'Ocean', light: '#0277bd', dark: '#4fc3f7' },
    emerald: { name: 'Emerald', light: '#2e7d32', dark: '#66bb6a' },
    sunset: { name: 'Sunset', light: '#e64a19', dark: '#ffab40' },
    rose: { name: 'Rose', light: '#c2185b', dark: '#f48fb1' },
    slate: { name: 'Slate', light: '#455a64', dark: '#90a4ae' }
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState('light');
    const [palette, setPalette] = useState('violet');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [m, p] = await Promise.all([
                    AsyncStorage.getItem(MODE_KEY),
                    AsyncStorage.getItem(PALETTE_KEY)
                ]);
                if (m === 'dark' || m === 'light') setMode(m);
                if (p && PALETTES[p]) setPalette(p);
            } catch (e) {
                // ignore
            } finally {
                setReady(true);
            }
        })();
    }, []);

    const setThemeMode = async (next) => {
        setMode(next);
        try { await AsyncStorage.setItem(MODE_KEY, next); } catch (e) { /* ignore */ }
    };
    const toggleTheme = () => setThemeMode(mode === 'dark' ? 'light' : 'dark');

    const setThemePalette = async (key) => {
        if (!PALETTES[key]) return;
        setPalette(key);
        try { await AsyncStorage.setItem(PALETTE_KEY, key); } catch (e) { /* ignore */ }
    };

    const value = useMemo(() => {
        const isDark = mode === 'dark';
        const primary = PALETTES[palette][isDark ? 'dark' : 'light'];

        const base = isDark ? MD3DarkTheme : MD3LightTheme;
        const paperTheme = {
            ...base,
            colors: { ...base.colors, primary }
        };

        const navBase = isDark ? NavDark : NavLight;
        const navTheme = {
            ...navBase,
            colors: {
                ...navBase.colors,
                primary,
                background: paperTheme.colors.background,
                card: paperTheme.colors.elevation
                    ? paperTheme.colors.elevation.level2
                    : navBase.colors.card,
                text: paperTheme.colors.onSurface,
                border: paperTheme.colors.outlineVariant || navBase.colors.border
            }
        };

        return {
            mode, isDark, ready, palette, primary,
            paperTheme, navTheme,
            toggleTheme, setThemeMode, setThemePalette,
            palettes: PALETTES
        };
    }, [mode, palette, ready]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useThemeMode must be used within ThemeProvider');
    }
    return ctx;
};

export default ThemeContext;
