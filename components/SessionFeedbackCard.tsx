import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { AnchorMoodSlider } from './AnchorMoodSlider';

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
 * Feedback: before/after mood on the same 0–10 scale as anchoring. Message-fit slider hidden for now (API still
 * receives default `clarity` from parent state).
 */
export function SessionFeedbackCard({
  moodBefore,
  moodAfter,
  onMoodAfterChange,
  messageFit: _messageFit,
  onMessageFitChange: _onMessageFitChange,
  onSlidingComplete,
  disabled,
}: Props) {
  return (
    <View style={styles.outer}>
      <Text style={styles.kicker}>A moment for you</Text>
      <Text style={styles.intro}>
        Compare how you felt at the start of the session with how you feel after the replay.
      </Text>

      <AnchorMoodSlider readOnly value={moodBefore} variant="feedbackBefore" />

      <AnchorMoodSlider
        value={moodAfter}
        onValueChange={onMoodAfterChange}
        onSlidingComplete={onSlidingComplete}
        disabled={disabled}
        variant="feedbackAfter"
      />
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
});
