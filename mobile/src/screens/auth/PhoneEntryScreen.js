import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { FIREBASE_API_KEY } from '../../services/firebase';
import { COLORS, DEV_API_BASE, API_URL } from '../../utils/constants';

export default function PhoneEntryScreen({ navigation }) {
  const dispatch = useDispatch();
  const [localNumber, setLocalNumber] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [adminPhoneFocused, setAdminPhoneFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const phoneRef = useRef(null);

  const phone = '+251' + localNumber;
  const phoneReady = localNumber.length === 9;

  const formatPhone = (text) => {
    setLocalNumber(text.replace(/\D/g, '').slice(0, 9));
    setError('');
  };

  // Backend OTP: send OTP via backend (no Firebase). Returns devCode in dev mode.
  const sendBackendOtp = async () => {
    const res = await fetch(`${API_URL}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose: 'LOGIN' }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to send code.');
    }
    // devCode is returned by backend when SMS is not configured
    return data.data?.devCode || null;
  };

  const handleSendOtp = async () => {
    if (!phoneReady) {
      setError('Enter a valid 9-digit phone number.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // In dev mode skip Firebase entirely — reCAPTCHA always fails in dev.
      // Use backend OTP which prints the code to server console.
      if (__DEV__) {
        const devCode = await sendBackendOtp();
        navigation.navigate('OtpVerification', { phone, purpose: 'LOGIN', verificationId: null, devCode });
        return;
      }

      // Production: try Firebase first
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone, recaptchaToken: 'test' }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || '';
        if (msg.includes('TOO_LONG') || msg.includes('INVALID_PHONE_NUMBER')) {
          setError('Invalid phone number. Please check and try again.');
          return;
        }
        // Any Firebase failure → fall back to backend OTP
        const devCode = await sendBackendOtp();
        navigation.navigate('OtpVerification', { phone, purpose: 'LOGIN', verificationId: null, devCode });
        return;
      }
      navigation.navigate('OtpVerification', {
        phone,
        purpose: 'LOGIN',
        verificationId: data.sessionInfo,
      });
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin login calls the backend directly — no Firebase dependency
  const handleAdminLogin = async () => {
    const rawPhone = adminPhone.trim();
    if (!rawPhone || !adminPassword.trim()) {
      setError('Enter your phone number and password.');
      return;
    }
    // Accept with or without +251 prefix
    const fullPhone = rawPhone.startsWith('+') ? rawPhone : `+251${rawPhone.replace(/^0/, '')}`;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message || '';
        if (res.status === 401) {
          setError('Wrong phone number or password.');
        } else if (res.status === 429) {
          setError('Too many attempts. Try again later.');
        } else {
          setError(msg || 'Sign in failed. Please try again.');
        }
        return;
      }
      // Store the backend JWT as the bearer token — auth middleware validates it via JWT fallback
      const { accessToken, refreshToken } = data.data;
      await SecureStore.setItemAsync('firebaseIdToken', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }
      dispatch(loadUser());
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Back button ───────────────────────────────── */}
          <TouchableOpacity
            style={S.backBtn}
            onPress={() => navigation.canGoBack() && navigation.goBack()}
          >
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>

          {/* ── Icon badge ────────────────────────────────── */}
          <View style={S.iconArea}>
            <View style={S.iconRing}>
              <View style={S.iconBox}>
                <Text style={S.iconEmoji}>{showAdmin ? '🔐' : '📱'}</Text>
              </View>
            </View>
          </View>

          {/* ── Heading ───────────────────────────────────── */}
          <Text style={S.title}>
            {showAdmin ? 'Admin Sign In' : 'Enter your\nphone number'}
          </Text>
          {showAdmin ? (
            <Text style={S.subtitle}>Sign in with your admin phone number and password</Text>
          ) : (
            <Text style={S.subtitle}>We'll send a 6-digit verification code via SMS</Text>
          )}

          {/* ── Error ─────────────────────────────────────── */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorIcon}>⚠</Text>
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          {showAdmin ? (
            /* ── Admin fields (phone + password, calls backend directly) ── */
            <View style={S.fields}>
              <Text style={S.fieldLabel}>Phone Number</Text>
              <View style={[S.inputBox, adminPhoneFocused && S.inputBoxFocused]}>
                <Text style={S.inputIcon}>📱</Text>
                <TextInput
                  style={S.inputText}
                  value={adminPhone}
                  onChangeText={(v) => { setAdminPhone(v); setError(''); }}
                  placeholder="+251 9XX XXX XXXX"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  onFocus={() => setAdminPhoneFocused(true)}
                  onBlur={() => setAdminPhoneFocused(false)}
                />
              </View>

              <Text style={[S.fieldLabel, { marginTop: 16 }]}>Password</Text>
              <View style={[S.inputBox, passFocused && S.inputBoxFocused]}>
                <Text style={S.inputIcon}>🔒</Text>
                <TextInput
                  style={[S.inputText, S.flex]}
                  value={adminPassword}
                  onChangeText={(v) => { setAdminPassword(v); setError(''); }}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={S.eyeBtn}
                >
                  <Text style={S.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={S.adminHint}>
                Admin accounts are created via the server setup script.
              </Text>
            </View>
          ) : (
            /* ── Phone row ────────────────────────────────── */
            <View style={S.fields}>
              <Text style={S.fieldLabel}>Mobile Number · +251</Text>
              <TouchableOpacity
                style={[S.phoneBox, phoneFocused && S.phoneBoxFocused]}
                onPress={() => phoneRef.current?.focus()}
                activeOpacity={1}
              >
                <View style={S.countryChip}>
                  <Text style={S.flagEmoji}>🇪🇹</Text>
                  <Text style={S.countryCode}>+251</Text>
                </View>
                <View style={S.phoneDivider} />
                <TextInput
                  ref={phoneRef}
                  style={S.phoneInput}
                  value={localNumber}
                  onChangeText={formatPhone}
                  keyboardType="phone-pad"
                  maxLength={9}
                  placeholder="9XX XXX XXXX"
                  placeholderTextColor={COLORS.gray}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
                {phoneReady && (
                  <View style={S.checkBadge}>
                    <Text style={S.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={S.privacyNote}>
                🔒  Your number is only used to verify your identity
              </Text>

              {__DEV__ && phoneReady && (
                <TouchableOpacity
                  style={S.devBypass}
                  onPress={async () => {
                    setIsLoading(true);
                    setError('');
                    try {
                      const devCode = await sendBackendOtp();
                      navigation.navigate('OtpVerification', { phone, purpose: 'LOGIN', verificationId: null, devCode });
                    } catch (e) {
                      setError(e.message || 'Backend OTP failed.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  <Text style={S.devBypassText}>🛠 DEV: Use Backend OTP (no Firebase)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── CTA ───────────────────────────────────────── */}
          <TouchableOpacity
            style={[
              S.cta,
              (isLoading || (!showAdmin && !phoneReady)) && S.ctaOff,
            ]}
            onPress={showAdmin ? handleAdminLogin : handleSendOtp}
            disabled={isLoading || (!showAdmin && !phoneReady)}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={S.ctaText}>
                {showAdmin ? 'Sign In' : 'Send Code →'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Admin toggle ──────────────────────────────── */}
          <TouchableOpacity
            style={S.toggleRow}
            onPress={() => { setShowAdmin(!showAdmin); setError(''); }}
          >
            <Text style={S.toggleText}>
              {showAdmin ? '← Back to Phone Login' : 'Admin Sign In'}
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <Text style={S.devUrl} numberOfLines={1}>🔌  {DEV_API_BASE}</Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },

  /* ── Back ── */
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  backArrow: { fontSize: 20, color: COLORS.text, lineHeight: 24 },

  /* ── Icon ── */
  iconArea: { alignItems: 'flex-start', marginBottom: 24 },
  iconRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBox: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 26 },

  /* ── Heading ── */
  title: {
    fontSize: 32, fontWeight: '800', color: COLORS.black,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, color: COLORS.gray, lineHeight: 22, marginBottom: 28,
  },

  /* ── Error ── */
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 14,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorIcon: { fontSize: 14, color: COLORS.error },
  errorText: { flex: 1, color: '#991B1B', fontSize: 13, lineHeight: 18 },

  /* ── Fields ── */
  fields: { marginBottom: 28 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.text,
    marginBottom: 10, letterSpacing: 0.4, textTransform: 'uppercase',
  },

  /* ── Phone input ── */
  phoneBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 18, backgroundColor: COLORS.grayLighter,
    overflow: 'hidden', height: 64,
  },
  phoneBoxFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16,
  },
  flagEmoji: { fontSize: 22 },
  countryCode: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  phoneDivider: { width: 1.5, height: 28, backgroundColor: COLORS.border },
  phoneInput: {
    flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.black,
    paddingHorizontal: 16, letterSpacing: 1,
  },
  checkBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  checkText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },

  privacyNote: {
    fontSize: 12, color: COLORS.gray, marginTop: 10, lineHeight: 17,
  },

  adminHint: {
    fontSize: 11, color: COLORS.gray, marginTop: 12, lineHeight: 16, fontStyle: 'italic',
  },

  /* ── Admin inputs ── */
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.grayLighter,
    borderRadius: 16, borderWidth: 2, borderColor: COLORS.border,
  },
  inputBoxFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  inputIcon: { fontSize: 18, paddingLeft: 16 },
  inputText: {
    flex: 1, fontSize: 15, color: COLORS.black,
    paddingHorizontal: 12, paddingVertical: 18,
  },
  eyeBtn: { paddingHorizontal: 16 },
  eyeIcon: { fontSize: 18 },

  /* ── CTA ── */
  cta: {
    backgroundColor: COLORS.primary, borderRadius: 18,
    paddingVertical: 20, alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
  },
  ctaOff: { opacity: 0.4, shadowOpacity: 0 },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  /* ── Toggle ── */
  toggleRow: { alignItems: 'center', paddingVertical: 8 },
  toggleText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },

  devUrl: {
    fontSize: 10, color: COLORS.gray,
    textAlign: 'center', marginTop: 20, opacity: 0.4,
  },

  devBypass: {
    marginTop: 12, alignItems: 'center',
    backgroundColor: '#FFF3CD', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#FCEDB2',
  },
  devBypassText: { fontSize: 11, color: '#856404', fontWeight: '600' },
});
