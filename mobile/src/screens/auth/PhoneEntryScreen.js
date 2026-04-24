import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { authAPI } from '../../services/api';
import { login } from '../../store/authStore';
import { COLORS, DEV_API_BASE } from '../../utils/constants';

const { width: SW } = Dimensions.get('window');

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
    setLocalNumber(text.replace(/\D/g, '').slice(0, 9));
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
        Alert.alert('Use OTP Login', 'Your account uses OTP (one-time code) login. Please use the One-Time Code tab.');
      } else if (!err?.message || err?.message === 'Login failed') {
        // Network error — backend unreachable
        setError(`Cannot reach server at ${DEV_API_BASE}\n\nMake sure the backend is running:\ncd ~/Abay-Clone/backend\nnode src/server.js`);
      } else {
        setError(err?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (localNumber.length < 9) { setError('Enter your phone number first.'); return; }
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
    if (localNumber.length < 9) { setError('Please enter a valid 9-digit phone number.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const { data } = await authAPI.requestOtp(phone, purpose);
      navigation.navigate('OtpVerification', { phone, purpose, devCode: data.data?.devCode });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send code. Please try again.';
      if (err.response?.status === 404 && purpose === 'LOGIN') {
        Alert.alert('Not Registered', 'This number is not registered. Sign up?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => navigation.replace('PhoneEntry', { purpose: 'REGISTER' }) },
        ]);
      } else if (err.response?.status === 409 && purpose === 'REGISTER') {
        Alert.alert('Already Registered', 'This phone is already registered.', [
          { text: 'Sign In', onPress: () => navigation.replace('PhoneEntry', { purpose: 'LOGIN' }) },
        ]);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={['top']}>
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Hero ─────────────────────────────────────────── */}
          <View style={S.hero}>
            <View style={S.heroBubble1} />
            <View style={S.heroBubble2} />

            <View style={S.logoShell}>
              <View style={S.logoRing}>
                <Text style={S.logoEmoji}>🚚</Text>
              </View>
              <View style={S.logoBadge}>
                <Text style={S.logoBadgeText}>ET</Text>
              </View>
            </View>

            <Text style={S.brand}>Fetno</Text>
            <Text style={S.brandSub}>Driver Partner · ሾፌር ሽርክና</Text>

            <View style={S.heroPills}>
              <View style={S.heroPill}><Text style={S.heroPillText}>🇪🇹 Ethiopia</Text></View>
              <View style={S.heroPill}><Text style={S.heroPillText}>⚡ Fast Delivery</Text></View>
            </View>
          </View>

          {/* ── Card ─────────────────────────────────────────── */}
          <View style={S.card}>
            <View style={S.cardHandle} />

            <Text style={S.cardTitle}>
              {isLogin ? 'Welcome back' : 'Join Fetno'}
            </Text>
            <Text style={S.cardSub}>
              {isLogin
                ? 'Sign in to start accepting deliveries'
                : 'Create your driver or store account'}
            </Text>

            {/* Segmented control — only visible on login */}
            {isLogin && (
              <View style={S.segWrap}>
                <View style={S.segTrack}>
                  <View style={[S.segThumb, usePassword && S.segThumbRight]} />
                  <TouchableOpacity
                    style={S.segBtn}
                    onPress={() => { setUsePassword(false); setError(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.segLabel, !usePassword && S.segLabelActive]}>One-Time Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={S.segBtn}
                    onPress={() => { setUsePassword(true); setError(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.segLabel, usePassword && S.segLabelActive]}>Password</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={S.errorBox}>
                <View style={S.errorIcon}><Text style={S.errorIconText}>!</Text></View>
                <Text style={S.errorMsg}>{error}</Text>
              </View>
            )}

            {/* Phone field */}
            <Text style={S.fieldLabel}>Phone Number / ስልክ ቁጥር</Text>
            <View style={[S.phoneField, phoneFocused && S.fieldFocused]}>
              <View style={S.countryChip}>
                <Text style={S.countryFlag}>🇪🇹</Text>
                <Text style={S.countryCode}>+251</Text>
              </View>
              <View style={S.fieldDivider} />
              <TextInput
                style={S.phoneInput}
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

            {/* Password field */}
            {usePassword && isLogin && (
              <>
                <Text style={[S.fieldLabel, { marginTop: 18 }]}>Password / የይለፍ ቃል</Text>
                <View style={[S.passField, passFocused && S.fieldFocused]}>
                  <TextInput
                    style={S.passInput}
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
                    style={S.eyeBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={S.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleForgotPassword} style={S.forgotRow}>
                  <Text style={S.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[S.cta, isLoading && S.ctaOff]}
              onPress={usePassword && isLogin ? handlePasswordLogin : handleSendOtp}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={S.ctaText}>
                  {usePassword && isLogin ? 'Sign In' : isLogin ? 'Continue →' : 'Create Account →'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch */}
            <View style={S.switchRow}>
              <Text style={S.switchPrompt}>
                {isLogin ? "New to Fetno?  " : 'Already have an account?  '}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.replace('PhoneEntry', { purpose: isLogin ? 'REGISTER' : 'LOGIN' })}
              >
                <Text style={S.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
              </TouchableOpacity>
            </View>

            {/* Divider + trust signals */}
            <View style={S.trustRow}>
              <View style={S.trustLine} />
              <Text style={S.trustText}>Secure · Encrypted · Trusted</Text>
              <View style={S.trustLine} />
            </View>
          </View>

          {/* Footer */}
          <View style={S.footer}>
            <Text style={S.footerText}>Fetno © 2025 · Made with ❤ in Ethiopia</Text>
            {__DEV__ && (
              <Text style={S.devUrl} numberOfLines={1}>🔌 {DEV_API_BASE}</Text>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  /* ── Hero ── */
  hero: {
    alignItems: 'center',
    paddingTop: 32, paddingBottom: 40, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  heroBubble1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -50,
  },
  heroBubble2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 20, left: -40,
  },
  logoShell: { position: 'relative', marginBottom: 20 },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 38 },
  logoBadge: {
    position: 'absolute', bottom: 0, right: -4,
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  logoBadgeText: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  brand: { color: COLORS.white, fontSize: 34, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  brandSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 },
  heroPills: { flexDirection: 'row', gap: 10 },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },

  /* ── Card ── */
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 26, paddingTop: 14, paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHandle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.grayLight,
    marginBottom: 26,
  },
  cardTitle: { fontSize: 26, fontWeight: '800', color: COLORS.black, marginBottom: 5 },
  cardSub: { fontSize: 14, color: COLORS.gray, marginBottom: 28, lineHeight: 20 },

  /* ── Segmented control ── */
  segWrap: { marginBottom: 28 },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: COLORS.grayLighter,
    borderRadius: 14, padding: 4,
    position: 'relative', height: 46,
  },
  segThumb: {
    position: 'absolute',
    top: 4, left: 4,
    width: '50%', height: 38,
    backgroundColor: COLORS.white,
    borderRadius: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  segThumbRight: { left: '50%', marginLeft: -4 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segLabel: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  segLabelActive: { color: COLORS.primary },

  /* ── Error ── */
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12, padding: 14, marginBottom: 22,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
  },
  errorIconText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  errorMsg: { flex: 1, color: '#991B1B', fontSize: 13, lineHeight: 18 },

  /* ── Fields ── */
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.text,
    marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  phoneField: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, backgroundColor: '#FAFAFA',
    overflow: 'hidden', marginBottom: 4,
  },
  passField: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  fieldFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  countryFlag: { fontSize: 20 },
  countryCode: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  fieldDivider: { width: 1, height: 26, backgroundColor: COLORS.border },
  phoneInput: {
    flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  passInput: {
    flex: 1, fontSize: 15, color: COLORS.text,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeIcon: { fontSize: 19 },
  forgotRow: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 4 },
  forgotText: { fontSize: 13, color: COLORS.primaryLight, fontWeight: '600' },

  /* ── CTA ── */
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaOff: { opacity: 0.55, shadowOpacity: 0 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* ── Switch row ── */
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  switchPrompt: { fontSize: 14, color: COLORS.gray },
  switchLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  /* ── Trust ── */
  trustRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: 10 },
  trustLine: { flex: 1, height: 1, backgroundColor: COLORS.grayLight },
  trustText: { fontSize: 11, color: COLORS.gray, fontWeight: '500' },

  /* ── Footer ── */
  footer: { backgroundColor: COLORS.white, paddingVertical: 18, alignItems: 'center' },
  footerText: { fontSize: 12, color: COLORS.gray },
  devUrl: { fontSize: 10, color: COLORS.gray, marginTop: 4, opacity: 0.6 },
});
