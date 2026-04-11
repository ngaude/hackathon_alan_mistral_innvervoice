import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import { useRecorder } from '../hooks/useRecorder';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../lib/haptics';
import { transcribeAudioFromUri } from '../services/sttProvider';

type Props = {
  onTranscript: (text: string) => void | Promise<void>;
  onSttError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
  /** Court pour limiter la taille des requêtes STT */
  busyLabel?: string;
  /** Si défini (ex. backend), remplace la transcription locale Mistral. */
  transcribeFromUri?: (fileUri: string) => Promise<string>;
};

export function VoiceSttControl({
  onTranscript,
  onSttError,
  disabled,
  label,
  busyLabel,
  transcribeFromUri,
}: Props) {
  const { start, stop, isRecording } = useRecorder('stt');
  const [processing, setProcessing] = useState(false);

  const busy = processing || !!disabled;
  const canToggle = !busy;

  const onPress = useCallback(async () => {
    if (!canToggle) return;
    hapticLight();
    try {
      if (!isRecording) {
        hapticMedium();
        await start();
        hapticHeavy();
      } else {
        hapticMedium();
        const out = await stop();
        if (!out?.uri) {
          hapticWarning();
          return;
        }
        setProcessing(true);
        try {
          const { text } = transcribeFromUri
            ? { text: await transcribeFromUri(out.uri) }
            : await transcribeAudioFromUri(out.uri);
          hapticSuccess();
          await onTranscript(text);
        } catch (err) {
          hapticWarning();
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          console.warn('[InnerVoice/VoiceSttControl] STT error', {
            message: msg,
            stack: err instanceof Error ? err.stack : undefined,
          });
          onSttError?.(msg);
        } finally {
          setProcessing(false);
        }
      }
    } catch {
      hapticWarning();
      setProcessing(false);
    }
  }, [canToggle, isRecording, onSttError, onTranscript, start, stop, transcribeFromUri]);

  const showRecording = isRecording;
  const showProcessing = processing && !isRecording;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.hint}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        disabled={busy && !isRecording}
        style={({ pressed }) => [
          styles.btn,
          showRecording && styles.btnRecording,
          processing && styles.btnProcessing,
          pressed && canToggle && styles.btnPressed,
          (busy && !isRecording) || disabled ? styles.btnDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ busy: showProcessing, disabled: !!disabled && !isRecording }}
      >
        {showProcessing ? (
          <ActivityIndicator color={theme.textOnPrimary} />
        ) : (
          <Text style={[styles.btnText, showRecording && styles.btnTextLight]}>
            {showRecording ? 'Tap to finish and transcribe' : 'Tap to speak'}
          </Text>
        )}
      </Pressable>
      {showProcessing ? <Text style={styles.sub}>{busyLabel ?? 'Transcribing…'}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hint: { color: theme.textMuted, fontSize: 14, marginBottom: 4 },
  btn: {
    backgroundColor: theme.surface,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
    borderColor: theme.accentCyan,
  },
  btnRecording: {
    backgroundColor: '#B91C1C',
    borderColor: theme.danger,
  },
  btnProcessing: {
    backgroundColor: theme.surfaceElevated,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnTextLight: {
    color: theme.textOnPrimary,
  },
  sub: { color: theme.accentCyan, fontSize: 13, textAlign: 'center' },
});
