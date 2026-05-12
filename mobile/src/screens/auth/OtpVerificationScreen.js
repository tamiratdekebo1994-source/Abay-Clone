import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { FIREBASE_API_KEY } from '../../services/firebase';
import api from '../../services/api';
import { COLORS, API_URL } from '../../utils/constants';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const { width: SW } = Dimensions.get('window');

function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return `${phone.slice(0, 6)} ••• ••• ${phone.slice(-2)}`;
}

export default function OtpVerificationScreen({ navigation, route }) {
  const { phone, purpose, verificationId: initialVerificationId, devCode } = route.params;
  const dispatch = useDispatch();

  // verificationId === null means: use backend OTP (no Firebase session)
  const useBackendOtp = !initialVerificationId;

  const [otp, setOtp] = useState(__DEV__ ? (devCode || '123456') : '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [verificationId] = useState(initialVerificationId);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!__DEV__) setTimeout(() => inputRef.current?.focus(), 300);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (otp.length === OTP_LENGTH && !isLoading) {
      handleVerify(otp);
    }
  }, [otp]);

  // Verify via Firebase (standard flow)
  const verifyWithFirebase = async (code) => {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, code, sessionInfo: verificationId }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || 'Verification failed. Try again.';
      throw new Error(msg);
    }

    await SecureStore.setItemAsync('firebaseIdToken', data.idToken);

    try {
      await api.get('/auth/me');
      dispatch(loadUser());
    } catch (meErr) {
      const errCode = meErr.response?.data?.code;
      if (errCode === 'NOT_PROVISIONED') {
        navigation.navigate('CompleteProfile', { phone });
      } else {
        throw meErr;
      }
    }
  };

  // Verify via backend OTP (no Firebase — used when Firebase is unavailable or for testing)
  const verifyWithBackend = async (code) => {
    // LOGIN: verify OTP → get JWT tokens directly
    const res = await fetch(`${API_URL}/auth/otp/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.message || 'Verification failed. Try again.';
      throw new Error(msg);
    }

    // Store JWT as bearer token — auth middleware JWT fallback validates it
    const { accessToken, refreshToken } = data.data;
    await SecureStore.setItemAsync('firebaseIdToken', accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    }
    dispatch(loadUser());
  };

  const handleVerify = async (code = otp) => {
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code sent to your phone`);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      if (useBackendOtp) {
        await verifyWithBackend(code);
      } else {
        await verifyWithFirebase(code);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Unknown error';
      setError(msg);
      setIsLoading(false);
    }
  };

  const handleOtpChange = (val) => {
    setOtp(val.replace(/\D/g, '').slice(0, OTP_LENGTH));
    setError('');
  };

  const boxes = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || '');

  return (
    <View style={S.root}>

      {/* ── Green header panel ──────────────────────────── */}
      <SafeAreaView style={S.header} edges={['top']}>
        <View style={S.headerContent}>
          <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
            <Text style={S.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={S.headerCenter}>
            <View style={S.iconCircle}>
              <Text style={S.iconEmoji}>{useBackendOtp ? '🔑' : '📲'}</Text>
            </View>
            <Text style={S.headerTitle}>Verify your number</Text>
            <Text style={S.headerSub}>
              {useBackendOtp ? 'Check your SMS or backend logs' : 'Code sent to'}
            </Text>
            <View style={S.phonePill}>
              <Text style={S.phonePillText}>{maskPhone(phone)}</Text>
            </View>
          </View>
        </View>

        <View style={S.headerWave} />
      </SafeAreaView>

      {/* ── Body ────────────────────────────────────────── */}
      <View style={S.body}>

        {!!error && (
          <View style={S.errorBox}>
            <Text style={S.errorText}>⚠  {error}</Text>
          </View>
        )}

        <Text style={S.instruction}>
          Enter the {OTP_LENGTH}-digit code below
        </Text>

        {__DEV__ && (
          <View style={S.devBanner}>
            <Text style={S.devBannerText}>
              {useBackendOtp
                ? '🛠 DEV: Backend OTP — check server console for code'
                : '🛠 DEV: Firebase OTP — code pre-filled as 123456'}
            </Text>
          </View>
        )}

        {useBackendOtp && __DEV__ && devCode && (
          <View style={[S.devBanner, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' }]}>
            <Text style={[S.devBannerText, { color: '#065F46' }]}>
              🔢 Your test code: {devCode}
            </Text>
          </View>
        )}

        <TextInput
          ref={inputRef}
          style={S.hiddenInput}
          value={otp}
          onChangeText={handleOtpChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
        />

        <TouchableOpacity
          style={S.boxRow}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
        >
          {boxes.map((digit, i) => {
            const isCursor = i === otp.length && !isLoading;
            const isFilled = !!digit;
            const isPast = i < otp.length;
            return (
              <View
                key={i}
                style={[S.box, isPast && S.boxPast, isCursor && S.boxCursor]}
              >
                {isLoading && isFilled ? (
                  <View style={S.boxDot} />
                ) : (
                  <Text style={[S.boxDigit, isFilled && S.boxDigitFilled]}>
                    {digit || (isCursor ? '|' : '')}
                  </Text>
                )}
              </View>
            );
          })}
        </TouchableOpacity>

        {isLoading && (
          <View style={S.loadingRow}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={S.loadingText}>Verifying...</Text>
          </View>
        )}

        {!isLoading && otp.length === OTP_LENGTH && (
          <TouchableOpacity style={S.verifyBtn} onPress={() => handleVerify()} activeOpacity={0.88}>
            <Text style={S.verifyBtnText}>Verify & Continue →</Text>
          </TouchableOpacity>
        )}

        {otp.length < OTP_LENGTH && !isLoading && (
          <View style={[S.verifyBtn, S.verifyBtnGhost]}>
            <Text style={S.verifyBtnGhostText}>
              {OTP_LENGTH - otp.length} digit{OTP_LENGTH - otp.length !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        )}

        <View style={S.resendRow}>
          <Text style={S.resendPrompt}>Didn't receive it? </Text>
          <TouchableOpacity disabled={countdown > 0}>
            {countdown > 0 ? (
              <View style={S.countdownBadge}>
                <Text style={S.countdownText}>{countdown}s</Text>
              </View>
            ) : (
              <Text style={S.resendLink}>Go back to resend</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={S.hint}>
          {useBackendOtp
            ? 'ℹ  Code sent via backend SMS. Check server logs if SMS is not configured.'
            : 'ℹ  Check your SMS inbox. The code expires in a few minutes.'}
        </Text>
      </View>

    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  /* ── Header ── */
  header: { backgroundColor: COLORS.primary },
  headerContent: { paddingHorizontal: 16, paddingBottom: 28 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  backArrow: { color: COLORS.white, fontSize: 22, lineHeight: 26 },
  headerCenter: { alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  iconEmoji: { fontSize: 32 },
  headerTitle: {
    color: COLORS.white, fontSize: 24, fontWeight: '800',
    marginBottom: 6, letterSpacing: 0.2,
  },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 10 },
  phonePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  phonePillText: { color: COLORS.white, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  headerWave: {
    height: 28, backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -1,
  },

  /* ── Body ── */
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 8 },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },

  instruction: {
    fontSize: 15, color: COLORS.gray, textAlign: 'center', marginBottom: 28,
  },

  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  /* ── OTP Boxes ── */
  boxRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  box: {
    width: (SW - 56 - 50) / OTP_LENGTH,
    height: 64, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  boxPast: { borderColor: COLORS.primaryLighter, backgroundColor: '#E8F5E9' },
  boxCursor: {
    borderColor: COLORS.primary, backgroundColor: COLORS.white,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  boxDigit: { fontSize: 24, color: COLORS.gray, fontWeight: '400' },
  boxDigitFilled: { color: COLORS.primary, fontWeight: '800' },
  boxDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryLighter },

  /* ── Loading ── */
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  loadingText: { color: COLORS.gray, fontSize: 14 },

  /* ── Verify button ── */
  verifyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 18, alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  verifyBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  verifyBtnGhost: { backgroundColor: COLORS.grayLighter, shadowOpacity: 0, elevation: 0 },
  verifyBtnGhostText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },

  /* ── Resend ── */
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resendPrompt: { fontSize: 14, color: COLORS.gray },
  resendLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  countdownBadge: {
    backgroundColor: COLORS.grayLighter, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  countdownText: { fontSize: 13, fontWeight: '700', color: COLORS.gray },

  hint: {
    fontSize: 12, color: COLORS.gray, textAlign: 'center',
    lineHeight: 18, paddingHorizontal: 20,
  },

  devBanner: {
    backgroundColor: '#FFF3CD', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: 16, alignSelf: 'center',
    borderWidth: 1, borderColor: '#FCEDB2',
  },
  devBannerText: { fontSize: 12, color: '#856404', fontWeight: '600' },
});
