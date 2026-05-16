import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { COLORS, DEV_API_BASE, API_URL } from '../../utils/constants';

const TABS = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Sign Up' },
];

export default function PhoneEntryScreen({ navigation }) {
  const dispatch = useDispatch();
  const [tab, setTab] = useState('signin');
  const [digits, setDigits] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const fullPhone = '+251' + digits;
  const phoneReady = digits.length === 9;

  const handleContinue = async () => {
    if (!phoneReady) { setError('Enter a valid 9-digit number.'); return; }
    setLoading(true);
    setError('');
    const purpose = tab === 'signup' ? 'REGISTER' : 'LOGIN';
    try {
      let res = await fetch(API_URL + '/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, purpose }),
      });
      let data = await res.json();

      // Auto-switch: new user tried Sign In → redirect to Sign Up
      if (!res.ok && res.status === 404 && purpose === 'LOGIN') {
        setTab('signup');
        res = await fetch(API_URL + '/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: fullPhone, purpose: 'REGISTER' }),
        });
        data = await res.json();
      }

      if (!res.ok) {
        setError(data.message || 'Could not send code. Try again.');
        return;
      }

      navigation.navigate('OtpVerification', {
        phone: fullPhone,
        purpose: tab === 'signup' ? 'REGISTER' : 'LOGIN',
        devCode: data.data?.devCode,
      });
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    const raw = adminPhone.trim();
    if (!raw || !adminPassword.trim()) { setError('Enter phone and password.'); return; }
    const phone = raw.startsWith('+') ? raw : '+251' + raw.replace(/^0/, '');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 401 ? 'Wrong phone or password.' : data.message || 'Sign in failed.');
        return;
      }
      await SecureStore.setItemAsync('firebaseIdToken', data.data.accessToken);
      if (data.data.refreshToken) {
        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
      }
      dispatch(loadUser());
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const isSignUp = tab === 'signup';

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={S.backBtn}
            onPress={() => navigation.canGoBack() && navigation.goBack()}
          >
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={S.iconWrap}>
            <View style={S.iconCircle}>
              <Text style={S.iconEmoji}>{showAdmin ? '🔐' : isSignUp ? '👤' : '📱'}</Text>
            </View>
          </View>

          {showAdmin ? (
            <>
              <Text style={S.title}>Admin Sign In</Text>
              <Text style={S.subtitle}>Sign in with your admin credentials</Text>
            </>
          ) : (
            <>
              {/* Sign In / Sign Up tabs */}
              <View style={S.tabBar}>
                {TABS.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[S.tabBtn, tab === t.key && S.tabBtnActive]}
                    onPress={() => { setTab(t.key); setError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.title}>
                {isSignUp ? 'Create your\naccount' : 'Welcome\nback'}
              </Text>
              <Text style={S.subtitle}>
                {isSignUp
                  ? 'Enter your phone number to get started'
                  : 'Enter your phone number to continue'}
              </Text>
            </>
          )}

          {/* Error */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorText}>⚠  {error}</Text>
            </View>
          )}

          {showAdmin ? (
            <View style={S.fields}>
              <Text style={S.label}>PHONE NUMBER</Text>
              <View style={S.inputRow}>
                <Text style={S.inputIcon}>📱</Text>
                <TextInput
                  style={S.textInput}
                  value={adminPhone}
                  onChangeText={v => { setAdminPhone(v); setError(''); }}
                  placeholder="+251 9XX XXX XXX"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={[S.label, { marginTop: 16 }]}>PASSWORD</Text>
              <View style={S.inputRow}>
                <Text style={S.inputIcon}>🔒</Text>
                <TextInput
                  style={[S.textInput, { flex: 1 }]}
                  value={adminPassword}
                  onChangeText={v => { setAdminPassword(v); setError(''); }}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={S.eyeBtn}>
                  <Text style={S.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={S.fields}>
              <Text style={S.label}>MOBILE NUMBER</Text>
              <TouchableOpacity
                style={S.phoneRow}
                onPress={() => inputRef.current?.focus()}
                activeOpacity={1}
              >
                <View style={S.countryBadge}>
                  <Text style={S.flag}>🇪🇹</Text>
                  <Text style={S.countryCode}>+251</Text>
                </View>
                <View style={S.divider} />
                <TextInput
                  ref={inputRef}
                  style={S.phoneInput}
                  value={digits}
                  onChangeText={v => { setDigits(v.replace(/\D/g, '').slice(0, 9)); setError(''); }}
                  keyboardType="phone-pad"
                  maxLength={9}
                  placeholder="9XX XXX XXX"
                  placeholderTextColor={COLORS.gray}
                />
                {phoneReady && (
                  <View style={S.checkMark}>
                    <Text style={S.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={S.hint}>🔒  Your number is only used to verify your identity</Text>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[S.cta, (loading || (!showAdmin && !phoneReady)) && S.ctaOff]}
            onPress={showAdmin ? handleAdminLogin : handleContinue}
            disabled={loading || (!showAdmin && !phoneReady)}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={S.ctaText}>
                  {showAdmin ? 'Sign In' : isSignUp ? 'Create Account  →' : 'Continue  →'}
                </Text>
            }
          </TouchableOpacity>

          {/* Admin toggle */}
          <TouchableOpacity
            style={S.toggleRow}
            onPress={() => { setShowAdmin(!showAdmin); setError(''); }}
          >
            <Text style={S.toggleText}>
              {showAdmin ? '← Back to Phone Login' : 'Admin Sign In'}
            </Text>
          </TouchableOpacity>

          {__DEV__ && <Text style={S.devNote}>🔌  {DEV_API_BASE}</Text>}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },

  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, alignSelf: 'flex-start',
  },
  backArrow: { fontSize: 20, color: COLORS.text },

  iconWrap: { marginBottom: 20 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 30 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  title: { fontSize: 30, fontWeight: '800', color: COLORS.black, lineHeight: 36, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.gray, lineHeight: 22, marginBottom: 24 },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 14,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },

  fields: { marginBottom: 28 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.gray, letterSpacing: 0.8, marginBottom: 8 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border, borderRadius: 18,
    backgroundColor: '#F9F9F9', height: 64, overflow: 'hidden',
  },
  countryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  flag: { fontSize: 22 },
  countryCode: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  divider: { width: 1.5, height: 28, backgroundColor: COLORS.border },
  phoneInput: {
    flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.black,
    paddingHorizontal: 16, letterSpacing: 1,
  },
  checkMark: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  checkText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  hint: { fontSize: 12, color: COLORS.gray, marginTop: 10 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border, borderRadius: 16,
    backgroundColor: '#F9F9F9',
  },
  inputIcon: { fontSize: 18, paddingLeft: 16 },
  textInput: { flex: 1, fontSize: 15, color: COLORS.black, paddingHorizontal: 12, paddingVertical: 18 },
  eyeBtn: { paddingHorizontal: 16 },
  eyeIcon: { fontSize: 18 },

  cta: {
    backgroundColor: COLORS.primary, borderRadius: 18,
    paddingVertical: 20, alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
  },
  ctaOff: { opacity: 0.4, shadowOpacity: 0 },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  toggleRow: { alignItems: 'center', paddingVertical: 8 },
  toggleText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },

  devNote: { fontSize: 10, color: COLORS.gray, textAlign: 'center', marginTop: 20, opacity: 0.4 },
});
