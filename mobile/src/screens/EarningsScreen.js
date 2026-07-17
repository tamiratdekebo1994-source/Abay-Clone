import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { driverAPI } from '../services/api';
import { COLORS, TAB_BAR_CLEARANCE } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
const BAR_MAX_H = 52;

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getWeekRange(offsetWeeks = 0) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(today);
  mon.setDate(diff - offsetWeeks * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { label: `${fmt(mon)} – ${fmt(sun)}`, year: mon.getFullYear() };
}

function getPastWeeks(count = 16) {
  const weeks = [];
  for (let i = 1; i <= count; i++) {
    weeks.push(getWeekRange(i));
  }
  return weeks;
}

// Simulated per-day activity (0..1)
const WEEK_BARS = [0.35, 0.60, 0.80, 0.50, 1.00, 0.45, 0.20];

export default function EarningsScreen() {
  const theme = useSelector((state) => state.settings.theme);
  const language = useSelector((state) => state.settings.language);
  const C = getColors(theme);
  const S = getStyles(C);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayIdx = getTodayIndex();
  const currentWeek = getWeekRange(0);
  const pastWeeks = getPastWeeks(16);

  const loadEarnings = async () => {
    try {
      const { data: res } = await driverAPI.getEarnings('week');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadEarnings(); }, []);

  if (isLoading) {
    return (
      <View style={S.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const totalEarnings = data?.totalEarnings?.toFixed(2) ?? '0.00';
  const trips = data?.totalDeliveries ?? 0;
  const avgPerTrip = data?.avgPerTrip?.toFixed(0) ?? '0';

  // Group past weeks by year
  const byYear = {};
  pastWeeks.forEach((w) => {
    if (!byYear[w.year]) byYear[w.year] = [];
    byYear[w.year].push(w.label);
  });

  return (
    <ScrollView
      style={S.root}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadEarnings(); }}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* ── Green header + weekly bar chart ── */}
      <SafeAreaView style={S.chartSection} edges={['top']}>
        <Text style={S.earningsTitle}>{t('earnings', language)}</Text>
        <View style={S.chartRow}>
          {DAY_KEYS.map((dayKey, i) => (
            <View key={dayKey} style={S.barCol}>
              <View style={S.barTrack}>
                <View
                  style={[
                    S.bar,
                    { height: Math.max(4, WEEK_BARS[i] * BAR_MAX_H) },
                    i === todayIdx && S.barActive,
                  ]}
                />
              </View>
              <Text style={[S.barDay, i === todayIdx && S.barDayActive]}>{t(dayKey, language)}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>

      {/* ── Current week dark card ── */}
      <View style={S.weekCard}>
        <View style={S.weekCardTop}>
          <Text style={S.weekCardTitle}>{t('currentWeek', language)}</Text>
          <Text style={S.weekCardRange}>{currentWeek.label}</Text>
        </View>

        <View style={S.weekCardSep} />

        <Text style={S.confirmedLabel}>{t('confirmedEarnings', language)}</Text>
        <Text style={S.confirmedAmt}>ETB {totalEarnings}</Text>

        <View style={S.statsRow}>
          <View style={S.statCell}>
            <Text style={S.statVal}>{trips}</Text>
            <Text style={S.statKey}>{t('trips', language)}</Text>
          </View>
          <View style={S.statLine} />
          <View style={S.statCell}>
            <Text style={S.statVal}>ETB {avgPerTrip}</Text>
            <Text style={S.statKey}>{t('avgPerTrip', language)}</Text>
          </View>
          <View style={S.statLine} />
          <View style={S.statCell}>
            <Text style={S.statVal}>0h 0m</Text>
            <Text style={S.statKey}>{t('onlineTime', language)}</Text>
          </View>
        </View>
      </View>

      {/* ── Weekly Earnings Summary header ── */}
      <View style={S.histHead}>
        <Text style={S.histTitle}>{t('weeklyEarningsSummary', language)}</Text>
        <Text style={S.infoIcon}>ⓘ</Text>
      </View>

      {/* ── Past weeks grouped by year ── */}
      {Object.keys(byYear)
        .sort((a, b) => Number(b) - Number(a))
        .map((year) => (
          <View key={year}>
            <Text style={S.yearLabel}>{year}</Text>
            {byYear[year].map((label, i) => (
              <TouchableOpacity key={i} style={S.weekRow} activeOpacity={0.7}>
                <Text style={S.weekRowLabel}>{label}</Text>
                <View style={S.weekRowRight}>
                  <Text style={S.weekRowAmt}>–</Text>
                  <Text style={S.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

      <View style={{ height: TAB_BAR_CLEARANCE }} />
    </ScrollView>
  );
}

const getStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },

  // Chart / header
  chartSection: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  earningsTitle: {
    color: COLORS.white, fontSize: 20, fontWeight: '800',
    paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8,
  },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + 24 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: {
    width: 10,
    height: BAR_MAX_H,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 5 },
  barActive: { backgroundColor: COLORS.white },
  barDay: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '500', marginTop: 5 },
  barDayActive: { color: COLORS.white, fontWeight: '800' },

  // Week card
  weekCard: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 18,
    padding: 20,
  },
  weekCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekCardTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  weekCardRange: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  weekCardSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  confirmedLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', marginBottom: 6 },
  confirmedAmt: { color: COLORS.accent, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  statKey: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 3 },
  statLine: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)' },

  // History
  histHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  histTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  infoIcon: { fontSize: 18, color: C.gray },
  yearLabel: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    color: C.gray,
    backgroundColor: C.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border || '#EBEBEB',
  },
  weekRowLabel: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  weekRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekRowAmt: { fontSize: 14, color: C.gray },
  chevron: { fontSize: 22, color: C.gray, fontWeight: '300' },
});
