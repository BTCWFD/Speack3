import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Main Screens
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ShopScreen from '../screens/ShopScreen';
import ShopAdminScreen from '../screens/ShopAdminScreen';
import PayoutMethodsScreen from '../screens/PayoutMethodsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack
export const AuthNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// Main Stack
const ChatStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="GroupChat" component={GroupChatScreen} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
    </Stack.Navigator>
);

const ShopStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Shop" component={ShopScreen} />
        <Stack.Screen name="ShopAdmin" component={ShopAdminScreen} />
        <Stack.Screen name="PayoutMethods" component={PayoutMethodsScreen} />
    </Stack.Navigator>
);

// Main Tab Navigator
export const MainNavigator = () => {
    const { t } = useTranslation();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#6200ee',
                tabBarInactiveTintColor: '#999'
            }}
        >
            <Tab.Screen
                name="Chats"
                component={ChatStack}
                options={{
                    tabBarLabel: t('settings.chats'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="message-text" size={size} color={color} />
                    )
                }}
            />
            <Tab.Screen
                name="Tienda"
                component={ShopStack}
                options={{
                    tabBarLabel: t('shop.title'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="storefront-outline" size={size} color={color} />
                    )
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarLabel: t('settings.title'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="cog" size={size} color={color} />
                    )
                }}
            />
        </Tab.Navigator>
    );
};
