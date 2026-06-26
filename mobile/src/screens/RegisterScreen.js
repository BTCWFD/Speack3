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
    ProgressBar,
    useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import MirrorButton from '../components/MirrorButton';

const RegisterScreen = ({ navigation }) => {
    const { register, loading } = useAuth();
    const theme = useTheme();
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [keyGenerationProgress, setKeyGenerationProgress] = useState(0);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.username) {
            newErrors.username = t('validation.usernameRequired');
        } else if (formData.username.length < 3) {
            newErrors.username = t('validation.usernameMinLength');
        }

        if (!formData.email) {
            newErrors.email = t('validation.emailRequired');
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = t('validation.emailInvalid');
        }

        if (!formData.password) {
            newErrors.password = t('validation.passwordRequired');
        } else if (formData.password.length < 6) {
            newErrors.password = t('validation.passwordMinLength');
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t('validation.passwordsNoMatch');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        if (!validateForm()) return;

        setKeyGenerationProgress(0.2);

        const result = await register(
            formData.username,
            formData.email,
            formData.password
        );

        setKeyGenerationProgress(1);

        if (result.success) {
            Alert.alert(t('auth.success'), t('auth.accountCreated'));
        } else {
            Alert.alert(t('auth.registrationFailed'), result.error || t('auth.tryAgain'));
            setKeyGenerationProgress(0);
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
                        <Title style={styles.title}>{t('auth.createAccount')}</Title>
                        <Text style={styles.subtitle}>
                            {t('auth.registerSubtitle')}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label={t('auth.username')}
                            value={formData.username}
                            onChangeText={(text) => updateField('username', text)}
                            mode="outlined"
                            autoCapitalize="none"
                            error={!!errors.username}
                            style={styles.input}
                        />
                        <HelperText type="error" visible={!!errors.username}>
                            {errors.username}
                        </HelperText>

                        <TextInput
                            label={t('auth.email')}
                            value={formData.email}
                            onChangeText={(text) => updateField('email', text)}
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
                            value={formData.password}
                            onChangeText={(text) => updateField('password', text)}
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

                        <TextInput
                            label={t('auth.confirmPassword')}
                            value={formData.confirmPassword}
                            onChangeText={(text) => updateField('confirmPassword', text)}
                            mode="outlined"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            error={!!errors.confirmPassword}
                            style={styles.input}
                        />
                        <HelperText type="error" visible={!!errors.confirmPassword}>
                            {errors.confirmPassword}
                        </HelperText>

                        {keyGenerationProgress > 0 && keyGenerationProgress < 1 && (
                            <View style={styles.progressContainer}>
                                <Text style={styles.progressText}>
                                    {t('auth.generatingKeys')}
                                </Text>
                                <ProgressBar progress={keyGenerationProgress} />
                            </View>
                        )}

                        <MirrorButton
                            onPress={handleRegister}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                        >
                            {t('auth.register')}
                        </MirrorButton>

                        <Button
                            mode="text"
                            onPress={() => navigation.navigate('Login')}
                            style={styles.linkButton}
                        >
                            {t('auth.haveAccount')}
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
        marginBottom: 24
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center'
    },
    form: {
        width: '100%'
    },
    input: {
        marginBottom: 4
    },
    progressContainer: {
        marginVertical: 16
    },
    progressText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
        textAlign: 'center'
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

export default RegisterScreen;
