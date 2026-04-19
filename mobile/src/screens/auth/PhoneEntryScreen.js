import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { authAPI } from '../../services/api';
import { login } from '../../store/authStore';
import { COLORS } from '../../utils/constants';
import { t } from '../../utils/i18n';

export default function PhoneEntryScreen({ navigation, route }) {
  const purpose = route?.params?.purpose || 'LOGIN';
  const [localNumber, setLocalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const dispatch = useDispatch();
  const isLogin = purpose === 'LOGIN';
  const phone = '+251' + localNumber;

  const formatPhone = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 9);
    setLocalNumber(digits);
    setError('');
  };

  const handlePasswordLogin = async () => {
    if (localNumber.length < 9 || !password.trim()) {
      setError('Please enter phone number and password');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await dispatch(login({ phone, password })).unwrap();
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (localNumber.length < 9) {
      setError('Please enter your phone number first');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { data } = await authAPI.requestOtp(phone, 'LOGIN');
      navigation.navigate('OtpVerification', { phone, purpose: 'LOGIN', devCode: data.data?.devCode });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (localNumber.length < 9) {
      setError('Please enter a valid Ethiopian phone number (+251XXXXXXXXX)');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { data } = await authAPI.requestOtp(phone, purpose);
      navigation.navigate('OtpVerification', { phone, purpose, devCode: data.data?.devCode });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send code. Please try again.';
      if (err.response?.status === 404 && purpose === 'LOGIN') {
        Alert.alert(
          'Phone Not Registered',
          'This number is not registered. Would you like to sign up?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Up', onPress: () => navigation.replace('PhoneEntry', { purpose: 'REGISTER' }) },
          ]
        );
      } else if (err.response?.status === 409 && purpose === 'REGISTER') {
        Alert.alert(
          'Already Registered',
          'This phone is already registered. Please login instead.',
          [{ text: 'Login', onPress: () => navigation.replace('PhoneEntry', { purpose: 'LOGIN' }) }]
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>Fetno</Text>
            </View>
            <Text style={styles.appName}>Fetno Driver</Text>
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back!' : 'Create Account'}
            </Text>

            {/* Login mode toggle (only on LOGIN) */}
            {isLogin && (
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, !usePassword && styles.modeBtnActive]}
                  onPress={() => { setUsePassword(false); setError(''); }}
                >
                  <Text style={[styles.modeBtnText, !usePassword && styles.modeBtnTextActive]}>📱 OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, usePassword && styles.modeBtnActive]}
                  onPress={() => { setUsePassword(true); setError(''); }}
                >
                  <Text style={[styles.modeBtnText, usePassword && styles.modeBtnTextActive]}>🔐 Password</Text>
                </TouchableOpacity>
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.phoneRow}>
              <View style={styles.flagBadge}>
                <Text style={styles.countryCode}>+251</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={localNumber}
                onChangeText={formatPhone}
                keyboardType="phone-pad"
                maxLength={9}
                placeholder="9XXXXXXXX"
                placeholderTextColor={COLORS.gray}
              />
            </View>

            {(usePassword && isLogin) && (
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  placeholder="Password"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {(usePassword && isLogin) && (
              <TouchableOpacity
                style={styles.forgotLink}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, isLoading && styles.sendBtnDisabled]}
              onPress={usePassword && isLogin ? handlePasswordLogin : handleSendOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.sendBtnText}>
                  {usePassword && isLogin ? 'Sign In →' : `${t('sendCode')} →`}
                </Text>
              )}
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => navigation.replace('PhoneEntry', { purpose: 'REGISTER' })}
              >
                <Text style={styles.switchText}>{t('noAccount')} {t('signUp')}</Text>
              </TouchableOpacity>
            )}
            {!isLogin && (
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => navigation.replace('PhoneEntry', { purpose: 'LOGIN' })}
              >
                <Text style={styles.switchText}>{t('haveAccount')} {t('signIn')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footer}>🇪🇹 Ethiopia</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 40 },
  logo: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 18, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },
  appName: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  form: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingTop: 32,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  modeToggle: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 20,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.grayLighter },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  modeBtnTextActive: { color: COLORS.white },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 13 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, marginBottom: 14,
    backgroundColor: COLORS.grayLighter, overflow: 'hidden',
  },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRightWidth: 1, borderRightColor: COLORS.border,
    gap: 6,
  },
  flagText: { fontSize: 22 },
  countryCode: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  phoneInput: {
    flex: 1, fontSize: 18, fontWeight: '600',
    paddingHorizontal: 14, paddingVertical: 14, color: COLORS.text,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, marginBottom: 14,
    backgroundColor: COLORS.grayLighter, overflow: 'hidden',
  },
  passwordInput: {
    flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 14, color: COLORS.text,
  },
  eyeBtn: { paddingHorizontal: 14 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 14 },
  forgotText: { color: COLORS.primaryLight, fontSize: 13 },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  switchLink: { alignItems: 'center', marginTop: 16 },
  switchText: { color: COLORS.primaryLight, fontSize: 14 },
  footer: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingBottom: 24, fontSize: 12 },
});
