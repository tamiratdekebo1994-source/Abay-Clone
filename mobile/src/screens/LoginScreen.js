import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authStore';
import { COLORS } from '../utils/constants';
import { t } from '../utils/i18n';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const language = useSelector((state) => state.settings.language);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert(t('errorTitle', language), t('pleaseEnterPhonePassword', language));
      return;
    }
    dispatch(login({ phone: phone.trim(), password }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          <Text style={styles.appName}>ET SPARK</Text>
          <Text style={styles.tagline}>{t('tagline', language)}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>{t('welcomeBack', language)}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('phoneNumber', language)}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('phonePlaceholder', language)}
              value={phone}
              onChangeText={(v) => { setPhone(v); if (error) dispatch(clearError()); }}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('password', language)}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                value={password}
                onChangeText={(v) => { setPassword(v); if (error) dispatch(clearError()); }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.loginButtonText}>{t('login', language)}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerLinkText}>
              {t('newDriverRegisterHere', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('madeForEthiopia', language)}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: 24 },
  header: { alignItems: 'center', paddingVertical: 48 },
  logoImage: {
    width: 100, height: 100,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  appName: { fontSize: 32, fontWeight: '900', color: COLORS.black, marginTop: 12 },
  tagline: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginTop: 4 },
  form: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  formTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 20, textAlign: 'center' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14,
    fontSize: 16, color: COLORS.text,
    backgroundColor: COLORS.grayLighter,
  },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 14 },
  eyeText: { fontSize: 18 },
  loginButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  registerLink: { alignItems: 'center', marginTop: 16 },
  registerLinkText: { color: COLORS.primaryLight, fontSize: 14 },
  footer: { alignItems: 'center', marginTop: 32 },
  footerText: { color: COLORS.gray, fontSize: 13 },
});
