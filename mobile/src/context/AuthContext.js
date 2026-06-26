import React, { createContext, useState, useContext, useEffect } from 'react';
import ApiService from '../services/ApiService';
import StorageService from '../services/StorageService';
import SignalService from '../services/SignalService';
import SocketService from '../services/SocketService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check if user is already logged in
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await StorageService.getAuthToken();
            const savedUser = await StorageService.getCurrentUser();

            if (token && savedUser) {
                setUser(savedUser);
                setIsAuthenticated(true);

                // Initialize Signal Protocol
                await SignalService.initialize(savedUser.id);

                // Connect to WebSocket
                await SocketService.connect();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            await logout();
        } finally {
            setLoading(false);
        }
    };

    const register = async (username, email, password) => {
        try {
            setLoading(true);

            // Initialize Signal Protocol first
            await SignalService.initialize('temp_user');

            // Generate keys
            const identityKeyPublic = await SignalService.getPublicIdentityKey();
            const registrationId = SignalService.registrationId;
            const preKeys = await SignalService.generatePreKeys(100);
            const signedPreKey = await SignalService.generateSignedPreKey();

            // Register with server
            const response = await ApiService.register({
                username,
                email,
                password,
                identityKeyPublic,
                registrationId,
                preKeys,
                signedPreKey
            });

            // Save tokens and user
            await StorageService.saveAuthToken(response.token);
            await StorageService.saveRefreshToken(response.refreshToken);
            await StorageService.saveCurrentUser(response.user);

            setUser(response.user);
            setIsAuthenticated(true);

            // Connect to WebSocket
            await SocketService.connect();

            return { success: true };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            setLoading(true);

            const response = await ApiService.login(email, password);

            // Save tokens and user
            await StorageService.saveAuthToken(response.token);
            await StorageService.saveRefreshToken(response.refreshToken);
            await StorageService.saveCurrentUser(response.user);

            setUser(response.user);
            setIsAuthenticated(true);

            // Initialize Signal Protocol
            await SignalService.initialize(response.user.id);

            // Connect to WebSocket
            await SocketService.connect();

            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await ApiService.logout();
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Disconnect socket
            SocketService.disconnect();

            // Clear all data
            await StorageService.clearAuth();

            setUser(null);
            setIsAuthenticated(false);
        }
    };

    // Update the current user's profile photo (base64 data URI) and persist it.
    const updateAvatar = async (avatar) => {
        await ApiService.updateAvatar(avatar);
        const next = { ...(user || {}), avatar };
        setUser(next);
        await StorageService.saveCurrentUser(next);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                loading,
                register,
                login,
                logout,
                updateAvatar
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export default AuthContext;
