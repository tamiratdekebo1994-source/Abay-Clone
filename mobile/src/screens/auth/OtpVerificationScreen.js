import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { COLORS, API_URL } from '../../utils/constants';
import { t, tf } from '../../utils/i18n';

const CODE_LEN = 6;
const { width: SW } = Dimensions.get('window');

function maskPhone(p) {
  if (!p || p.length < 6) return p;
  return p.slice(0, 5) + ' ••• ' + p.slice(-3);
}

export default function OtpVerificationScreen({ navigation, route }) {
  const { phone, purpose, devCode } = route.params;
  const dispatch = useDispatch();
  const language = useSelector((s) => s.settings.language);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
    const timer = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (code.length === CODE_LEN && !loading) verify(code);
  }, [code]);

  const verify = async (value = code) => {
    if (value.length !== CODE_LEN) { setError(t('enterSixDigitCode', language)); return; }
    setLoading(true);
    setError('');
    try {
      if (purpose === 'REGISTER') {
        // Verify registration OTP → get verificationToken → go to CompleteProfile
        const res = await fetch(API_URL + '/auth/otp/verify-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: value }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || t('invalidCode', language)); return; }
        navigation.navigate('CompleteProfile', {
          phone,
          verificationToken: data.data.verificationToken,
        });
      } else {
        // Verify login OTP → get JWT → load user
        const res = await fetch(API_URL + '/auth/otp/verify-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: value }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || t('invalidCode', language)); return; }
        await SecureStore.setItemAsync('firebaseIdToken', data.data.accessToken);
        if (data.data.refreshToken) {
          await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
        }
        dispatch(loadUser());
      }
    } catch {
      setError(t('networkError', language));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (countdown > 0) return;
    setError('');
    setCode('');
    setCountdown(60);
    try {
      await fetch(API_URL + '/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose }),
      });
    } catch {}
  };

  const boxes = Array.from({ length: CODE_LEN }, (_, i) => code[i] || '');

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

      {/* ── Green header ── */}
      <SafeAreaView style={S.headerBg} edges={['top']}>
        <View style={S.headerInner}>
          <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={S.headerCenter}>
            <View style={S.iconCircle}>
              <Text style={S.iconEmoji}>📲</Text>
            </View>
            <Text style={S.headerTitle}>{t('verifyYourNumber', language)}</Text>
            <Text style={S.headerSub}>{t('etSparkSentCode', language)}</Text>
            <View style={S.phonePill}>
              <Text style={S.phonePillText}>{maskPhone(phone)}</Text>
            </View>
            {purpose === 'REGISTER' && (
              <View style={S.purposeBadge}>
                <Text style={S.purposeText}>{t('newAccountRegistration', language)}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={S.wave} />
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={S.body}>

        {!!error && (
          <View style={S.errorBox}>
            <Text style={S.errorText}>⚠  {error}</Text>
          </View>
        )}

        {/* Dev code banner */}
        {__DEV__ && !!devCode && (
          <View style={S.devBanner}>
            <Text style={S.devBannerText}>{tf('testCodeTemplate', language, { code: devCode })}</Text>
          </View>
        )}
        {__DEV__ && !devCode && (
          <View style={S.devBanner}>
            <Text style={S.devBannerText}>{t('checkBackendTerminal', language)}</Text>
          </View>
        )}

        <Text style={S.instruction}>{t('enterCodeBelow', language)}</Text>

        {/* Hidden input */}
        <TextInput
          ref={inputRef}
          style={S.hiddenInput}
          value={code}
          onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, CODE_LEN)); setError(''); }}
          keyboardType="number-pad"
          maxLength={CODE_LEN}
        />

        {/* Code boxes */}
        <TouchableOpacity style={S.boxRow} onPress={() => inputRef.current?.focus()} activeOpacity={1}>
          {boxes.map((digit, i) => {
            const active = i === code.length;
            const filled = !!digit;
            return (
              <View key={i} style={[S.box, filled && S.boxFilled, active && !loading && S.boxActive]}>
                {loading && filled
                  ? <View style={S.dot} />
                  : <Text style={[S.boxDigit, filled && S.boxDigitFilled]}>{digit || (active ? '|' : '')}</Text>
                }
              </View>
            );
          })}
        </TouchableOpacity>

        {loading && (
          <View style={S.loadingRow}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={S.loadingText}>{t('verifying', language)}</Text>
          </View>
        )}

        {!loading && code.length === CODE_LEN && (
          <TouchableOpacity style={S.verifyBtn} onPress={() => verify()} activeOpacity={0.88}>
            <Text style={S.verifyBtnText}>{t('verifyAndContinue', language)}</Text>
          </TouchableOpacity>
        )}

        {!loading && code.length < CODE_LEN && (
          <View style={[S.verifyBtn, S.verifyBtnGhost]}>
            <Text style={S.verifyBtnGhostText}>
              {CODE_LEN - code.length} {t('digitWord', language)}{language === 'en' && CODE_LEN - code.length !== 1 ? 's' : ''} {t('remainingWord', language)}
            </Text>
          </View>
        )}

        {/* Resend */}
        <View style={S.resendRow}>
          <Text style={S.resendLabel}>{t('didntReceiveItLabel', language)}</Text>
          {countdown > 0
            ? <View style={S.countdownBadge}><Text style={S.countdownText}>{countdown}s</Text></View>
            : <TouchableOpacity onPress={resend}><Text style={S.resendLink}>{t('resendCode', language)}</Text></TouchableOpacity>
          }
        </View>

        <Text style={S.footerNote}>
          {t('codeExpiresFooter', language)}
        </Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BOX_W = (SW - 56 - 50) / CODE_LEN;

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  headerBg: { backgroundColor: COLORS.primary },
  headerInner: { paddingHorizontal: 16, paddingBottom: 28 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  backArrow: { color: COLORS.white, fontSize: 22 },
  headerCenter: { alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconEmoji: { fontSize: 32 },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: '800', marginBottom: 6 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 10 },
  phonePill: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  phonePillText: { color: COLORS.white, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  purposeBadge: {
    marginTop: 10, backgroundColor: COLORS.accent,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5,
  },
  purposeText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  wave: {
    height: 28, backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },

  body: { flex: 1, paddingHorizontal: 28, paddingTop: 8 },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorText: { color: '#991B1B', fontSize: 13 },

  devBanner: {
    backgroundColor: '#D1FAE5', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: 12, alignSelf: 'center',
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  devBannerText: { fontSize: 13, color: '#065F46', fontWeight: '700' },

  instruction: { fontSize: 15, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },

  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  boxRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  box: {
    width: BOX_W, height: 64, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: '#F9F9F9',
    alignItems: 'center', justifyContent: 'center',
  },
  boxFilled: { borderColor: COLORS.primaryLighter, backgroundColor: '#E8F5E9' },
  boxActive: {
    borderColor: COLORS.primary, backgroundColor: COLORS.white,
    shadowColor: COLORS.primary, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  boxDigit: { fontSize: 24, color: COLORS.gray },
  boxDigitFilled: { color: COLORS.primary, fontWeight: '800' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryLighter },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  loadingText: { color: COLORS.gray, fontSize: 14 },

  verifyBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginBottom: 20,
    shadowColor: COLORS.accentDark, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  verifyBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '800' },
  verifyBtnGhost: { backgroundColor: '#F5F5F5', shadowOpacity: 0, elevation: 0 },
  verifyBtnGhostText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resendLabel: { fontSize: 14, color: COLORS.gray },
  resendLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  countdownBadge: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  countdownText: { fontSize: 13, fontWeight: '700', color: COLORS.gray },

  footerNote: { fontSize: 12, color: COLORS.gray, textAlign: 'center', lineHeight: 18 },
});
