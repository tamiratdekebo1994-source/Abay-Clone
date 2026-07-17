import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { COLORS, API_URL } from '../../utils/constants';
import { t } from '../../utils/i18n';

export default function PhoneEntryScreen({ navigation }) {
  const language = useSelector((s) => s.settings.language);
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
        setError(data.message || t('couldNotSendCode', language));
        return;
      }

      navigation.navigate('OtpVerification', {
        phone: fullPhone,
        purpose,
        devCode: data.data?.devCode,
      });
    } catch {
      setError(t('networkError', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={S.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={S.container}>

          <TouchableOpacity style={S.back} onPress={() => navigation.goBack()}>
            <Text style={S.backText}>←</Text>
          </TouchableOpacity>

          <View style={S.content}>
            <Text style={S.title}>{t('whatsYourPhoneNumber', language)}</Text>
            <Text style={S.subtitle}>{t('weWillSendCode', language)}</Text>

            {!!error && (
              <View style={S.errorBox}>
                <Text style={S.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={S.phoneRow}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
            >
              <View style={S.prefix}>
                <View style={S.flagBadge}>
                  <Text style={S.flagBadgeText}>ET</Text>
                </View>
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
              : <Text style={S.ctaText}>{t('continueArrow', language)}</Text>
            }
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 40 },

  back: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F2F2F2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 44, alignSelf: 'flex-start',
  },
  backText: { fontSize: 22, color: '#333' },

  content: { flex: 1 },

  title: {
    fontSize: 34, fontWeight: '800', color: '#111',
    lineHeight: 42, marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15, color: '#999', marginBottom: 40, lineHeight: 22,
  },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: '#EBEBEB',
    borderRadius: 16, height: 66,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  prefix: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 8,
  },
  flagBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, backgroundColor: COLORS.primary,
  },
  flagBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  code: { fontSize: 17, fontWeight: '700', color: '#111' },
  sep: { width: 1.5, height: 30, backgroundColor: '#E0E0E0' },
  input: {
    flex: 1, fontSize: 20, fontWeight: '600', color: '#111',
    paddingHorizontal: 16, letterSpacing: 2,
  },

  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 20,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.3 },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
});
