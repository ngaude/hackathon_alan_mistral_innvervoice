import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../../constants/theme';
import {
  VOICE_CLONE_CALIBRATION_PHRASE,
  VOICE_CLONE_INSTRUCTION,
  VOICE_CLONE_TIMING_HINT,
} from '../../constants/voiceClonePhrase';
import { useVoiceProfileRecorder } from '../../hooks/useVoiceProfileRecorder';
import { commitVoiceProfileSample } from '../../lib/commitVoiceProfileSample';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../../lib/haptics';
import { pickMistralCompatibleAudioBase64 } from '../../lib/audioCompat';
import { useSessionStore } from '../../store/sessionStore';

const COVER = require('../../assets/innervoice-logo.png');

export default function VoiceCaptureScreen() {
  const router = useRouter();
  const { start, stop, isRecording } = useVoiceProfileRecorder();
  const setOnboardingDone = useSessionStore((s) => s.setOnboardingDone);
  const setPhase = useSessionStore((s) => s.setPhase);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finishWithBase64(outBase64: string, sourceUri?: string | null) {
    const r = await commitVoiceProfileSample(outBase64, sourceUri);
    if (!r.ok) {
      setErr(r.message);
      hapticWarning();
      return;
    }
    setOnboardingDone(true);
    setPhase('ANCHORING');
    hapticSuccess();
    router.back();
  }

  async function onToggle() {
    setErr(null);
    hapticLight();
    try {
      if (!isRecording) {
        hapticMedium();
        await start();
        hapticHeavy();
      } else {
        hapticMedium();
        const out = await stop();
        if (!out?.base64) {
          hapticWarning();
          setErr('Recording too short or empty.');
          return;
        }
        setBusy(true);
        try {
          await finishWithBase64(out.base64, out.uri);
        } finally {
          setBusy(false);
        }
      }
    } catch (e) {
      hapticWarning();
      setErr(e instanceof Error ? e.message : 'Recording error');
    }
  }

  async function onImport() {
    setErr(null);
    hapticLight();
    setBusy(true);
    try {
      const b64 = await pickMistralCompatibleAudioBase64();
      if (b64) await finishWithBase64(b64);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
      hapticWarning();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Image source={COVER} style={styles.hero} resizeMode="contain" />
      <Text style={styles.title}>Voice print (calm)</Text>
      <Text style={styles.instruction}>{VOICE_CLONE_INSTRUCTION}</Text>
      <Text style={styles.phrase}>{VOICE_CLONE_CALIBRATION_PHRASE}</Text>
      <Text style={styles.hint}>{VOICE_CLONE_TIMING_HINT}</Text>
      <Pressable
        onPress={onToggle}
        disabled={busy}
        style={({ pressed }) => [
          styles.btn,
          styles.btnPrimary,
          isRecording && styles.btnRec,
          pressed && styles.btnPressed,
          busy && styles.btnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityState={{ busy: isRecording || busy }}
      >
        {busy && !isRecording ? (
          <ActivityIndicator color={theme.textOnPrimary} />
        ) : (
          <Text style={styles.btnTextPrimary}>{isRecording ? 'Stop' : 'Record'}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onImport}
        disabled={busy}
        style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed, busy && styles.btnDisabled]}
      >
        <Text style={styles.btnTextGhost}>Import a WAV or MP3 file</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          hapticLight();
          setOnboardingDone(true);
          setPhase('ANCHORING');
          router.back();
        }}
        disabled={busy}
        style={({ pressed }) => [styles.btn, styles.btnSkip, pressed && styles.btnPressed, busy && styles.btnDisabled]}
      >
        <Text style={styles.btnTextSkip}>Continue without recording</Text>
      </Pressable>
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, backgroundColor: theme.bg },
  hero: {
    width: '100%',
    height: 200,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  instruction: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '600',
  },
  phrase: {
    color: theme.text,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  hint: { color: theme.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 10,
  },
  btnPrimary: { backgroundColor: theme.accentOrangeDeep },
  btnGhost: {
    backgroundColor: theme.surface,
    borderColor: theme.accentCyan,
  },
  btnRec: { backgroundColor: '#B91C1C', borderColor: theme.danger },
  btnPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  btnTextPrimary: { color: theme.textOnPrimary, fontSize: 16, fontWeight: '700' },
  btnTextGhost: { color: theme.accentCyan, fontSize: 15, fontWeight: '600' },
  btnSkip: {
    backgroundColor: 'transparent',
    borderColor: theme.textMuted,
    borderWidth: 1,
  },
  btnTextSkip: { color: theme.textMuted, fontSize: 14, fontWeight: '600' },
  err: { color: theme.danger, marginTop: 12, lineHeight: 20 },
});
