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

  const formatPhone = (text) => {
    setLocalNumber(text.replace(/\D/g, '').slice(0, 9));
    setError('');
  };

  const handleSendOtp = async () => {
    if (localNumber.length < 9) {
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
        if (
          msg.includes('INVALID_LOGIN_CREDENTIALS') ||
          msg.includes('INVALID_PASSWORD') ||
          msg.includes('EMAIL_NOT_FOUND')
        ) {
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

          {/* ── Title ─────────────────────────────────────── */}
          <View style={S.titleBlock}>
            <Text style={S.title}>
              {showAdmin ? 'Admin Sign In' : 'Enter your\nphone number'}
            </Text>
            {!showAdmin && (
              <Text style={S.subtitle}>We'll send a 6-digit verification code</Text>
            )}
          </View>

          {/* ── Error ─────────────────────────────────────── */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          {showAdmin ? (
            /* ── Admin fields ──────────────────────────────── */
            <>
              <View style={[S.inputBox, emailFocused && S.inputBoxFocused]}>
                <Text style={S.inputIcon}>✉️</Text>
                <TextInput
                  style={S.inputText}
                  value={adminEmail}
                  onChangeText={(v) => { setAdminEmail(v); setError(''); }}
                  placeholder="Email address"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              <View style={[S.inputBox, S.inputBoxGap, passFocused && S.inputBoxFocused]}>
                <Text style={S.inputIcon}>🔒</Text>
                <TextInput
                  style={[S.inputText, S.flex]}
                  value={adminPassword}
                  onChangeText={(v) => { setAdminPassword(v); setError(''); }}
                  placeholder="Password"
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
            </>
          ) : (
            /* ── Phone row ─────────────────────────────────── */
            <View style={S.phoneRow}>
              <View style={S.countryBox}>
                <Text style={S.flagText}>🇪🇹</Text>
                <Text style={S.countryCode}>+251</Text>
              </View>

              <TouchableOpacity
                style={[S.phoneBox, phoneFocused && S.inputBoxFocused]}
                onPress={() => phoneRef.current?.focus()}
                activeOpacity={1}
              >
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
              </TouchableOpacity>
            </View>
          )}

          {/* ── Continue button ────────────────────────────── */}
          <TouchableOpacity
            style={[S.cta, isLoading && S.ctaLoading]}
            onPress={showAdmin ? handleAdminLogin : handleSendOtp}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={S.ctaText}>
                {showAdmin ? 'Sign In' : 'Continue →'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Bottom link ────────────────────────────────── */}
          <TouchableOpacity
            style={S.adminToggle}
            onPress={() => { setShowAdmin(!showAdmin); setError(''); }}
          >
            <Text style={S.adminToggleText}>
              {showAdmin ? '← Back to Phone Login' : 'Admin Sign In'}
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <Text style={S.devUrl} numberOfLines={1}>🔌 {DEV_API_BASE}</Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  /* ── Title ── */
  titleBlock: { marginBottom: 40 },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.black,
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.gray,
    marginTop: 10,
    lineHeight: 22,
  },

  /* ── Error ── */
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#991B1B', fontSize: 14 },

  /* ── Phone row ── */
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  flagText: { fontSize: 24 },
  countryCode: { fontSize: 17, fontWeight: '700', color: COLORS.black },

  phoneBox: {
    flex: 1,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  phoneInput: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    paddingHorizontal: 18,
    paddingVertical: 20,
    letterSpacing: 1,
  },

  /* ── Admin inputs ── */
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLighter,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 28,
  },
  inputBoxGap: { marginBottom: 28 },
  inputBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  inputIcon: { fontSize: 18, paddingLeft: 16 },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  eyeBtn: { paddingHorizontal: 16 },
  eyeIcon: { fontSize: 18 },

  /* ── CTA ── */
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaLoading: { opacity: 0.7 },
  ctaText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  /* ── Admin toggle ── */
  adminToggle: { alignItems: 'center', paddingVertical: 8 },
  adminToggleText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },

  devUrl: {
    fontSize: 10,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.5,
  },
});
