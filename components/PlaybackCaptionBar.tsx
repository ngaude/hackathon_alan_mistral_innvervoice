import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../constants/theme';
import { hapticLight } from '../lib/haptics';
import { skipCurrentPlayback } from '../services/audioPlayer';
import { usePlaybackUiStore } from '../store/playbackUiStore';

type Props = {
  /** Shown above the Skip button (subtitle / transcript). */
  caption: string | null;
};

/**
 * Bottom bar: centered text + Skip under the text while audio / TTS is playing.
 */
export function PlaybackCaptionBar({ caption }: Props) {
  const insets = useSafeAreaInsets();
  const active = usePlaybackUiStore((s) => s.activeCount > 0);
  if (!caption && !active) return null;

  return (
    <View
      style={[styles.wrap, { bottom: 16 + Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.card} pointerEvents="auto">
        {caption ? (
          <Text style={styles.captionText} accessibilityRole="text">
            {caption}
          </Text>
        ) : null}
        {active ? (
          <Pressable
            style={({ pressed }) => [
              styles.skipBtn,
              caption ? styles.skipBtnAfterText : styles.skipBtnSolo,
              pressed && styles.skipBtnPressed,
            ]}
            onPress={() => {
              hapticLight();
              void skipCurrentPlayback();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip current audio"
            hitSlop={10}
          >
            {({ pressed }) => (
              <Text style={[styles.skipLabel, pressed && styles.skipLabelDimmed]}>Skip</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
  },
  card: {
    padding: 14,
    paddingBottom: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 26, 46, 0.94)',
    borderWidth: 1,
    borderColor: theme.border,
  },
  captionText: {
    color: theme.textOnInverse,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  skipBtn: {
    alignSelf: 'center',
    minWidth: 140,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnAfterText: {
    marginTop: 12,
  },
  skipBtnSolo: {
    marginTop: 0,
  },
  skipBtnPressed: {
    backgroundColor: theme.border,
    borderColor: theme.textMuted,
    opacity: 0.92,
  },
  skipLabel: {
    color: theme.accentCyan,
    fontWeight: '700',
    fontSize: 15,
  },
  skipLabelDimmed: {
    color: theme.textMuted,
  },
});
