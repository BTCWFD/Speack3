import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthNavigator, MainNavigator } from './src/navigation/AppNavigator';

const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return null; // Or a splash screen
    }

    return (
        <NavigationContainer>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
    );
};

const App = () => {
    return (
        <PaperProvider>
            <AuthProvider>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <AppContent />
            </AuthProvider>
        </PaperProvider>
    );
};

export default App;
