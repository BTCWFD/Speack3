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
    ProgressBar
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const RegisterScreen = ({ navigation }) => {
    const { register, loading } = useAuth();
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
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
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
            Alert.alert('Success', 'Account created successfully! Encryption keys generated.');
        } else {
            Alert.alert('Registration Failed', result.error || 'Please try again');
            setKeyGenerationProgress(0);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Surface style={styles.surface}>
                    <View style={styles.header}>
                        <Title style={styles.title}>Create Account</Title>
                        <Text style={styles.subtitle}>
                            Your encryption keys will be generated automatically
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label="Username"
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
                            label="Email"
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
                            label="Password"
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
                            label="Confirm Password"
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
                                    Generating encryption keys...
                                </Text>
                                <ProgressBar progress={keyGenerationProgress} />
                            </View>
                        )}

                        <Button
                            mode="contained"
                            onPress={handleRegister}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                        >
                            Register
                        </Button>

                        <Button
                            mode="text"
                            onPress={() => navigation.navigate('Login')}
                            style={styles.linkButton}
                        >
                            Already have an account? Login
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
