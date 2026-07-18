import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { COLORS } from '../utils/constants';

const THUMB_SIZE = 52;
const TRACK_PADDING = 4;

// Drag the thumb to the end to confirm — mirrors the "slide to complete" pattern used for
// delivery status steps in apps like Walmart Spark Driver, instead of a tap + confirm dialog.
export default function SlideToConfirm({
  label, labelAm, onConfirm, disabled, loading, color = COLORS.accent, icon = '→',
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);

  const maxTranslate = Math.max(1, trackWidth - THUMB_SIZE - TRACK_PADDING * 2);

  // Recreated whenever disabled/loading/completed/maxTranslate change — a PanResponder built
  // once via useRef would freeze these values in its closures at first render (e.g. `disabled`
  // captured as true before a proof-of-delivery photo exists) and never see later updates,
  // even though the component keeps re-rendering with the correct current props.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !loading && !completed,
        onMoveShouldSetPanResponder: () => !disabled && !loading && !completed,
        onPanResponderMove: (evt, gestureState) => {
          const x = Math.min(Math.max(0, gestureState.dx), maxTranslate);
          translateX.setValue(x);
        },
        onPanResponderRelease: (evt, gestureState) => {
          const x = Math.min(Math.max(0, gestureState.dx), maxTranslate);
          if (x >= maxTranslate * 0.75) {
            Animated.timing(translateX, { toValue: maxTranslate, duration: 120, useNativeDriver: false }).start();
            setCompleted(true);
            onConfirm?.();
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
          }
        },
      }),
    [disabled, loading, completed, maxTranslate]
  );

  const fillWidth = Animated.add(translateX, THUMB_SIZE + TRACK_PADDING);
  const labelOpacity = translateX.interpolate({
    inputRange: [0, maxTranslate * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: disabled ? '#D1D5DB' : color }]} />

      <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]} pointerEvents="none">
        {loading ? (
          <ActivityIndicator color={disabled ? '#9CA3AF' : COLORS.primary} />
        ) : (
          <>
            <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
            {!!labelAm && <Text style={[styles.labelAm, disabled && styles.labelDisabled]}>{labelAm}</Text>}
          </>
        )}
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          { backgroundColor: disabled ? '#9CA3AF' : color, transform: [{ translateX }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="small" />
        ) : (
          <Text style={styles.thumbIcon}>{icon}</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: TRACK_PADDING,
  },
  trackDisabled: { opacity: 0.7 },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    opacity: 0.14,
  },
  labelWrap: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
  },
  label: { fontSize: 15, fontWeight: '800', color: '#111827' },
  labelAm: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  labelDisabled: { color: '#9CA3AF' },
  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  thumbIcon: { fontSize: 22, color: COLORS.primary, fontWeight: '900' },
});
