import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnchorMoodSlider } from '../../components/AnchorMoodSlider';
import { SessionChatThread } from '../../components/SessionChatThread';
import { SessionFeedbackCard } from '../../components/SessionFeedbackCard';
import { PlaybackCaptionBar } from '../../components/PlaybackCaptionBar';
import { VoiceSttControl } from '../../components/VoiceSttControl';
import { ANCHOR_MOOD_EQUILIBRIUM, clampAnchorMood } from '../../constants/anchorMood';
import { PHASE_LABELS } from '../../constants/phases';
import { theme } from '../../constants/theme';
import { formatClosingRestitution, formatMoodMovementLine } from '../../lib/closingRestitution';
import { getInnervoiceApiUrl } from '../../lib/env';
import {
  createRemoteSession,
  postSessionEvent,
  syncUserWithServer,
  transcribeOnServer,
} from '../../lib/innervoiceApi';
import { playServerAudioParts } from '../../lib/playAudioQueue';
import { getDisplayName, getOrCreateUserId } from '../../lib/userIdentity';
import { hapticLight } from '../../lib/haptics';
import { buildSummaryFromTurns } from '../../services/summaryFromTurns';
import { crisisUserMessage } from '../../services/safety';
import { useSessionStore } from '../../store/sessionStore';
import type { Phase, SessionSnapshot } from '../../types/session';

const COVER = require('../../assets/innervoice-logo.png');

export default function SessionScreen() {
  const router = useRouter();
  const phase = useSessionStore((s) => s.phase);
  const voiceMode = useSessionStore((s) => s.voiceMode);
  const voiceProfile = useSessionStore((s) => s.voiceProfileBase64);
  const userMistralVoiceId = useSessionStore((s) => s.userMistralVoiceId);
  const onboardingDone = useSessionStore((s) => s.onboardingDone);
  const sessionContext = useSessionStore((s) => s.sessionContext);
  const turns = useSessionStore((s) => s.turns);
  const crisis = useSessionStore((s) => s.crisisTriggered);
  const loading = useSessionStore((s) => s.isLoading);
  const lastError = useSessionStore((s) => s.lastError);
  const innervoiceSeg = useSessionStore((s) => s.innervoicePlayingSegment);
  const analysisAgentText = useSessionStore((s) => s.analysisAgentText);
  const emotionalState = useSessionStore((s) => s.emotionalState);
  const anchorMood = useSessionStore((s) => s.anchorMood);
  const feedbackBeforeStore = useSessionStore((s) => s.feedbackBefore);
  const feedbackAfterStore = useSessionStore((s) => s.feedbackAfter);
  const remoteSessionId = useSessionStore((s) => s.remoteSessionId);
  const voiceGateCompleted = useSessionStore((s) => s.voiceGateCompleted);
  const setVoiceProfile = useSessionStore((s) => s.setVoiceProfile);
  const setUserMistralVoiceId = useSessionStore((s) => s.setUserMistralVoiceId);

  const setPhase = useSessionStore((s) => s.setPhase);
  const setVoiceMode = useSessionStore((s) => s.setVoiceMode);
  const patchSessionContext = useSessionStore((s) => s.patchSessionContext);
  const setAnchorMood = useSessionStore((s) => s.setAnchorMood);
  const setFeedbackAfter = useSessionStore((s) => s.setFeedbackAfter);
  const setFeedbackBefore = useSessionStore((s) => s.setFeedbackBefore);
  const setCrisis = useSessionStore((s) => s.setCrisis);
  const setLoading = useSessionStore((s) => s.setLoading);
  const setError = useSessionStore((s) => s.setError);
  const resetSession = useSessionStore((s) => s.resetSession);
  const setAnalysisAgentText = useSessionStore((s) => s.setAnalysisAgentText);
  const setRemoteSessionId = useSessionStore((s) => s.setRemoteSessionId);
  const setOnboardingDone = useSessionStore((s) => s.setOnboardingDone);
  const hydrateFromServer = useSessionStore((s) => s.hydrateFromServer);
  const setVoiceGateCompleted = useSessionStore((s) => s.setVoiceGateCompleted);

  const [caption, setCaption] = useState<string | null>(null);
  const [serverProfile, setServerProfile] = useState<{
    userId: string;
    displayName: string;
    mistralVoiceId: string | null;
  } | null>(null);

  const [anchorMoodSlider, setAnchorMoodSlider] = useState(ANCHOR_MOOD_EQUILIBRIUM);

  const onAnchorMoodChange = useCallback(
    (v: number) => {
      const r = clampAnchorMood(v);
      setAnchorMoodSlider(r);
      if (phase === 'SHARING' || phase === 'ANALYSIS') {
        patchSessionContext({ anchorMoodLive: r });
      }
    },
    [phase, patchSessionContext]
  );

  useEffect(() => {
    if (phase === 'SHARING' && onboardingDone) {
      patchSessionContext({ anchorMoodLive: ANCHOR_MOOD_EQUILIBRIUM });
    }
  }, [phase, onboardingDone, patchSessionContext]);

  /** Feedback : même échelle qu’à l’ancrage + adéquation du message (`clarity`). */
  const [fbMoodAfter, setFbMoodAfter] = useState(ANCHOR_MOOD_EQUILIBRIUM);
  const [fbMessageFit, setFbMessageFit] = useState(6);
  const prevPhaseRef = useRef<Phase | null>(null);

  const moodBeforeFeedback = useMemo(() => {
    const raw = anchorMood ?? feedbackBeforeStore?.tension ?? sessionContext.anchorMoodLive;
    if (raw == null) return ANCHOR_MOOD_EQUILIBRIUM;
    return clampAnchorMood(raw);
  }, [anchorMood, feedbackBeforeStore?.tension, sessionContext.anchorMoodLive]);

  useEffect(() => {
    if (phase === 'FEEDBACK' && prevPhaseRef.current !== 'FEEDBACK') {
      setFbMoodAfter(moodBeforeFeedback);
      setFbMessageFit(6);
    }
    prevPhaseRef.current = phase;
  }, [phase, moodBeforeFeedback]);

  useEffect(() => {
    const apiBase = getInnervoiceApiUrl();
    if (!apiBase) return;
    let cancelled = false;
    (async () => {
      try {
        const uid = await getOrCreateUserId();
        const dn = await getDisplayName();
        const prof = await syncUserWithServer(uid, dn);
        if (!cancelled) setServerProfile(prof);
        if (!prof.mistralVoiceId) setVoiceGateCompleted(true);
      } catch {
        if (!cancelled) setVoiceGateCompleted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setVoiceGateCompleted]);

  const applySnapshot = useCallback(
    (snap: SessionSnapshot) => {
      hydrateFromServer({
        phase: snap.phase,
        voiceMode: snap.voiceMode,
        voiceProfileBase64: snap.voiceProfileBase64,
        userMistralVoiceId: snap.userMistralVoiceId,
        emotionalState: snap.emotionalState,
        sessionContext: snap.sessionContext,
        consentInnervoice: snap.consentInnervoice,
        anchorMood: snap.anchorMood,
        feedbackBefore: snap.feedbackBefore,
        feedbackAfter: snap.feedbackAfter,
        turns: snap.turns,
        crisisTriggered: snap.crisisTriggered,
        innervoiceScript: snap.innervoiceScript,
      });
      setAnalysisAgentText(snap.analysisAgentText);
    },
    [hydrateFromServer, setAnalysisAgentText]
  );

  useEffect(() => {
    if (!getInnervoiceApiUrl() || !onboardingDone || !voiceGateCompleted) return;
    if (remoteSessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const uid = await getOrCreateUserId();
        const dn = await getDisplayName();
        const { sessionId, state } = await createRemoteSession({
          userId: uid,
          displayName: dn,
          voiceProfileBase64: voiceProfile,
          userMistralVoiceId,
        });
        if (cancelled) return;
        setRemoteSessionId(sessionId);
        applySnapshot(state);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Session API unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    onboardingDone,
    voiceGateCompleted,
    voiceProfile,
    userMistralVoiceId,
    remoteSessionId,
    setLoading,
    setError,
    setRemoteSessionId,
    applySnapshot,
  ]);

  const summary = useMemo(() => {
    const fromCtx = sessionContext.summary.trim();
    if (fromCtx) return fromCtx;
    return buildSummaryFromTurns(turns);
  }, [sessionContext.summary, turns]);

  const sharingChatTurns = useMemo(() => turns.filter((t) => t.phase === 'SHARING'), [turns]);

  const analysisChatTurns = useMemo(
    () => turns.filter((t) => t.phase === 'SHARING' || t.phase === 'ANALYSIS'),
    [turns]
  );

  /** Rejeu InnerVoice (voix clonée) après la problématique — traité entièrement par le serveur. */
  const playInnervoiceReplay = useCallback(
    async (options?: { manageLoading?: boolean }) => {
      const manageLoading = options?.manageLoading !== false;
      if (!remoteSessionId) {
        setError('Missing server session');
        return;
      }
      if (manageLoading) {
        hapticLight();
        setLoading(true);
      }
      setError(null);
      try {
        const { state, audio } = await postSessionEvent(remoteSessionId, {
          type: 'START_INNERVOICE',
          consent: true,
        });
        applySnapshot(state);
        await playServerAudioParts(
          audio.map((a) => ({ base64: a.base64, spokenText: a.spokenText })),
          (t) => setCaption(t)
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Replay error');
      } finally {
        if (manageLoading) {
          setLoading(false);
        }
      }
    },
    [applySnapshot, remoteSessionId, setCaption, setError, setLoading]
  );

  const submitSharingVoice = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) {
        setError('No speech recognized. Try again.');
        return;
      }
      if (!remoteSessionId) {
        setError('Connecting to server… Try again in a moment.');
        return;
      }
      if (phase !== 'SHARING') {
        setError('Unexpected step.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const mood = clampAnchorMood(anchorMoodSlider);
        if (emotionalState == null) {
          patchSessionContext({ anchorMoodLive: mood, explorationTurns: 0, summary: text });
        } else {
          patchSessionContext({ anchorMoodLive: mood });
        }
        const { state, audio, crisisMessage } = await postSessionEvent(remoteSessionId, {
          type: 'SHARING_MESSAGE',
          text,
          mood0to10: mood,
        });
        applySnapshot(state);
        if (crisisMessage || state.crisisTriggered) {
          setCrisis(true);
          hapticLight();
          return;
        }
        await playServerAudioParts(
          audio.map((a) => ({ base64: a.base64, spokenText: a.spokenText })),
          (t) => setCaption(t)
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    },
    [
      anchorMoodSlider,
      applySnapshot,
      emotionalState,
      patchSessionContext,
      phase,
      remoteSessionId,
      setCrisis,
      setCaption,
      setError,
      setLoading,
    ]
  );

  const submitFeedback = useCallback(async () => {
    hapticLight();
    if (!remoteSessionId) {
      setError('Session lost — return to home.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const clarity = Math.min(10, Math.max(1, Math.round(fbMessageFit)));
      const tension = Math.max(1, Math.min(10, clampAnchorMood(fbMoodAfter)));
      const energy = Math.min(
        10,
        Math.max(1, 5 + Math.round((clampAnchorMood(fbMoodAfter) - moodBeforeFeedback) / 2))
      );
      const { state, audio } = await postSessionEvent(remoteSessionId, {
        type: 'FEEDBACK_SUBMIT',
        clarity,
        energy,
        tension,
      });
      applySnapshot(state);
      await playServerAudioParts(
        audio.map((a) => ({ base64: a.base64, spokenText: a.spokenText })),
        (text) => setCaption(text)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [
    applySnapshot,
    fbMessageFit,
    fbMoodAfter,
    moodBeforeFeedback,
    remoteSessionId,
    setCaption,
    setError,
    setLoading,
  ]);

  const transcribeFromUri = useCallback(
    async (uri: string) => {
      if (!remoteSessionId) throw new Error('Session API not ready');
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return transcribeOnServer(remoteSessionId, b64, 'recording.m4a');
    },
    [remoteSessionId]
  );

  const apiUrl = getInnervoiceApiUrl();
  const bg = voiceMode === 'INNERVOICE' ? theme.bgDeep : theme.bg;
  const onDarkScreen = voiceMode === 'INNERVOICE';

  if (crisis) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.bgDeep }]}>
        <Text style={styles.crisisTitle}>Pause</Text>
        <Text style={styles.crisisBody}>{crisisUserMessage()}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.crisisBtn, pressed && styles.btnPressed]}
          onPress={() => {
            hapticLight();
            resetSession();
          }}
        >
          <Text style={styles.btnTextPrimary}>Close and reset</Text>
        </Pressable>
      </View>
    );
  }

  if (!apiUrl) {
    return (
      <View style={[styles.wrap, { flex: 1, backgroundColor: theme.bg, padding: 16, justifyContent: 'center' }]}>
        <Image source={COVER} style={styles.hero} resizeMode="contain" />
        <Text style={styles.blockTitle}>Server required</Text>
        <Text style={styles.body}>
          Sessions are stored on the InnerVoice API. Set a reachable URL from this device (Expo env
          `EXPO_PUBLIC_INNERVOICE_API_URL`) or run Metro on a machine on the same network for LAN IP auto-detection.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Image source={COVER} style={styles.hero} resizeMode="contain" />
      <View style={styles.headerRow}>
        <Text style={[styles.brand, onDarkScreen && styles.textOnDark]}>InnerVoice</Text>
        <Text style={[styles.phaseBadge, onDarkScreen && styles.phaseOnDark]}>{PHASE_LABELS[phase]}</Text>
      </View>
      {serverProfile?.mistralVoiceId && !voiceGateCompleted ? (
        <View style={styles.card}>
          <Text style={styles.label}>Voice</Text>
          <Text style={styles.body}>A voice print is already saved for this account.</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              setUserMistralVoiceId(serverProfile.mistralVoiceId);
              setVoiceProfile(null);
              setOnboardingDone(true);
              setPhase('SHARING');
              setVoiceGateCompleted(true);
            }}
          >
            <Text style={styles.btnTextPrimary}>Use my saved voice</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              setUserMistralVoiceId(null);
              setVoiceProfile(null);
              setOnboardingDone(false);
              setPhase('ONBOARDING');
              setVoiceGateCompleted(true);
              router.push('/onboarding/voice-capture');
            }}
          >
            <Text style={styles.btnText}>Record again</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              setUserMistralVoiceId(null);
              setVoiceProfile(null);
              setOnboardingDone(true);
              setPhase('SHARING');
              setVoiceGateCompleted(true);
            }}
          >
            <Text style={styles.btnTextGhost}>Without my voice (neutral)</Text>
          </Pressable>
        </View>
      ) : null}

      {!(serverProfile?.mistralVoiceId && !voiceGateCompleted) ? (
        <Text style={[styles.modeLine, onDarkScreen && styles.textMutedOnDark]}>
          {voiceMode === 'INNERVOICE' ? '● InnerVoice mode' : '○ Exchange mode (agent)'}
        </Text>
      ) : null}
      {voiceMode === 'INNERVOICE' && innervoiceSeg !== null ? (
        <Text style={[styles.innvHint, onDarkScreen && styles.textMutedOnDark]}>
          Segment {innervoiceSeg + 1}/3 —{' '}
          {voiceProfile || userMistralVoiceId ? 'your voice' : 'simulated voice (Jane, neutral preset)'}
        </Text>
      ) : null}

      {phase === 'ONBOARDING' &&
      !onboardingDone &&
      !(serverProfile?.mistralVoiceId && !voiceGateCompleted) ? (
        <View style={styles.card}>
          <Text style={styles.body}>Record your calm voice for replay, or continue with a neutral voice.</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              router.push('/onboarding/voice-capture');
            }}
          >
            <Text style={styles.btnTextGhost}>Record</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              setOnboardingDone(true);
              setPhase('SHARING');
            }}
          >
            <Text style={styles.btnTextGhost}>Neutral voice</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'SHARING' && onboardingDone ? (
        <View style={styles.card}>
          <Text style={styles.label}>Sharing</Text>
          <SessionChatThread
            turns={sharingChatTurns}
            emptyHint={
              emotionalState && sharingChatTurns.length === 0
                ? 'Listening for the opening…'
                : undefined
            }
            inverse={onDarkScreen}
          />
          <AnchorMoodSlider
            value={anchorMoodSlider}
            onValueChange={onAnchorMoodChange}
            onSlidingComplete={hapticLight}
            disabled={loading}
            variant={emotionalState ? 'analysis' : 'anchoring'}
          />
          <VoiceSttControl
            disabled={loading || !remoteSessionId}
            label={
              emotionalState
                ? 'Reply in a few words — at most three turns after the welcome.'
                : 'Speak freely about what is on your mind, then stop recording to send.'
            }
            busyLabel="Transcribing…"
            onSttError={(m) => setError(m)}
            onTranscript={(t) => submitSharingVoice(t)}
            transcribeFromUri={remoteSessionId ? transcribeFromUri : undefined}
          />
        </View>
      ) : null}

      {phase === 'ANALYSIS' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Discussion</Text>
          {analysisChatTurns.length > 0 ? (
            <SessionChatThread turns={analysisChatTurns} inverse={onDarkScreen} />
          ) : (
            <Text style={styles.body}>{analysisAgentText || 'Building the focus…'}</Text>
          )}
          <AnchorMoodSlider
            value={anchorMoodSlider}
            onValueChange={onAnchorMoodChange}
            onSlidingComplete={hapticLight}
            disabled={loading}
            variant="analysis"
          />
          {!loading ? (
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={() => playInnervoiceReplay()}
            >
              <Text style={styles.btnTextPrimary}>Listen to InnerVoice replay</Text>
            </Pressable>
          ) : (
            <Text style={styles.hintMuted}>Preparing…</Text>
          )}
        </View>
      ) : null}

      {phase === 'FEEDBACK' ? (
        <View style={styles.card}>
          <Text style={styles.label}>After listening</Text>
          <SessionFeedbackCard
            moodBefore={moodBeforeFeedback}
            moodAfter={fbMoodAfter}
            onMoodAfterChange={setFbMoodAfter}
            messageFit={fbMessageFit}
            onMessageFitChange={setFbMessageFit}
            onSlidingComplete={hapticLight}
            disabled={loading}
          />
          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={submitFeedback}>
            <Text style={styles.btnText}>Submit</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'CLOSING' ? (
        <View style={styles.card}>
          <Text style={styles.closingHeading}>Session summary</Text>
          <Text style={styles.closingSynthesis}>
            {formatClosingRestitution(summary, {
              cognitiveDistortions: sessionContext.cognitiveDistortions,
              sessionNote: sessionContext.sessionNote,
            })}
          </Text>
          {feedbackBeforeStore && feedbackAfterStore ? (
            <Text style={styles.closingMoodNote}>
              {formatMoodMovementLine(anchorMood ?? feedbackBeforeStore.tension, feedbackAfterStore.tension)}
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() => {
              hapticLight();
              resetSession();
            }}
          >
            <Text style={styles.btnText}>New session</Text>
          </Pressable>
        </View>
      ) : null}

      {lastError ? (
        <Text style={[styles.err, onDarkScreen && styles.errOnDark]}>{lastError}</Text>
      ) : null}
      {loading ? <ActivityIndicator color={theme.accentCyan} style={{ marginVertical: 12 }} /> : null}

      {phase === 'INNERVOICE' && loading ? (
        <Text style={[styles.body, onDarkScreen && styles.textMutedOnDark]}>Preparing / playing replay…</Text>
      ) : null}
    </ScrollView>
    <PlaybackCaptionBar caption={caption} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  hero: {
    width: '100%',
    height: 160,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: theme.text, fontSize: 20, fontWeight: '700' },
  textOnDark: { color: theme.textOnInverse },
  phaseOnDark: { color: theme.lightPurple },
  phaseBadge: { color: theme.accentCyan, fontSize: 13, fontWeight: '700' },
  modeLine: { color: theme.textMuted, marginTop: 8, marginBottom: 12 },
  textMutedOnDark: { color: theme.textMutedOnInverse },
  innvHint: { color: theme.textSecondary, marginBottom: 8 },
  card: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  label: { color: theme.textSecondary, marginBottom: 6, fontWeight: '600' },
  body: { color: theme.textSecondary, lineHeight: 22, marginBottom: 8 },
  closingHeading: {
    color: theme.accentCyan,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  closingSynthesis: {
    color: theme.text,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    marginBottom: 12,
  },
  closingMoodNote: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  slider: { width: '100%', height: 44 },
  sliderValue: { color: theme.accentOrange, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  btn: {
    backgroundColor: theme.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
    borderColor: theme.accentCyan,
  },
  btnPrimary: { backgroundColor: theme.accentOrangeDeep },
  btnGhost: {
    backgroundColor: theme.surface,
    borderColor: theme.accentCyan,
  },
  btnText: { color: theme.text, fontWeight: '600' },
  btnTextPrimary: { color: theme.textOnPrimary, fontWeight: '700' },
  btnTextGhost: { color: theme.accentCyan, fontWeight: '600', fontSize: 15 },
  hintMuted: { color: theme.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  err: { color: theme.danger, marginTop: 8 },
  errOnDark: { color: '#F9A8A8' },
  blockTitle: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  crisisTitle: { color: theme.textOnInverse, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  crisisBody: { color: theme.textMutedOnInverse, lineHeight: 22, marginBottom: 16 },
  crisisBtn: { backgroundColor: theme.primaryPurple },
});
