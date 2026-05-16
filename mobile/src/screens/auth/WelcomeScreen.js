import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/constants';

const { width: W, height: H } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const goToPhone = () => navigation.navigate('PhoneEntry');

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── Hero ── */}
      <View style={S.hero}>
        <SafeAreaView edges={['top']} style={S.heroSafe}>

          <View style={S.bubble1} />
          <View style={S.bubble2} />
          <View style={S.bubble3} />

          <View style={S.centerContent}>
            {/* Logo */}
            <View style={S.logoRing}>
              <View style={S.logoCore}>
                <Text style={S.logoET}>ET</Text>
                <Text style={S.logoSpark}>⚡</Text>
              </View>
            </View>

            <Text style={S.brandName}>ET Spark</Text>
            <Text style={S.brandNameAm}>ኢቲ ስፓርክ</Text>
            <Text style={S.brandSlogan}>Ethiopia's Fastest Delivery Network</Text>
          </View>

          {/* Stats strip */}
          <View style={S.statsStrip}>
            {[
              { n: '500+', l: 'Drivers\nሾፌሮች' },
              { n: '10K+', l: 'Deliveries\nደሊቨሪዎች' },
              { n: '30 min', l: 'Avg Speed\nፍጥነት' },
            ].map(({ n, l }, i) => (
              <React.Fragment key={n}>
                {i > 0 && <View style={S.statSep} />}
                <View style={S.statItem}>
                  <Text style={S.statNum}>{n}</Text>
                  <Text style={S.statLabel}>{l}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

        </SafeAreaView>
      </View>

      {/* ── Bottom card ── */}
      <View style={S.card}>
        <View style={S.cardHandle} />

        {/* Ethiopian flag strip */}
        <View style={S.flagStrip}>
          <View style={[S.flagBlock, { backgroundColor: '#078930' }]} />
          <View style={[S.flagBlock, { backgroundColor: '#FCDD09' }]} />
          <View style={[S.flagBlock, { backgroundColor: '#DA121A' }]} />
        </View>

        <Text style={S.cardTitle}>Fast, Reliable Delivery</Text>
        <Text style={S.cardSub}>
          Join ET Spark and connect with customers across Ethiopia.{'\n'}
          Earn more, deliver faster.
        </Text>

        <TouchableOpacity style={S.btnMain} onPress={goToPhone} activeOpacity={0.85}>
          <Text style={S.btnMainText}>Get Started  →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.btnGhost} onPress={goToPhone} activeOpacity={0.85}>
          <Text style={S.btnGhostText}>
            Already a driver?{'  '}
            <Text style={S.btnGhostBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const HERO_H = H * 0.57;

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  hero: { height: HERO_H, backgroundColor: COLORS.primary, overflow: 'hidden' },
  heroSafe: { flex: 1 },

  bubble1: {
    position: 'absolute',
    width: W * 0.75, height: W * 0.75, borderRadius: W * 0.375,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -W * 0.22, right: -W * 0.18,
  },
  bubble2: {
    position: 'absolute',
    width: W * 0.5, height: W * 0.5, borderRadius: W * 0.25,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: W * 0.02, left: -W * 0.12,
  },
  bubble3: {
    position: 'absolute',
    width: W * 0.3, height: W * 0.3, borderRadius: W * 0.15,
    backgroundColor: 'rgba(252,191,73,0.1)',
    top: W * 0.28, left: W * 0.06,
  },

  centerContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 12,
  },

  logoRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  logoCore: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  logoET: {
    fontSize: 26, fontWeight: '900', color: COLORS.primary, letterSpacing: -1,
  },
  logoSpark: {
    fontSize: 20, marginLeft: 1, marginTop: -4,
  },

  brandName: {
    fontSize: 44, fontWeight: '900', color: COLORS.white,
    letterSpacing: 0.5, marginBottom: 4,
  },
  brandNameAm: {
    fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
  },
  brandSlogan: {
    fontSize: 11, color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '600',
    textAlign: 'center', paddingHorizontal: 20,
  },

  statsStrip: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    marginHorizontal: 24, borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 8,
    marginBottom: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '900', color: COLORS.accent },
  statLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', marginTop: 3, lineHeight: 14,
  },
  statSep: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },

  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 16, paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 16,
  },
  cardHandle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: COLORS.grayLight,
    alignSelf: 'center', marginBottom: 18,
  },

  flagStrip: {
    flexDirection: 'row', height: 4, borderRadius: 2,
    overflow: 'hidden', marginBottom: 20,
  },
  flagBlock: { flex: 1 },

  cardTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.black,
    marginBottom: 8, letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 14, color: COLORS.gray, lineHeight: 22, marginBottom: 24,
  },

  btnMain: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
  },
  btnMainText: { color: COLORS.white, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  btnGhost: { paddingVertical: 12, alignItems: 'center' },
  btnGhostText: { color: COLORS.gray, fontSize: 14 },
  btnGhostBold: { fontWeight: '800', color: COLORS.primary },
});
