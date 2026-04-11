import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { AnchorMoodSlider } from './AnchorMoodSlider';

function describeMessageFitLabel(v: number): string {
  const n = Math.min(10, Math.max(1, Math.round(v)));
  if (n <= 2) return 'Hard to connect, for now';
  if (n <= 4) return 'Still a bit distant';
  if (n <= 6) return 'Mixed — it resonates a little';
  if (n <= 8) return 'It reaches you';
  return 'It feels right for you';
}

type Props = {
  /** Mood at start (0–10), aligned with anchoring. */
  moodBefore: number;
  /** Mood after listening (0–10). */
  moodAfter: number;
  onMoodAfterChange: (v: number) => void;
  /** How much the message fits (1–10) → API `clarity`. */
  messageFit: number;
  onMessageFitChange: (v: number) => void;
  onSlidingComplete?: () => void;
  disabled?: boolean;
};

/**
 * Simple feedback: before/after on the same scale as anchoring + one “message fits” slider.
 */
export function SessionFeedbackCard({
  moodBefore,
  moodAfter,
  onMoodAfterChange,
  messageFit,
  onMessageFitChange,
  onSlidingComplete,
  disabled,
}: Props) {
  return (
    <View style={styles.outer}>
      <Text style={styles.kicker}>A moment for you</Text>
      <Text style={styles.intro}>
        Gently compare how you felt before and after the replay — same colors as at the start. Then say how much the
        words land with you.
      </Text>

      <AnchorMoodSlider readOnly value={moodBefore} variant="feedbackBefore" />

      <AnchorMoodSlider
        value={moodAfter}
        onValueChange={onMoodAfterChange}
        onSlidingComplete={onSlidingComplete}
        disabled={disabled}
        variant="feedbackAfter"
      />

      <View style={styles.fitBlock}>
        <Text style={styles.fitTitle}>Does the message feel true for you?</Text>
        <Text style={styles.fitSub}>Slide between “a little” and “a lot.”</Text>
        <View style={styles.fitLabels}>
          <Text style={styles.fitEnd}>A little</Text>
          <Text style={styles.fitEnd}>A lot</Text>
        </View>
        <Slider
          style={styles.fitSlider}
          minimumValue={1}
          maximumValue={10}
          step={1}
          value={messageFit}
          onValueChange={onMessageFitChange}
          onSlidingComplete={onSlidingComplete}
          disabled={disabled}
          minimumTrackTintColor={theme.accentCyan}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.accentOrange}
        />
        <Text style={styles.fitLive} accessibilityLiveRegion="polite">
          {describeMessageFitLabel(messageFit)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { marginTop: 4 },
  kicker: {
    color: theme.accentCyan,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  intro: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  fitBlock: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  fitTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  fitSub: { color: theme.textMuted, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  fitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fitEnd: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  fitSlider: { width: '100%', height: 44 },
  fitLive: {
    marginTop: 10,
    color: theme.accentOrange,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '600',
  },
});
