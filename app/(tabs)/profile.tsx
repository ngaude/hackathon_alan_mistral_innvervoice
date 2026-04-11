import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../../constants/theme';
import {
  VOICE_CLONE_CALIBRATION_PHRASE,
  VOICE_CLONE_INSTRUCTION,
  VOICE_CLONE_TIMING_HINT,
} from '../../constants/voiceClonePhrase';
import { useVoiceProfileRecorder } from '../../hooks/useVoiceProfileRecorder';
import { commitVoiceProfileSample } from '../../lib/commitVoiceProfileSample';
import { getInnervoiceApiUrl } from '../../lib/env';
import { fetchUserProfile, syncUserWithServer, updateUserOnServer } from '../../lib/innervoiceApi';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../../lib/haptics';
import { getDisplayName, getOrCreateUserId, setDisplayName } from '../../lib/userIdentity';
import { playVoiceSampleBase64 } from '../../services/audioPlayer';
import { useSessionStore } from '../../store/sessionStore';

const COVER = require('../../assets/innervoice-logo.png');

function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function ProfileScreen() {
  const userVoiceId = useSessionStore((s) => s.userMistralVoiceId);
  const voiceProfileBase64 = useSessionStore((s) => s.voiceProfileBase64);
  const apiUrl = getInnervoiceApiUrl();
  const { start, stop, isRecording } = useVoiceProfileRecorder();

  const [userId, setUserId] = useState<string>('');
  const [name, setName] = useState('');
  const [serverVoice, setServerVoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getOrCreateUserId();
      const dn = await getDisplayName();
      if (cancelled) return;
      setUserId(id);
      setName(dn);
      if (!apiUrl) {
        setServerVoice(null);
        return;
      }
      try {
        const p = await fetchUserProfile(id);
        if (!cancelled) {
          setServerVoice(Boolean(p.mistralVoiceId));
          if (p.displayName?.trim()) setName(p.displayName.trim());
        }
      } catch {
        if (!cancelled) setServerVoice(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const saveName = useCallback(async () => {
    hapticLight();
    setSaving(true);
    setHint(null);
    try {
      await setDisplayName(name);
      if (apiUrl) {
        const uid = await getOrCreateUserId();
        await updateUserOnServer(uid, { displayName: name.trim() });
        await syncUserWithServer(uid, name.trim());
      }
      hapticSuccess();
      setHint('Saved.');
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }, [name, apiUrl]);

  const onVoiceRecordToggle = useCallback(async () => {
    setVoiceHint(null);
    hapticLight();
    try {
      if (!isRecording) {
        if (!apiUrl) {
          setVoiceHint('Configure InnerVoice API URL in Session settings first.');
          hapticWarning();
          return;
        }
        hapticMedium();
        await start();
        hapticHeavy();
      } else {
        hapticMedium();
        const out = await stop();
        if (!out?.base64) {
          hapticWarning();
          setVoiceHint('Recording too short or empty.');
          return;
        }
        setVoiceBusy(true);
        try {
          const r = await commitVoiceProfileSample(out.base64, out.uri);
          if (!r.ok) {
            setVoiceHint(r.message);
            hapticWarning();
            return;
          }
          hapticSuccess();
          setVoiceHint('Voice updated.');
          try {
            const uid = await getOrCreateUserId();
            const p = await fetchUserProfile(uid);
            setServerVoice(Boolean(p.mistralVoiceId));
          } catch {
            setServerVoice(true);
          }
        } finally {
          setVoiceBusy(false);
        }
      }
    } catch (e) {
      hapticWarning();
      setVoiceHint(e instanceof Error ? e.message : 'Recording error');
    }
  }, [apiUrl, isRecording, start, stop]);

  const onPlaySample = useCallback(async () => {
    if (!voiceProfileBase64) return;
    setVoiceHint(null);
    hapticLight();
    setPlaying(true);
    try {
      await playVoiceSampleBase64(voiceProfileBase64);
    } catch (e) {
      setVoiceHint(e instanceof Error ? e.message : 'Playback failed');
      hapticWarning();
    } finally {
      setPlaying(false);
    }
  }, [voiceProfileBase64]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Image source={COVER} style={styles.hero} resizeMode="contain" />
      <Text style={styles.title}>Profile</Text>

      {!apiUrl ? (
        <Text style={styles.hint}>
          Server not configured: syncing your name and voice with SQLite requires a reachable InnerVoice API URL (see
          Session tab).
        </Text>
      ) : null}

      <Text style={styles.label}>ID on this device</Text>
      <Text style={styles.mono}>{shortId(userId || '…')}</Text>
      <Text style={styles.hint}>Used to find your sessions and voice on the server. It cannot be changed.</Text>

      <Text style={styles.label}>What should we call you</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="First name or nickname"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="sentences"
        editable={!saving}
      />
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, saving && styles.btnDisabled]}
        onPress={saveName}
        disabled={saving}
      >
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save name'}</Text>
      </Pressable>
      {hint ? <Text style={styles.feedback}>{hint}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Voice for InnerVoice replays</Text>
        <Text style={styles.body}>
          {userVoiceId || serverVoice
            ? 'A personal voice is available for this session or your account.'
            : 'Neutral voice is used until you record a print in onboarding.'}
        </Text>
        <Text style={styles.voiceInstruction}>{VOICE_CLONE_INSTRUCTION}</Text>
        <Text style={styles.voicePhrase}>{VOICE_CLONE_CALIBRATION_PHRASE}</Text>
        <Text style={styles.voiceTimingHint}>{VOICE_CLONE_TIMING_HINT}</Text>
        <Text style={styles.voiceMicroHint}>
          Stop to upload. Play listens to the sample stored on this device.
        </Text>
        <View style={styles.voiceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Stop recording' : 'Record voice sample'}
            onPress={onVoiceRecordToggle}
            disabled={!isRecording && (!apiUrl || voiceBusy)}
            style={({ pressed }) => [
              styles.voiceBtn,
              styles.voiceBtnRecord,
              isRecording && styles.voiceBtnRecOn,
              pressed && styles.btnPressed,
              (voiceBusy || !apiUrl) && !isRecording && styles.btnDisabled,
            ]}
          >
            {voiceBusy && !isRecording ? (
              <ActivityIndicator color={theme.textOnPrimary} />
            ) : (
              <Text style={styles.voiceBtnText}>{isRecording ? 'Stop' : 'Record'}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play voice sample"
            onPress={onPlaySample}
            disabled={!voiceProfileBase64 || playing || voiceBusy}
            style={({ pressed }) => [
              styles.voiceBtn,
              styles.voiceBtnPlay,
              pressed && styles.btnPressed,
              (!voiceProfileBase64 || playing || voiceBusy) && styles.btnDisabled,
            ]}
          >
            {playing ? (
              <ActivityIndicator color={theme.accentCyan} />
            ) : (
              <Text style={styles.voiceBtnTextPlay}>Play</Text>
            )}
          </Pressable>
        </View>
        {!voiceProfileBase64 && (userVoiceId || serverVoice) ? (
          <Text style={styles.voiceNote}>
            Play is available after you record a sample on this device (your cloned voice is on the server, but the raw
            file stays local until you record again).
          </Text>
        ) : null}
        {voiceHint ? <Text style={styles.voiceFeedback}>{voiceHint}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 16, paddingBottom: 32 },
  hero: {
    width: '100%',
    height: 140,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: theme.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  body: { color: theme.textSecondary, lineHeight: 22, marginBottom: 8 },
  voiceInstruction: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '600',
  },
  voicePhrase: {
    color: theme.text,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  voiceTimingHint: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  voiceMicroHint: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  voiceRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  voiceBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voiceBtnRecord: { backgroundColor: theme.accentOrangeDeep },
  voiceBtnRecOn: { backgroundColor: '#B91C1C', borderColor: theme.danger },
  voiceBtnPlay: {
    backgroundColor: theme.surface,
    borderColor: theme.accentCyan,
  },
  voiceBtnText: { color: theme.textOnPrimary, fontWeight: '700', fontSize: 15 },
  voiceBtnTextPlay: { color: theme.accentCyan, fontWeight: '700', fontSize: 15 },
  voiceNote: { color: theme.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  voiceFeedback: { color: theme.accentCyan, fontSize: 13, marginTop: 10, lineHeight: 18 },
  mono: {
    color: theme.text,
    fontSize: 15,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  hint: { color: theme.textMuted, lineHeight: 20, fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 16,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: theme.accentOrangeDeep,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnPressed: { opacity: 0.92 },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: theme.textOnPrimary, fontWeight: '700' },
  feedback: { color: theme.accentCyan, marginBottom: 8, fontSize: 14 },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { color: theme.text, fontWeight: '700', marginBottom: 8, fontSize: 16 },
});
