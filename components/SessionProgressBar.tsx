import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import type { Phase } from '../types/session';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'SHARING', label: 'Sharing' },
  { phase: 'ANALYSIS', label: 'Analysis' },
  { phase: 'INNERVOICE', label: 'InnerVoice' },
  { phase: 'FEEDBACK', label: 'Feedback' },
  { phase: 'CLOSING', label: 'Closing' },
];

const PHASE_TO_INDEX: Partial<Record<Phase, number>> = {
  ONBOARDING: -1,
  SHARING: 0,
  ANALYSIS: 1,
  INNERVOICE: 2,
  FEEDBACK: 3,
  CLOSING: 4,
};

interface Props {
  phase: Phase;
  onDark?: boolean;
}

export function SessionProgressBar({ phase, onDark }: Props) {
  const activeIdx = PHASE_TO_INDEX[phase] ?? -1;

  const items: React.ReactNode[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    const done = i < activeIdx;
    const active = i === activeIdx;

    if (i > 0) {
      const connFilled = done || active;
      items.push(
        <View
          key={`c${i}`}
          style={[
            styles.connector,
            connFilled && styles.connectorDone,
            onDark && !connFilled && styles.connectorDark,
          ]}
        />
      );
    }

    items.push(
      <View
        key={`d${i}`}
        style={[
          styles.dot,
          done && styles.dotDone,
          active && styles.dotActive,
          onDark && !done && !active && styles.dotDark,
        ]}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.track}>{items}</View>
      <View style={styles.labelsRow}>
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <Text
              key={step.phase}
              style={[
                styles.label,
                done && styles.labelDone,
                active && styles.labelActive,
                onDark && !done && !active && styles.labelDark,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 10;
const DOT_ACTIVE = 14;
const CONNECTOR_H = 3;

const styles = StyleSheet.create({
  root: { marginBottom: 16 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  connector: {
    flex: 1,
    height: CONNECTOR_H,
    backgroundColor: theme.border,
    borderRadius: 1.5,
  },
  connectorDone: { backgroundColor: theme.primaryPurple },
  connectorDark: { backgroundColor: '#3A3A5C' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.border,
  },
  dotDone: { backgroundColor: theme.primaryPurple },
  dotActive: {
    width: DOT_ACTIVE,
    height: DOT_ACTIVE,
    borderRadius: DOT_ACTIVE / 2,
    backgroundColor: theme.primaryPurple,
    borderWidth: 2,
    borderColor: theme.lightPurple,
  },
  dotDark: { backgroundColor: '#3A3A5C' },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
  },
  labelDone: { color: theme.primaryPurple },
  labelActive: { color: theme.primaryPurple, fontWeight: '700', fontSize: 11 },
  labelDark: { color: '#6A6A8A' },
});
