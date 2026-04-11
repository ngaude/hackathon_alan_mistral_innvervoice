import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import {
  ANCHOR_MOOD_MAX,
  ANCHOR_MOOD_MIN,
  MOOD_COLOR_CALM,
  MOOD_COLOR_EXCITED,
  MOOD_COLOR_SAD,
  clampAnchorMood,
  describeAnchorMoodLabel,
  thumbTintForAnchorMood,
} from '../constants/anchorMood';
import { theme } from '../constants/theme';

type Props = {
  value: number;
  onValueChange?: (v: number) => void;
  onSlidingComplete?: () => void;
  disabled?: boolean;
  /** Anchoring, analysis, or feedback before/after (same color code). */
  variant?: 'anchoring' | 'analysis' | 'feedbackBefore' | 'feedbackAfter';
  /** Read-only reference (“at the start”) — no slider. */
  readOnly?: boolean;
};

export function AnchorMoodSlider({
  value,
  onValueChange,
  onSlidingComplete,
  disabled,
  variant = 'anchoring',
  readOnly = false,
}: Props) {
  const title =
    variant === 'anchoring'
      ? 'How you feel right now'
      : variant === 'analysis'
        ? 'Current mood (you can still adjust)'
        : variant === 'feedbackBefore'
          ? 'At the start of the session'
          : 'After the replay';
  const sub =
    variant === 'anchoring'
      ? 'From purple to green: a continuum between what weighs on you and what lifts you. Place the slider where you are.'
      : variant === 'analysis'
        ? 'You can still adjust before continuing.'
        : variant === 'feedbackBefore'
          ? 'What you indicated when you began.'
          : 'Where are you now, after listening?';

  const showLongLegend = variant === 'anchoring' || variant === 'analysis';

  return (
    <View style={[styles.wrap, readOnly && styles.wrapReadonly]}>
      <Text style={styles.title}>{title}</Text>
      {showLongLegend ? <Text style={styles.sub}>{sub}</Text> : <Text style={styles.subShort}>{sub}</Text>}

      <View style={styles.gradientRow} accessibilityLabel="Mood scale">
        <View style={[styles.seg, { backgroundColor: MOOD_COLOR_SAD }]} />
        <View style={[styles.seg, { backgroundColor: MOOD_COLOR_CALM }]} />
        <View style={[styles.seg, { backgroundColor: MOOD_COLOR_EXCITED }]} />
        {readOnly ? (
          <View
            style={[
              styles.moodMarker,
              {
                left: `${(clampAnchorMood(value) / ANCHOR_MOOD_MAX) * 100}%`,
                backgroundColor: thumbTintForAnchorMood(value),
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.labelsRow}>
        <Text style={[styles.endLabel, { color: MOOD_COLOR_SAD }]}>Heavier</Text>
        <Text style={[styles.midLabel, { color: MOOD_COLOR_CALM }]}>In between</Text>
        <Text style={[styles.endLabel, { color: MOOD_COLOR_EXCITED }]}>More energy</Text>
      </View>

      {readOnly ? null : (
        <Slider
          style={styles.slider}
          minimumValue={ANCHOR_MOOD_MIN}
          maximumValue={ANCHOR_MOOD_MAX}
          step={1}
          value={value}
          onValueChange={onValueChange ?? (() => {})}
          onSlidingComplete={onSlidingComplete}
          disabled={disabled}
          minimumTrackTintColor={theme.border}
          maximumTrackTintColor={theme.border}
          thumbTintColor={thumbTintForAnchorMood(value)}
        />
      )}
      <Text
        style={[styles.liveLabel, { color: thumbTintForAnchorMood(value) }]}
        accessibilityLiveRegion="polite"
      >
        {describeAnchorMoodLabel(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  wrapReadonly: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  sub: { color: theme.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  subShort: { color: theme.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  gradientRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
  },
  moodMarker: {
    position: 'absolute',
    width: 5,
    top: 0,
    bottom: 0,
    marginLeft: -2,
    opacity: 0.95,
  },
  seg: { flex: 1, opacity: 0.85 },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  endLabel: { fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'left' },
  midLabel: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'center',
  },
  slider: { width: '100%', height: 44, marginTop: 4 },
  liveLabel: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '600',
  },
});
