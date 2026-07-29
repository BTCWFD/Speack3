import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useThemeMode } from './src/context/ThemeContext';
import { AuthNavigator, MainNavigator } from './src/navigation/AppNavigator';
import { loadSavedLanguage } from './src/i18n';
import { useUpdateCheck } from './src/hooks/useUpdateCheck';
import UpdateDialog from './src/components/UpdateDialog';

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
    const updateInfo = useUpdateCheck();
    const [updateDismissed, setUpdateDismissed] = useState(false);

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
                {!updateDismissed && (
                    <UpdateDialog
                        updateInfo={updateInfo}
                        onDismiss={() => setUpdateDismissed(true)}
                    />
                )}
            </AuthProvider>
        </PaperProvider>
    );
};

const App = () => {
    useEffect(() => {
        loadSavedLanguage();
    }, []);

    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
};

export default App;
