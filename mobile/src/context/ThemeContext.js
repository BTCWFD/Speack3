import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import {
    DefaultTheme as NavLight,
    DarkTheme as NavDark
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_mode';

const ThemeContext = createContext(null);

// Brand color kept consistent across light/dark.
const PRIMARY = '#6200ee';

const lightPaper = {
    ...MD3LightTheme,
    colors: { ...MD3LightTheme.colors, primary: PRIMARY }
};
const darkPaper = {
    ...MD3DarkTheme,
    colors: { ...MD3DarkTheme.colors, primary: '#bb86fc' }
};

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState('light');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(THEME_KEY);
                if (saved === 'dark' || saved === 'light') {
                    setMode(saved);
                }
            } catch (e) {
                // ignore
            } finally {
                setReady(true);
            }
        })();
    }, []);

    const setThemeMode = async (next) => {
        setMode(next);
        try {
            await AsyncStorage.setItem(THEME_KEY, next);
        } catch (e) {
            // ignore
        }
    };

    const toggleTheme = () => setThemeMode(mode === 'dark' ? 'light' : 'dark');

    const value = useMemo(() => {
        const isDark = mode === 'dark';
        const paperTheme = isDark ? darkPaper : lightPaper;
        const navBase = isDark ? NavDark : NavLight;
        const navTheme = {
            ...navBase,
            colors: {
                ...navBase.colors,
                primary: paperTheme.colors.primary,
                background: paperTheme.colors.background,
                card: paperTheme.colors.elevation
                    ? paperTheme.colors.elevation.level2
                    : navBase.colors.card,
                text: paperTheme.colors.onSurface,
                border: paperTheme.colors.outlineVariant || navBase.colors.border
            }
        };
        return { mode, isDark, ready, paperTheme, navTheme, toggleTheme, setThemeMode };
    }, [mode, ready]);

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
