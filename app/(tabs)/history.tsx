import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PlaybackCaptionBar } from '../../components/PlaybackCaptionBar';
import { AGENT_VOICE_VOLUME } from '../../constants/audioPlayback';
import { theme } from '../../constants/theme';
import { getInnervoiceApiUrl } from '../../lib/env';
import {
  deleteSessionOnServer,
  getSessionAudioPlaybackUrl,
  getSessionTimeline,
  innervoiceApiReplayHeaders,
  listUserSessions,
  type SessionListItem,
  type SessionTimeline,
  type TimelineSegment,
} from '../../lib/innervoiceApi';
import { hapticLight } from '../../lib/haptics';
import { getOrCreateUserId } from '../../lib/userIdentity';
import { playMp3FromUrl } from '../../services/audioPlayer';
import type { ConversationTurn } from '../../types/session';

const COVER = require('../../assets/innervoice-logo.png');

function segmentBadge(seg: TimelineSegment): string {
  const k = seg.kind || '';
  const lab = seg.label?.toLowerCase() ?? '';
  if (lab.includes('nudge') || lab.includes('inner')) return 'InnerVoice';
  if (lab.includes('analyse') || lab.includes('analysis')) return 'Focus';
  if (k === 'user' || k.includes('user')) return 'You';
  if (k === 'innervoice' || k.includes('inner')) return 'InnerVoice';
  if (k === 'agent' || k.includes('agent')) return 'Agent';
  return seg.label?.trim() || 'Audio';
}

function formatSessionDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function findAnalysisAudioIndex(segments: TimelineSegment[]): number {
  const byLabel = segments.findIndex(
    (s) => s.label && (/analysis/i.test(s.label) || /analyse/i.test(s.label) || /agent.*analysis/i.test(s.label))
  );
  if (byLabel >= 0) return byLabel;
  let firstAgentAfterNudge = -1;
  let seenInnervoice = false;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.kind === 'innervoice' || s.label?.includes('InnerVoice')) seenInnervoice = true;
    else if (seenInnervoice && s.kind === 'agent') {
      firstAgentAfterNudge = i;
      break;
    }
  }
  return firstAgentAfterNudge;
}

function firstAnchorUserTurn(turns: ConversationTurn[]): string | null {
  const u = turns.find((t) => {
    if (t.role !== 'user') return false;
    const p = t.phase as string;
    return p === 'SHARING' || p === 'ANCHORING' || p === 'EXPLORATION';
  });
  return u?.text?.trim() || null;
}

export default function HistoryScreen() {
  const apiUrl = getInnervoiceApiUrl();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Record<string, SessionTimeline | null>>({});
  const [timelineErrors, setTimelineErrors] = useState<Record<string, string | null>>({});
  const [timelineLoadingId, setTimelineLoadingId] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(-1);
  const [playSessionId, setPlaySessionId] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const uid = await getOrCreateUserId();
        if (cancelled) return;
        setUserId(uid);
        const rows = await listUserSessions(uid);
        if (!cancelled) setSessions(rows);
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : 'Could not load history');
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const loadTimeline = useCallback(async (id: string) => {
    setTimelineLoadingId(id);
    setTimelineErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const t = await getSessionTimeline(id);
      setTimelines((prev) => ({ ...prev, [id]: t }));
    } catch (e) {
      setTimelineErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Could not load',
      }));
    } finally {
      setTimelineLoadingId(null);
    }
  }, []);

  const toggleSessionRow = useCallback(
    async (id: string) => {
      hapticLight();
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(id);
      if (!timelines[id]) {
        await loadTimeline(id);
      }
    },
    [expandedId, timelines, loadTimeline]
  );

  const playFromIndex = useCallback(
    async (sessionId: string, timeline: SessionTimeline, startIdx: number) => {
      if (playing) return;
      const segs = timeline.audioSegments;
      if (!segs.length) return;
      const headers = innervoiceApiReplayHeaders();
      setPlaying(true);
      setPlaySessionId(sessionId);
      try {
        for (let i = Math.max(0, startIdx); i < segs.length; i++) {
          const seg = segs[i]!;
          setPlayIndex(i);
          setCaption(seg.spokenText?.trim() || seg.label || null);
          const url = getSessionAudioPlaybackUrl(timeline.sessionId, seg.seq);
          const vol = seg.kind === 'agent' ? AGENT_VOICE_VOLUME : 1;
          await playMp3FromUrl(url, headers, { volume: vol });
        }
      } catch (e) {
        setTimelineErrors((prev) => ({
          ...prev,
          [sessionId]: e instanceof Error ? e.message : 'Playback interrupted',
        }));
      } finally {
        setPlayIndex(-1);
        setCaption(null);
        setPlaying(false);
        setPlaySessionId(null);
      }
    },
    [playing]
  );

  const confirmDelete = useCallback(
    (sessionId: string) => {
      if (!userId) return;
      Alert.alert(
        'Delete this session?',
        'Audio stored on the server will be removed. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              hapticLight();
              try {
                await deleteSessionOnServer(sessionId, userId);
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                setTimelines((prev) => {
                  const n = { ...prev };
                  delete n[sessionId];
                  return n;
                });
                if (expandedId === sessionId) setExpandedId(null);
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete');
              }
            },
          },
        ]
      );
    },
    [userId, expandedId]
  );

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Image source={COVER} style={styles.hero} resizeMode="contain" />
        <Text style={styles.title}>History</Text>
        {!apiUrl ? (
          <Text style={styles.err}>
            No server URL: history cannot load. Set `EXPO_PUBLIC_INNERVOICE_API_URL` or restart Metro for automatic LAN
            IP.
          </Text>
        ) : null}
        <Text style={styles.sub}>
          Sessions stored for this account on this device
          {userId ? ` (${userId.slice(0, 8)}…)` : ''}.
        </Text>

        {listLoading ? <ActivityIndicator color={theme.accentCyan} style={{ marginVertical: 12 }} /> : null}
        {listError ? <Text style={styles.err}>{listError}</Text> : null}

        {!listLoading && !sessions.length && !listError ? (
          <Text style={styles.body}>No sessions yet.</Text>
        ) : null}

        {sessions.map((item) => {
          const isOpen = expandedId === item.id;
          const tl = timelines[item.id];
          const tlErr = timelineErrors[item.id];
          const loadingThis = timelineLoadingId === item.id;
          const probIdx = tl ? findAnalysisAudioIndex(tl.audioSegments) : -1;
          const anchorText = tl ? firstAnchorUserTurn(tl.turns) : null;
          const analysisText = tl?.analysisAgentText?.trim() || '';

          return (
            <View key={item.id} style={styles.sessionBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  isOpen && styles.rowActive,
                ]}
                onPress={() => toggleSessionRow(item.id)}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title?.trim() || 'Session'}
                  </Text>
                  <Text style={styles.chevron}>{isOpen ? '▼' : '▶'}</Text>
                </View>
                <Text style={styles.rowMeta}>{formatSessionDate(item.created_at)}</Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.inlineDetail}>
                  {loadingThis ? (
                    <ActivityIndicator color={theme.accentCyan} style={{ marginVertical: 12 }} />
                  ) : tlErr ? (
                    <Text style={styles.err}>{tlErr}</Text>
                  ) : tl ? (
                    <>
                      <Text style={styles.detailTitle}>Summary</Text>
                      <Text style={styles.body}>{tl.summary?.trim() || 'No summary stored.'}</Text>

                      <Pressable
                        style={({ pressed }) => [styles.playAll, pressed && styles.rowPressed]}
                        onPress={() => playFromIndex(item.id, tl, 0)}
                        disabled={
                          playing || !tl.audioSegments.length || playSessionId === item.id
                        }
                      >
                        <Text style={styles.playAllText}>
                          {playing && playSessionId === item.id ? 'Playing…' : 'Play all in order'}
                        </Text>
                      </Pressable>

                      <Text style={styles.sectionTitle}>Focus & framing</Text>

                      {anchorText ? (
                        <View style={styles.turnBlock}>
                          <Text style={styles.turnBadge}>You · anchoring</Text>
                          <Text style={styles.turnText}>{anchorText}</Text>
                          <Text style={styles.turnNote}>
                            (Your original voice is not replayed here — only the transcript is kept.)
                          </Text>
                        </View>
                      ) : null}

                      {analysisText ? (
                        <View style={styles.turnBlock}>
                          <Text style={styles.turnBadge}>Focus · agent</Text>
                          <Text style={styles.turnText}>{analysisText}</Text>
                          {probIdx >= 0 ? (
                            <Pressable
                              style={({ pressed }) => [styles.listenProb, pressed && styles.rowPressed]}
                              onPress={() => playFromIndex(item.id, tl, probIdx)}
                              disabled={playing}
                            >
                              <Text style={styles.listenProbText}>Play focus segment</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}

                      <Text style={styles.sectionTitle}>Audio sequence</Text>
                      {tl.audioSegments.map((seg, idx) => (
                        <Pressable
                          key={`${seg.seq}-${idx}`}
                          style={({ pressed }) => [
                            styles.seqRow,
                            playSessionId === item.id && playIndex === idx && styles.seqRowPlaying,
                            pressed && styles.rowPressed,
                          ]}
                          onPress={() => playFromIndex(item.id, tl, idx)}
                          disabled={playing}
                        >
                          <Text style={styles.seqBadge}>{segmentBadge(seg)}</Text>
                          <Text style={styles.seqText} numberOfLines={4}>
                            {seg.spokenText?.trim() || seg.label || `Track ${seg.seq}`}
                          </Text>
                        </Pressable>
                      ))}

                      <Pressable
                        style={({ pressed }) => [styles.deleteBtn, pressed && styles.rowPressed]}
                        onPress={() => confirmDelete(item.id)}
                      >
                        <Text style={styles.deleteBtnText}>Delete this session</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <PlaybackCaptionBar caption={caption} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  wrap: { flex: 1, padding: 16, backgroundColor: theme.bg },
  hero: {
    width: '100%',
    height: 120,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sub: { color: theme.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  body: { color: theme.textSecondary, lineHeight: 22, marginBottom: 12 },
  err: { color: theme.danger, marginBottom: 12, lineHeight: 20 },
  sessionBlock: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceElevated,
  },
  row: {
    padding: 14,
  },
  rowPressed: { opacity: 0.92 },
  rowActive: { borderColor: theme.accentCyan },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  rowTitle: { color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4, flex: 1 },
  chevron: { color: theme.accentCyan, fontSize: 14, fontWeight: '700', marginTop: 2 },
  rowMeta: { color: theme.textMuted, fontSize: 13 },
  inlineDetail: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  detailTitle: { color: theme.accentCyan, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  sectionTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  playAll: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.accentOrangeDeep,
    alignItems: 'center',
  },
  playAllText: { color: theme.textOnPrimary, fontWeight: '700', fontSize: 15 },
  turnBlock: { marginBottom: 12 },
  turnBadge: { color: theme.accentCyan, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  turnText: { color: theme.textSecondary, fontSize: 15, lineHeight: 22 },
  turnNote: { color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6, fontStyle: 'italic' },
  listenProb: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.accentCyan,
  },
  listenProbText: { color: theme.accentCyan, fontWeight: '700', fontSize: 14 },
  seqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  seqRowPlaying: { backgroundColor: theme.surfaceElevated },
  seqBadge: {
    color: theme.accentOrange,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 96,
  },
  seqText: { flex: 1, color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
  deleteBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.danger,
    alignItems: 'center',
  },
  deleteBtnText: { color: theme.danger, fontWeight: '700', fontSize: 15 },
});
