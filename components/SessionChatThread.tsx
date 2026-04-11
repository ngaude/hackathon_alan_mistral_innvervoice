import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import type { ConversationTurn } from '../types/session';

export interface SessionChatThreadProps {
  turns: ConversationTurn[];
  /** Shown when there are no turns yet (e.g. waiting for first agent line). */
  emptyHint?: string;
  /** Use inverse palette (e.g. on dark session background). */
  inverse?: boolean;
}

function bubbleMeta(turn: ConversationTurn): string {
  if (turn.role === 'user') return 'You';
  if (turn.voiceMode === 'INNERVOICE') return 'InnerVoice';
  return 'Guide';
}

export function SessionChatThread({ turns, emptyHint, inverse }: SessionChatThreadProps) {
  const fg = inverse ? theme.textOnInverse : theme.text;
  const fgMuted = inverse ? theme.textMutedOnInverse : theme.textMuted;
  const fgSecondary = inverse ? theme.textMutedOnInverse : theme.textSecondary;

  if (!turns.length) {
    if (!emptyHint) return null;
    return (
      <Text style={[styles.emptyHint, { color: fgSecondary }]} accessibilityRole="text">
        {emptyHint}
      </Text>
    );
  }

  return (
    <View style={styles.thread}>
      {turns.map((turn) => {
        const isUser = turn.role === 'user';
        const isInnervoice = turn.role === 'agent' && turn.voiceMode === 'INNERVOICE';
        return (
          <View key={turn.id} style={[styles.row, isUser ? styles.rowUser : styles.rowAgent]}>
            <View
              style={[
                styles.bubble,
                isUser && (inverse ? styles.bubbleUserInverse : styles.bubbleUser),
                !isUser &&
                  !isInnervoice &&
                  (inverse ? styles.bubbleAgentInverse : styles.bubbleAgent),
                isInnervoice && (inverse ? styles.bubbleInnvInverse : styles.bubbleInnv),
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isUser && (inverse ? styles.bubbleTextUserInverse : styles.bubbleTextUser),
                  !isUser && { color: fg },
                ]}
              >
                {turn.text}
              </Text>
              <Text
                style={[
                  styles.meta,
                  {
                    color: isUser
                      ? inverse
                        ? theme.textOnInverse
                        : theme.textOnPrimary
                      : fgMuted,
                  },
                ]}
                numberOfLines={1}
              >
                {bubbleMeta(turn)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const BUBBLE_RADIUS = 16;

const styles = StyleSheet.create({
  thread: {
    gap: 10,
    marginBottom: 14,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  row: {
    maxWidth: '88%',
  },
  rowUser: {
    alignSelf: 'flex-end',
  },
  rowAgent: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: BUBBLE_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: theme.primaryPurple,
    borderBottomRightRadius: 4,
  },
  bubbleUserInverse: {
    backgroundColor: theme.lightPurple,
    borderBottomRightRadius: 4,
  },
  bubbleTextUser: {
    color: theme.textOnPrimary,
  },
  bubbleTextUserInverse: {
    color: theme.textOnInverse,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleAgent: {
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleAgentInverse: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderBottomLeftRadius: 4,
  },
  bubbleInnv: {
    backgroundColor: theme.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.accentOrange,
    borderWidth: 1,
    borderColor: theme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleInnvInverse: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: theme.accentOrange,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderBottomLeftRadius: 4,
  },
  meta: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    opacity: 0.85,
  },
});
