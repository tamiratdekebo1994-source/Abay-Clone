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
import { COLORS, DEV_API_BASE } from '../../utils/constants';

export default function PhoneEntryScreen({ navigation }) {
  const dispatch = useDispatch();
  const [localNumber, setLocalNumber] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const phoneRef = useRef(null);

  const phone = '+251' + localNumber;
  const phoneReady = localNumber.length === 9;

  const formatPhone = (text) => {
    setLocalNumber(text.replace(/\D/g, '').slice(0, 9));
    setError('');
  };

  const handleSendOtp = async () => {
    if (!phoneReady) {
      setError('Enter a valid 9-digit phone number.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
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
        } else if (msg.includes('QUOTA_EXCEEDED')) {
          setError('Too many requests. Please try again later.');
        } else {
          setError(msg || 'Failed to send code. Try again.');
        }
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

  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail.trim(),
            password: adminPassword,
            returnSecureToken: true,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || '';
        if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('EMAIL_NOT_FOUND')) {
          setError('Invalid email or password.');
        } else if (msg.includes('TOO_MANY_ATTEMPTS')) {
          setError('Too many attempts. Try again later.');
        } else {
          setError(msg || 'Sign in failed. Please try again.');
        }
        return;
      }
      await SecureStore.setItemAsync('firebaseIdToken', data.idToken);
      if (data.refreshToken) {
        await SecureStore.setItemAsync('firebaseRefreshToken', data.refreshToken);
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
          {!showAdmin && (
            <Text style={S.subtitle}>
              We'll send a 6-digit verification code via SMS
            </Text>
          )}

          {/* ── Error ─────────────────────────────────────── */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorIcon}>⚠</Text>
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          {showAdmin ? (
            /* ── Admin fields ─────────────────────────────── */
            <View style={S.fields}>
              <Text style={S.fieldLabel}>Email Address</Text>
              <View style={[S.inputBox, emailFocused && S.inputBoxFocused]}>
                <Text style={S.inputIcon}>✉️</Text>
                <TextInput
                  style={S.inputText}
                  value={adminEmail}
                  onChangeText={(v) => { setAdminEmail(v); setError(''); }}
                  placeholder="admin@example.com"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
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
});
