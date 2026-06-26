import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useThemeMode } from './src/context/ThemeContext';
import { AuthNavigator, MainNavigator } from './src/navigation/AppNavigator';

const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();
    const { navTheme } = useThemeMode();

    if (loading) {
        return null; // Or a splash screen
    }

    return (
        <NavigationContainer theme={navTheme}>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
    );
};

const ThemedApp = () => {
    const { paperTheme, isDark, ready } = useThemeMode();

    if (!ready) {
        return null;
    }

    return (
        <PaperProvider theme={paperTheme}>
            <AuthProvider>
                <StatusBar
                    barStyle={isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={paperTheme.colors.background}
                />
                <AppContent />
            </AuthProvider>
        </PaperProvider>
    );
};

const App = () => {
    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
};

export default App;
