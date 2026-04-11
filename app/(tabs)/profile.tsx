import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../../constants/theme';
import { getInnervoiceApiUrl } from '../../lib/env';
import { fetchUserProfile, syncUserWithServer, updateUserOnServer } from '../../lib/innervoiceApi';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { getDisplayName, getOrCreateUserId, setDisplayName } from '../../lib/userIdentity';
import { useSessionStore } from '../../store/sessionStore';

const COVER = require('../../assets/innervoice-logo.png');

function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function ProfileScreen() {
  const userVoiceId = useSessionStore((s) => s.userMistralVoiceId);
  const apiUrl = getInnervoiceApiUrl();

  const [userId, setUserId] = useState<string>('');
  const [name, setName] = useState('');
  const [serverVoice, setServerVoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

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

  return (
    <View style={styles.wrap}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, padding: 16 },
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
  body: { color: theme.textSecondary, lineHeight: 22 },
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
