import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
  Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { COLORS, PAYMENT_METHODS } from '../utils/constants';
import { t, tf } from '../utils/i18n';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

const METHOD_COLORS = {
  TELEBIRR:    { bg: '#7C3AED', light: '#EDE9FE', label: '📱 Telebirr' },
  CBE_BIRR:    { bg: '#1D4ED8', light: '#DBEAFE', label: '🏦 CBE Birr' },
  AWASH_BANK:  { bg: '#EA580C', light: '#FFEDD5', label: '🏦 Awash' },
  DASHEN_BANK: { bg: '#15803D', light: '#DCFCE7', label: '🏦 Dashen' },
};

const STATUS_CONFIG = {
  PENDING:   { labelKey: 'pending',         bg: '#FEF3C7', color: '#92400E' },
  APPROVED:  { labelKey: 'statusApproved',  bg: '#DBEAFE', color: '#1D4ED8' },
  COMPLETED: { labelKey: 'statusCompleted', bg: '#DCFCE7', color: '#15803D' },
  FAILED:    { labelKey: 'status_FAILED',   bg: '#FEE2E2', color: '#DC2626' },
};

const WITHDRAW_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'CASH');

export default function WalletScreen() {
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const isDark = theme === 'dark';

  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState({
    amount: '', method: 'TELEBIRR', accountNumber: '', accountName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sheetAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => { loadWallet(); }, []);

  const loadWallet = async () => {
    try {
      const { data } = await api.get('/wallet');
      setWallet(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const openSheet = () => {
    setShowSheet(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 500, duration: 240, useNativeDriver: true }).start(() =>
      setShowSheet(false)
    );
  };

  const handleWithdraw = async () => {
    const { amount, method, accountNumber, accountName } = form;
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 100) {
      Alert.alert(t('minWithdrawalAlert', language)); return;
    }
    if (amt > (wallet?.balance || 0)) {
      Alert.alert(t('insufficientBalance', language)); return;
    }
    if (!accountNumber.trim() || !accountName.trim()) {
      Alert.alert(t('fillAllFields', language)); return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt, method, accountNumber, accountName });
      Alert.alert(t('requestSubmittedTitle', language), t('requestSubmittedBody', language));
      closeSheet();
      setForm({ amount: '', method: 'TELEBIRR', accountNumber: '', accountName: '' });
      loadWallet();
    } catch (err) {
      Alert.alert(t('errorTitle', language), err.response?.data?.message || t('withdrawFailedBody', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalWithdrawn = wallet?.withdrawals
    ?.filter((w) => w.status === 'COMPLETED')
    .reduce((sum, w) => sum + w.amount, 0) ?? 0;

  const bg = isDark ? '#0F172A' : '#F1F5F9';
  const card = isDark ? '#1E293B' : '#FFFFFF';

  if (isLoading) {
    return (
      <View style={[S.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      {/* ── Balance header ── */}
      <SafeAreaView style={S.header} edges={['top']}>
        <Text style={S.headerTitle}>{t('myWallet', language)}</Text>

        <View style={S.balanceCard}>
          <Text style={S.balanceLabel}>{t('balance', language)}</Text>
          <Text style={S.balanceAmount}>
            ETB {wallet?.balance?.toLocaleString('en-ET', { minimumFractionDigits: 2 }) ?? '0.00'}
          </Text>
          {wallet?.pendingAmount > 0 && (
            <View style={S.pendingChip}>
              <Text style={S.pendingChipText}>{tf('pendingAmountTemplate', language, { amount: wallet.pendingAmount.toFixed(2) })}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[S.withdrawBtn, (!wallet?.balance || wallet.balance < 100) && S.withdrawBtnDisabled]}
            onPress={openSheet}
            disabled={!wallet?.balance || wallet.balance < 100}
            activeOpacity={0.85}
          >
            <Text style={S.withdrawBtnText}>💸  {t('withdrawFunds', language)}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats row ── */}
        <View style={S.statsRow}>
          <View style={S.statItem}>
            <Text style={S.statVal}>ETB {wallet?.lifetimeEarnings?.toFixed(0) ?? '0'}</Text>
            <Text style={S.statLabel}>{t('lifetimeEarned', language)}</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.statItem}>
            <Text style={S.statVal}>ETB {totalWithdrawn.toFixed(0)}</Text>
            <Text style={S.statLabel}>{t('totalWithdrawn', language)}</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.statItem}>
            <Text style={S.statVal}>{wallet?.withdrawals?.length ?? 0}</Text>
            <Text style={S.statLabel}>{t('requests', language)}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── History ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadWallet(); }}
            colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={[S.sectionTitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
          {t('withdrawalHistory', language)}
        </Text>

        {!wallet?.withdrawals?.length ? (
          <View style={[S.emptyCard, { backgroundColor: card }]}>
            <Text style={S.emptyEmoji}>💳</Text>
            <Text style={[S.emptyText, { color: isDark ? '#CBD5E1' : '#374151' }]}>{t('noWithdrawalsYet', language)}</Text>
            <Text style={[S.emptySub, { color: isDark ? '#64748B' : '#9CA3AF' }]}>
              {t('withdrawalHistoryEmptyBody', language)}
            </Text>
          </View>
        ) : (
          wallet.withdrawals.map((w) => {
            const mc = METHOD_COLORS[w.method] || { bg: '#6B7280', light: '#F3F4F6', label: w.method };
            const sc = STATUS_CONFIG[w.status] || { labelKey: null, bg: '#F3F4F6', color: '#6B7280' };
            const statusLabel = sc.labelKey ? t(sc.labelKey, language) : w.status;
            return (
              <View key={w.id} style={[S.txCard, { backgroundColor: card }]}>
                <View style={[S.txMethodBadge, { backgroundColor: mc.bg }]}>
                  <Text style={S.txMethodIcon}>
                    {w.method === 'TELEBIRR' ? '📱' : '🏦'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.txMethod, { color: isDark ? '#F1F5F9' : '#111827' }]}>{mc.label}</Text>
                  <Text style={[S.txAccount, { color: isDark ? '#94A3B8' : '#6B7280' }]}>{w.accountNumber}</Text>
                  <Text style={[S.txDate, { color: isDark ? '#64748B' : '#9CA3AF' }]}>
                    {new Date(w.createdAt).toLocaleDateString('en-ET', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={S.txRight}>
                  <Text style={[S.txAmount, { color: isDark ? '#F1F5F9' : '#111827' }]}>
                    ETB {w.amount.toFixed(2)}
                  </Text>
                  <View style={[S.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[S.statusText, { color: sc.color }]}>{statusLabel}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <Text style={[S.footerNote, { color: isDark ? '#475569' : '#9CA3AF' }]}>
          {t('withdrawalFooterNote', language)}
        </Text>
      </ScrollView>

      {/* ── Withdraw Bottom Sheet ── */}
      <Modal visible={showSheet} transparent animationType="none" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[S.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>{t('withdrawFunds', language)}</Text>
            <Text style={S.sheetBalance}>
              {tf('availableAmountTemplate', language, { amount: wallet?.balance?.toFixed(2) ?? '0.00' })}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Quick amount chips */}
              <Text style={S.fieldLabel}>{t('amountEtb', language)}</Text>
              <View style={S.quickRow}>
                {QUICK_AMOUNTS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[S.quickChip, form.amount === String(q) && S.quickChipActive]}
                    onPress={() => setForm((p) => ({ ...p, amount: String(q) }))}
                  >
                    <Text style={[S.quickChipText, form.amount === String(q) && S.quickChipTextActive]}>
                      {q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={S.input}
                value={form.amount}
                onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
                placeholder={t('enterCustomAmount', language)}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />

              {/* Method */}
              <Text style={[S.fieldLabel, { marginTop: 16 }]}>{t('paymentMethod', language)}</Text>
              <View style={S.methodGrid}>
                {WITHDRAW_METHODS.map((m) => {
                  const mc = METHOD_COLORS[m.value] || { bg: '#6B7280', light: '#F3F4F6' };
                  const active = form.method === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[S.methodBtn, { borderColor: active ? mc.bg : '#E5E7EB', backgroundColor: active ? mc.light : '#F9FAFB' }]}
                      onPress={() => setForm((p) => ({ ...p, method: m.value }))}
                    >
                      <Text style={S.methodEmoji}>{m.icon}</Text>
                      <Text style={[S.methodLabel, { color: active ? mc.bg : '#6B7280', fontWeight: active ? '700' : '500' }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Account fields */}
              <Text style={[S.fieldLabel, { marginTop: 16 }]}>{t('accountNumberShort', language)}</Text>
              <TextInput
                style={S.input}
                value={form.accountNumber}
                onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v }))}
                placeholder={t('accountNumberPlaceholder', language)}
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />

              <Text style={[S.fieldLabel, { marginTop: 12 }]}>{t('accountNameShort', language)}</Text>
              <TextInput
                style={S.input}
                value={form.accountName}
                onChangeText={(v) => setForm((p) => ({ ...p, accountName: v }))}
                placeholder={t('accountNamePlaceholder', language)}
                placeholderTextColor="#9CA3AF"
              />

              <TouchableOpacity
                style={[S.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleWithdraw}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting
                  ? <ActivityIndicator color="#1B4332" />
                  : <Text style={S.submitBtnText}>{t('submitRequest', language)}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { backgroundColor: '#FCBF49', paddingBottom: 0 },
  headerTitle: { color: 'rgba(27,67,50,0.75)', fontSize: 13, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', paddingTop: 4, marginBottom: 16 },

  // Balance card
  balanceCard: { marginHorizontal: 16, marginBottom: 0, alignItems: 'center', paddingBottom: 24 },
  balanceLabel: { color: 'rgba(27,67,50,0.65)', fontSize: 13, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  balanceAmount: { color: '#1B4332', fontSize: 48, fontWeight: '900', letterSpacing: -1, marginBottom: 10 },
  pendingChip: {
    backgroundColor: 'rgba(27,67,50,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16,
  },
  pendingChipText: { color: 'rgba(27,67,50,0.8)', fontSize: 13, fontWeight: '500' },
  withdrawBtn: {
    backgroundColor: '#1B4332', borderRadius: 50,
    paddingVertical: 14, paddingHorizontal: 36,
    shadowColor: '#1B4332', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  withdrawBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  withdrawBtnText: { color: '#FCBF49', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  // Stats row
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(27,67,50,0.08)',
    marginHorizontal: 16, marginBottom: 0, borderRadius: 14,
    paddingVertical: 14, marginTop: 16, marginBottom: 0,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#1B4332', fontSize: 15, fontWeight: '800' },
  statLabel: { color: 'rgba(27,67,50,0.55)', fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(27,67,50,0.12)' },

  // History
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },

  emptyCard: {
    borderRadius: 16, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center' },

  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  txMethodBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txMethodIcon: { fontSize: 20 },
  txMethod: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  txAccount: { fontSize: 13, marginBottom: 2 },
  txDate: { fontSize: 11 },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontSize: 16, fontWeight: '800' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  footerNote: { fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, maxHeight: '85%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sheetBalance: { fontSize: 14, color: '#16A34A', fontWeight: '600', marginBottom: 20 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  quickChipActive: { backgroundColor: '#FFFBEB', borderColor: '#FCBF49' },
  quickChipText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  quickChipTextActive: { color: '#B8860B' },

  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },

  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },
  methodEmoji: { fontSize: 16 },
  methodLabel: { fontSize: 13 },

  submitBtn: {
    backgroundColor: '#FCBF49', borderRadius: 50,
    paddingVertical: 17, alignItems: 'center', marginTop: 24,
    shadowColor: '#FCBF49', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  submitBtnText: { color: '#1B4332', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
