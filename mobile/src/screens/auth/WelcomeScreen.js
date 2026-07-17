import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { COLORS } from '../../utils/constants';
import { t } from '../../utils/i18n';

export default function WelcomeScreen({ navigation }) {
  const language = useSelector((s) => s.settings.language);
  const goToPhone = () => navigation.navigate('PhoneEntry');

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <SafeAreaView style={S.safe}>

        <View style={S.center}>
          <Image source={require('../../../assets/icon.png')} style={S.icon} />
          <Text style={S.brand}>ET SPARK</Text>
          <Text style={S.tagline}>{t('tagline', language)}</Text>
        </View>

        <View style={S.bottom}>
          <TouchableOpacity style={S.btnPrimary} onPress={goToPhone} activeOpacity={0.85}>
            <Text style={S.btnPrimaryText}>{t('getStarted', language)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.btnSecondary} onPress={goToPhone} activeOpacity={0.85}>
            <Text style={S.btnSecondaryText}>{t('alreadyHaveAccount', language)}</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },
  safe: { flex: 1, paddingHorizontal: 28 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    width: 110,
    height: 110,
    borderRadius: 26,
    marginBottom: 36,
  },

  brand: {
    fontSize: 38,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 5,
    marginBottom: 14,
  },

  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },

  bottom: {
    paddingBottom: 44,
  },

  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 19,
    alignItems: 'center',
    marginBottom: 14,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  btnSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
