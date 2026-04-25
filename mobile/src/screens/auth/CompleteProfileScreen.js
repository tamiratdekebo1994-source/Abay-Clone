import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import api from '../../services/api';
import { loadUser } from '../../store/authStore';
import { COLORS } from '../../utils/constants';

const STEPS = ['OTP', 'Profile', 'Role'];
const TOTAL_STEPS = STEPS.length;
const CURRENT_STEP = 1; // 0-indexed

export default function CompleteProfileScreen({ navigation, route }) {
  const { phone } = route.params;
  const dispatch = useDispatch();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const handleCreate = async () => {
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!role) { setError('Please select your account type.'); return; }

    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/firebase/provision', {
        fullName: fullName.trim(),
        role,
        email: email.trim() || undefined,
      });
      if (role === 'DRIVER') {
        navigation.replace('DriverRegistration');
      } else {
        dispatch(loadUser());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const progressPct = ((CURRENT_STEP + 0.5) / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>

      {/* ── Top bar ──────────────────────────────────────── */}
      <View style={S.topBar}>
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Text style={S.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={S.stepPill}>
          <Text style={S.stepPillText}>Step {CURRENT_STEP + 1} of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Progress bar ─────────────────────────────────── */}
      <View style={S.progressTrack}>
        <View style={[S.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <View style={S.stepLabels}>
        {STEPS.map((s, i) => (
          <Text
            key={s}
            style={[S.stepLabelText, i <= CURRENT_STEP && S.stepLabelActive]}
          >
            {s}
          </Text>
        ))}
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Verified badge */}
        <View style={S.verifiedRow}>
          <View style={S.verifiedBadge}>
            <View style={S.verifiedCheck}><Text style={S.verifiedCheckText}>✓</Text></View>
            <Text style={S.verifiedPhone}>{phone}</Text>
          </View>
        </View>

        <Text style={S.title}>Complete your profile</Text>
        <Text style={S.subtitle}>Just a few details and you're ready to go</Text>

        {/* Error */}
        {!!error && (
          <View style={S.errorBox}>
            <Text style={S.errorText}>⚠  {error}</Text>
          </View>
        )}

        {/* Full name */}
        <Text style={S.label}>Full Name · ሙሉ ስም *</Text>
        <View style={[S.inputWrap, nameFocused && S.inputWrapFocused]}>
          <Text style={S.inputIcon}>👤</Text>
          <TextInput
            style={S.input}
            placeholder="e.g. Abebe Kebede"
            value={fullName}
            onChangeText={(v) => { setFullName(v); setError(''); }}
            autoCapitalize="words"
            placeholderTextColor={COLORS.gray}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>

        {/* Email */}
        <Text style={[S.label, { marginTop: 18 }]}>Email Address <Text style={S.optional}>(optional)</Text></Text>
        <View style={[S.inputWrap, emailFocused && S.inputWrapFocused]}>
          <Text style={S.inputIcon}>✉️</Text>
          <TextInput
            style={S.input}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={COLORS.gray}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        {/* Role selector */}
        <Text style={[S.label, { marginTop: 24 }]}>I am joining as... *</Text>
        <View style={S.roleGrid}>

          <TouchableOpacity
            style={[S.roleCard, role === 'DRIVER' && S.roleCardActive]}
            onPress={() => { setRole('DRIVER'); setError(''); }}
            activeOpacity={0.8}
          >
            {role === 'DRIVER' && (
              <View style={S.roleCheckBadge}><Text style={S.roleCheckBadgeText}>✓</Text></View>
            )}
            <View style={[S.roleIconBox, role === 'DRIVER' && S.roleIconBoxActive]}>
              <Text style={S.roleIconEmoji}>🚚</Text>
            </View>
            <Text style={[S.roleTitle, role === 'DRIVER' && S.roleTitleActive]}>Driver</Text>
            <Text style={[S.roleTag, role === 'DRIVER' && S.roleTagActive]}>ሾፌር</Text>
            <Text style={[S.roleDesc, role === 'DRIVER' && S.roleDescActive]}>
              Deliver orders & earn money daily
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.roleCard, role === 'STORE' && S.roleCardActive]}
            onPress={() => { setRole('STORE'); setError(''); }}
            activeOpacity={0.8}
          >
            {role === 'STORE' && (
              <View style={S.roleCheckBadge}><Text style={S.roleCheckBadgeText}>✓</Text></View>
            )}
            <View style={[S.roleIconBox, role === 'STORE' && S.roleIconBoxActive]}>
              <Text style={S.roleIconEmoji}>🏪</Text>
            </View>
            <Text style={[S.roleTitle, role === 'STORE' && S.roleTitleActive]}>Store</Text>
            <Text style={[S.roleTag, role === 'STORE' && S.roleTagActive]}>ሱቅ</Text>
            <Text style={[S.roleDesc, role === 'STORE' && S.roleDescActive]}>
              Send packages & manage orders
            </Text>
          </TouchableOpacity>

        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[S.cta, (isLoading || !fullName.trim() || !role) && S.ctaOff]}
          onPress={handleCreate}
          disabled={isLoading || !fullName.trim() || !role}
          activeOpacity={0.88}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={S.ctaText}>
              {role === 'DRIVER' ? 'Continue to Driver Setup →' : 'Create Account →'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={S.terms}>
          By continuing you agree to Fetno's Terms of Service and Privacy Policy.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: COLORS.text, lineHeight: 24 },
  stepPill: {
    backgroundColor: COLORS.grayLighter, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  stepPillText: { fontSize: 12, fontWeight: '700', color: COLORS.gray },

  /* ── Progress ── */
  progressTrack: {
    height: 4, backgroundColor: COLORS.grayLight,
    marginHorizontal: 0,
  },
  progressFill: {
    height: 4, backgroundColor: COLORS.primary,
    borderTopRightRadius: 2, borderBottomRightRadius: 2,
  },
  stepLabels: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 24, paddingTop: 6, marginBottom: 4,
  },
  stepLabelText: { fontSize: 11, color: COLORS.grayLight, fontWeight: '600', textTransform: 'uppercase' },
  stepLabelActive: { color: COLORS.primary },

  /* ── Verified ── */
  verifiedRow: { marginTop: 8, marginBottom: 20 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  verifiedCheck: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedCheckText: { color: COLORS.white, fontSize: 11, fontWeight: '900' },
  verifiedPhone: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 28, lineHeight: 20 },

  /* ── Error ── */
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 22,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 18 },

  /* ── Inputs ── */
  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.text,
    marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  optional: { fontSize: 11, fontWeight: '400', color: COLORS.gray, textTransform: 'none' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  inputWrapFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  inputIcon: { fontSize: 18, paddingHorizontal: 14 },
  input: {
    flex: 1, fontSize: 15, color: COLORS.text,
    paddingVertical: 15, paddingRight: 16,
  },

  /* ── Role cards ── */
  roleGrid: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  roleCard: {
    flex: 1, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 18, padding: 16, alignItems: 'center',
    backgroundColor: '#FAFAFA', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  roleCardActive: {
    borderColor: COLORS.primary, backgroundColor: '#F0FDF4',
    shadowColor: COLORS.primary, shadowOpacity: 0.15, elevation: 4,
  },
  roleCheckBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  roleCheckBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  roleIconBox: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  roleIconBoxActive: { backgroundColor: 'rgba(27,67,50,0.1)' },
  roleIconEmoji: { fontSize: 28 },
  roleTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  roleTitleActive: { color: COLORS.primary },
  roleTag: { fontSize: 12, color: COLORS.gray, marginBottom: 8, fontWeight: '500' },
  roleTagActive: { color: COLORS.primaryLight },
  roleDesc: { fontSize: 11, color: COLORS.gray, textAlign: 'center', lineHeight: 15 },
  roleDescActive: { color: COLORS.primaryLight },

  /* ── CTA ── */
  cta: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  ctaOff: { opacity: 0.45, shadowOpacity: 0 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  terms: {
    fontSize: 12, color: COLORS.gray,
    textAlign: 'center', lineHeight: 18,
  },
});
