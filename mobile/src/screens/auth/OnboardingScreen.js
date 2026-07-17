import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../utils/constants';
import { t } from '../../utils/i18n';

const { width: SW } = Dimensions.get('window');

const SLIDES = [
  { icon: '📦', titleKey: 'onboardTitle1', bodyKey: 'onboardBody1' },
  { icon: '💰', titleKey: 'onboardTitle2', bodyKey: 'onboardBody2' },
  { icon: '💸', titleKey: 'onboardTitle3', bodyKey: 'onboardBody3' },
];

export default function OnboardingScreen({ navigation }) {
  const language = useSelector((s) => s.settings.language);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);
  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace('Welcome');
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * SW, animated: true });
  };

  const onMomentumScrollEnd = (e) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SW));
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.accent} />
      <SafeAreaView style={S.safe}>

        <View style={S.topRow}>
          {!isLast && (
            <TouchableOpacity onPress={finish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={S.skipText}>{t('skip', language)}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[S.slide, { width: SW }]}>
              <View style={S.iconCircle}>
                <Text style={S.iconEmoji}>{slide.icon}</Text>
              </View>
              <Text style={S.title}>{t(slide.titleKey, language)}</Text>
              <Text style={S.body}>{t(slide.bodyKey, language)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={S.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[S.dot, i === index && S.dotActive]} />
          ))}
        </View>

        <View style={S.bottom}>
          <TouchableOpacity style={S.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={S.nextBtnText}>{isLast ? t('getStarted', language) : t('next', language)}</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.accent },
  safe: { flex: 1 },

  topRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 20, height: 40,
  },
  skipText: { color: 'rgba(27,67,50,0.65)', fontSize: 15, fontWeight: '600' },

  slide: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(27,67,50,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  iconEmoji: { fontSize: 64 },
  title: {
    fontSize: 24, fontWeight: '800', color: COLORS.primary,
    textAlign: 'center', marginBottom: 12,
  },
  body: {
    fontSize: 15, color: 'rgba(27,67,50,0.7)',
    textAlign: 'center', lineHeight: 22,
  },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginBottom: 24,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(27,67,50,0.2)',
  },
  dotActive: { width: 22, backgroundColor: COLORS.primary },

  bottom: { paddingHorizontal: 28, paddingBottom: 36 },
  nextBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 19, alignItems: 'center',
  },
  nextBtnText: { fontSize: 17, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.3 },
});
