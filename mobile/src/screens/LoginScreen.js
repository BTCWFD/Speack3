import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert
} from 'react-native';
import {
    TextInput,
    Button,
    Text,
    Title,
    HelperText,
    Surface,
    useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import MirrorButton from '../components/MirrorButton';
import Speack3Logo from '../components/Speack3Logo';

const LoginScreen = ({ navigation }) => {
    const { login, loading } = useAuth();
    const theme = useTheme();
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!email) {
            newErrors.email = t('validation.emailRequired');
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = t('validation.emailInvalid');
        }

        if (!password) {
            newErrors.password = t('validation.passwordRequired');
        } else if (password.length < 6) {
            newErrors.password = t('validation.passwordMinLength');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) return;

        const result = await login(email, password);

        if (!result.success) {
            Alert.alert(t('auth.loginFailed'), result.error || t('auth.invalidCredentials'));
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Surface style={styles.surface}>
                    <View style={styles.header}>
                        <View style={{ marginBottom: 24 }}>
                            <Speack3Logo size={90} />
                        </View>
                        <Title style={styles.title}>{t('auth.appName')}</Title>
                        <Text style={styles.subtitle}>{t('auth.tagline')}</Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label={t('auth.email')}
                            value={email}
                            onChangeText={setEmail}
                            mode="outlined"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            error={!!errors.email}
                            style={styles.input}
                        />
                        <HelperText type="error" visible={!!errors.email}>
                            {errors.email}
                        </HelperText>

                        <TextInput
                            label={t('auth.password')}
                            value={password}
                            onChangeText={setPassword}
                            mode="outlined"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            error={!!errors.password}
                            right={
                                <TextInput.Icon
                                    icon={showPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowPassword(!showPassword)}
                                />
                            }
                            style={styles.input}
                        />
                        <HelperText type="error" visible={!!errors.password}>
                            {errors.password}
                        </HelperText>

                        <MirrorButton
                            onPress={handleLogin}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                        >
                            {t('auth.login')}
                        </MirrorButton>

                        <Button
                            mode="text"
                            onPress={() => navigation.navigate('Register')}
                            style={styles.linkButton}
                        >
                            {t('auth.noAccount')}
                        </Button>
                    </View>
                </Surface>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20
    },
    surface: {
        padding: 24,
        borderRadius: 12,
        elevation: 4
    },
    header: {
        alignItems: 'center',
        marginBottom: 32
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center'
    },
    form: {
        width: '100%'
    },
    input: {
        marginBottom: 4
    },
    button: {
        marginTop: 16,
        marginBottom: 8
    },
    buttonContent: {
        paddingVertical: 8
    },
    linkButton: {
        marginTop: 8
    }
});

export default LoginScreen;
