import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, API_URL } from '../../utils/constants';

export default function PhoneEntryScreen({ navigation }) {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const fullPhone = '+251' + digits;
  const phoneReady = digits.length === 9;

  const handleContinue = async () => {
    if (!phoneReady) return;
    setLoading(true);
    setError('');
    try {
      let purpose = 'LOGIN';
      let res = await fetch(API_URL + '/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, purpose }),
      });
      let data = await res.json();

      if (!res.ok && res.status === 404) {
        purpose = 'REGISTER';
        res = await fetch(API_URL + '/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: fullPhone, purpose }),
        });
        data = await res.json();
      }

      if (!res.ok) {
        setError(data.message || 'Could not send code. Try again.');
        return;
      }

      navigation.navigate('OtpVerification', {
        phone: fullPhone,
        purpose,
        devCode: data.data?.devCode,
      });
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

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
                <Text style={S.iconEmoji}>📱</Text>
              </View>
              <Text style={S.headerTitle}>What's your{'\n'}phone number?</Text>
              <Text style={S.headerSub}>We'll send you a verification code</Text>
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

          <View style={S.content}>
            <Text style={S.label}>Phone Number</Text>
            <TouchableOpacity
              style={S.phoneRow}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
            >
              <View style={S.prefix}>
                <Text style={S.flag}>🇪🇹</Text>
                <Text style={S.code}>+251</Text>
              </View>
              <View style={S.sep} />
              <TextInput
                ref={inputRef}
                style={S.input}
                value={digits}
                onChangeText={v => { setDigits(v.replace(/\D/g, '').slice(0, 9)); setError(''); }}
                keyboardType="phone-pad"
                maxLength={9}
                placeholder="9XX XXX XXX"
                placeholderTextColor="#BBBBBB"
                autoFocus
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[S.cta, (!phoneReady || loading) && S.ctaDisabled]}
            onPress={handleContinue}
            disabled={!phoneReady || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={S.ctaText}>Continue →</Text>
            }
          </TouchableOpacity>

          <Text style={S.terms}>
            By continuing, you agree to ET Spark's{'\n'}Terms of Service and Privacy Policy.
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  headerTitle: {
    color: COLORS.white, fontSize: 24, fontWeight: '800',
    textAlign: 'center', lineHeight: 30, marginBottom: 8,
  },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center' },
  wave: {
    height: 28, backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },

  body: { flex: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 32 },
  content: { flex: 1 },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorText: { color: '#991B1B', fontSize: 13 },

  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.gray,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 8,
  },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 16, height: 66,
    backgroundColor: '#FAFAFA',
  },
  prefix: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 8,
  },
  flag: { fontSize: 24 },
  code: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sep: { width: 1.5, height: 30, backgroundColor: COLORS.border },
  input: {
    flex: 1, fontSize: 20, fontWeight: '600', color: COLORS.text,
    paddingHorizontal: 16, letterSpacing: 2,
  },

  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 20,
    alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  ctaDisabled: { opacity: 0.35, shadowOpacity: 0 },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  terms: {
    fontSize: 12, color: COLORS.gray, textAlign: 'center',
    lineHeight: 17, marginTop: 16,
  },
});
