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
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

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
      setError('Please enter your phone number and password.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await dispatch(login({ phone, password })).unwrap();
    } catch (err) {
      if (err?.useOtp) {
        setUsePassword(false);
        Alert.alert('Use OTP Login', 'Your account uses OTP (one-time code) login.\nPlease use the OTP tab to sign in.');
      } else {
        setError(err?.message || 'Invalid credentials. Please check your details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (localNumber.length < 9) {
      setError('Please enter your phone number first.');
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
      setError('Please enter a valid 9-digit phone number.');
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
          'This phone number is already registered. Please sign in instead.',
          [{ text: 'Sign In', onPress: () => navigation.replace('PhoneEntry', { purpose: 'LOGIN' }) }]
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Section ── */}
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Text style={styles.logoIcon}>🚚</Text>
              </View>
            </View>
            <Text style={styles.brandName}>Fetno</Text>
            <Text style={styles.brandSub}>Driver Partner App</Text>
            <View style={styles.heroDivider} />
            <Text style={styles.heroTag}>🇪🇹  Delivering across Ethiopia</Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isLogin
                ? 'Sign in to start accepting deliveries'
                : 'Join thousands of Fetno drivers'}
            </Text>

            {/* Mode Toggle — only on login */}
            {isLogin && (
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, !usePassword && styles.tabActive]}
                  onPress={() => { setUsePassword(false); setError(''); }}
                >
                  <Text style={[styles.tabText, !usePassword && styles.tabTextActive]}>
                    One-Time Code
                  </Text>
                  {!usePassword && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, usePassword && styles.tabActive]}
                  onPress={() => { setUsePassword(true); setError(''); }}
                >
                  <Text style={[styles.tabText, usePassword && styles.tabTextActive]}>
                    Password
                  </Text>
                  {usePassword && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              </View>
            )}

            {/* Error Banner */}
            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorMsg}>{error}</Text>
              </View>
            )}

            {/* Phone Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={[styles.phoneRow, phoneFocused && styles.inputFocused]}>
                <View style={styles.countryBadge}>
                  <Text style={styles.countryFlag}>🇪🇹</Text>
                  <Text style={styles.countryCode}>+251</Text>
                </View>
                <View style={styles.dividerV} />
                <TextInput
                  style={styles.phoneInput}
                  value={localNumber}
                  onChangeText={formatPhone}
                  keyboardType="phone-pad"
                  maxLength={9}
                  placeholder="9XXXXXXXX"
                  placeholderTextColor={COLORS.gray}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
              </View>
            </View>

            {/* Password Field */}
            {usePassword && isLogin && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={[styles.passwordRow, passFocused && styles.inputFocused]}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(''); }}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.gray}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Primary Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={usePassword && isLogin ? handlePasswordLogin : handleSendOtp}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {usePassword && isLogin ? 'Sign In' : isLogin ? 'Send Code' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch Link */}
            <View style={styles.switchRow}>
              <Text style={styles.switchPrompt}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.replace('PhoneEntry', { purpose: isLogin ? 'REGISTER' : 'LOGIN' })
                }
              >
                <Text style={styles.switchAction}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>Fetno © 2025 · Made in Ethiopia</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  /* Hero */
  hero: { alignItems: 'center', paddingTop: 36, paddingBottom: 32, paddingHorizontal: 24 },
  logoRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { fontSize: 34 },
  brandName: {
    color: COLORS.white, fontSize: 32, fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 4 },
  heroDivider: {
    width: 40, height: 2, borderRadius: 1,
    backgroundColor: COLORS.accent, marginVertical: 16,
  },
  heroTag: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },

  /* Card */
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 28 },

  /* Tab Toggle */
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.grayLight,
    marginBottom: 24,
  },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 12, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary },
  tabUnderline: {
    position: 'absolute', bottom: -1.5, left: '15%', right: '15%',
    height: 2.5, borderRadius: 2, backgroundColor: COLORS.primary,
  },

  /* Error */
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 20, gap: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.error,
    color: COLORS.white, fontSize: 13, fontWeight: '800',
    textAlign: 'center', lineHeight: 22,
  },
  errorMsg: { flex: 1, color: '#991B1B', fontSize: 13, lineHeight: 18 },

  /* Fields */
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8, letterSpacing: 0.2 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, backgroundColor: '#FAFAFA', overflow: 'hidden',
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  countryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 15,
  },
  countryFlag: { fontSize: 20 },
  countryCode: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  dividerV: { width: 1, height: 28, backgroundColor: COLORS.border },
  phoneInput: {
    flex: 1, fontSize: 16, fontWeight: '600',
    paddingHorizontal: 14, paddingVertical: 15,
    color: COLORS.text,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, backgroundColor: '#FAFAFA', overflow: 'hidden',
  },
  passwordInput: {
    flex: 1, fontSize: 15, paddingHorizontal: 16, paddingVertical: 15, color: COLORS.text,
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeIcon: { fontSize: 18 },
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 13, color: COLORS.primaryLight, fontWeight: '500' },

  /* Button */
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 17,
    alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  /* Switch row */
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  switchPrompt: { fontSize: 14, color: COLORS.gray },
  switchAction: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  /* Footer */
  footer: {
    color: COLORS.gray,
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 20,
    backgroundColor: COLORS.white,
  },
});
