import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';

import { getServerPort, getServerSecret, isPerfLogEnabled } from './env.js';
import { applyEvent, createInitialSession, type ClientEvent } from './sessionEngine.js';
import type { SessionSnapshot } from './sessionTypes.js';
import { convertCompressedBase64ToWavBase64, hasFfmpeg } from './convertRefAudioFfmpeg.js';
import { normalizeRefAudioBase64 } from './refAudio.js';
import { transcribeAudioBase64 } from './mistralTranscribe.js';
import { b64Len, logError, logInfo, logWarn } from './log.js';
import { getDb } from './db.js';
import {
  appendAudioParts,
  createSessionRow,
  deleteSessionData,
  getNextAudioSeq,
  getSessionUserId,
  getTimeline,
  getUser,
  listSessionsForUser,
  loadSessionSnapshot,
  setUserMistralVoice,
  updateSessionSnapshot,
  upsertUser,
} from './persistence.js';
import { createMistralClonedVoice } from './mistralVoices.js';

const sessions = new Map<string, SessionSnapshot>();
/** sessionId → userId (persisté en base). */
const sessionOwner = new Map<string, string>();

getDb();

function ensureSession(sid: string): SessionSnapshot | null {
  let s = sessions.get(sid);
  if (s) return s;
  const loaded = loadSessionSnapshot(sid);
  if (!loaded) return null;
  sessions.set(sid, loaded);
  const uid = getSessionUserId(sid);
  if (uid) sessionOwner.set(sid, uid);
  return loaded;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logInfo('HTTP', { method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  next();
});

app.get('/health', (_req, res) => {
  const ffmpeg = hasFfmpeg();
  logInfo('health', { ffmpeg, sessions: sessions.size });
  res.json({ ok: true, ffmpeg });
});

app.use((req, res, next) => {
  const secret = getServerSecret();
  if (!secret) {
    next();
    return;
  }
  const auth = req.headers.authorization;
  const x = req.headers['x-innervoice-secret'];
  if (auth === `Bearer ${secret}` || x === secret) {
    next();
    return;
  }
  logWarn('auth refused', { path: req.path, hasAuthHeader: Boolean(auth), hasXSecret: Boolean(x) });
  res.status(401).json({ error: 'Unauthorized' });
});

app.post('/api/users', (req, res) => {
  const clientId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  const id = clientId || randomUUID();
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  upsertUser(id, displayName);
  const row = getUser(id);
  logInfo('POST /api/users', { userId: id, displayNameLen: displayName.length, fromClient: Boolean(clientId) });
  res.json({
    userId: row!.id,
    displayName: row!.display_name,
    mistralVoiceId: row!.mistral_voice_id,
  });
});

app.get('/api/users/:userId', (req, res) => {
  const row = getUser(req.params.userId);
  if (!row) {
    res.status(404).json({ error: 'Utilisateur inconnu' });
    return;
  }
  logInfo('GET /api/users/:id', { userId: row.id, hasVoice: Boolean(row.mistral_voice_id) });
  res.json({
    userId: row.id,
    displayName: row.display_name,
    mistralVoiceId: row.mistral_voice_id,
  });
});

app.patch('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  const u = getUser(userId);
  if (!u) {
    res.status(404).json({ error: 'Utilisateur inconnu' });
    return;
  }
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : u.display_name;
  upsertUser(userId, displayName);
  if (req.body?.clearMistralVoice === true) {
    setUserMistralVoice(userId, null);
  }
  if (typeof req.body?.mistralVoiceId === 'string') {
    setUserMistralVoice(userId, req.body.mistralVoiceId.trim() || null);
  }
  const after = getUser(userId);
  logInfo('PATCH /api/users/:id', { userId, hasVoice: Boolean(after?.mistral_voice_id) });
  res.json({
    userId: after!.id,
    displayName: after!.display_name,
    mistralVoiceId: after!.mistral_voice_id,
  });
});

/** Création voix clonée côté serveur (Mistral) + enregistrement sur le profil utilisateur. */
app.post('/api/users/:userId/voice/clone', async (req, res) => {
  const userId = req.params.userId;
  if (!getUser(userId)) {
    upsertUser(userId, '');
  }
  const sample = req.body?.sampleBase64 ?? req.body?.sample_audio;
  const filename = typeof req.body?.sample_filename === 'string' ? req.body.sample_filename : 'voice.wav';
  if (typeof sample !== 'string') {
    res.status(400).json({ error: 'sampleBase64 requis' });
    return;
  }
  logInfo('voice clone start', { userId, filename, sampleChars: sample.length });
  try {
    const voiceId = await createMistralClonedVoice(sample, filename);
    setUserMistralVoice(userId, voiceId);
    logInfo('voice clone ok', { userId, voiceIdLen: voiceId.length });
    res.json({ mistralVoiceId: voiceId });
  } catch (e) {
    logError('voice clone', e);
    const msg = e instanceof Error ? e.message : 'Échec clonage';
    const status = msg.includes('403') || msg.includes('paid') ? 403 : 400;
    res.status(status).json({ error: msg, code: status === 403 ? 'VOICE_PLAN' : 'VOICE_ERROR' });
  }
});

app.get('/api/users/:userId/sessions', (req, res) => {
  const rows = listSessionsForUser(req.params.userId);
  logInfo('GET user sessions', { userId: req.params.userId, count: rows.length });
  res.json({ sessions: rows });
});

app.get('/api/sessions/:id/timeline', (req, res) => {
  const sid = req.params.id;
  const snap = loadSessionSnapshot(sid);
  if (!snap) {
    res.status(404).json({ error: 'Session inconnue' });
    return;
  }
  const audioSegments = getTimeline(sid);
  logInfo('GET timeline', { sessionId: sid, audioSegments: audioSegments.length });
  res.json({
    sessionId: sid,
    title: snap.sessionContext.summary?.slice(0, 80) ?? 'Session',
    summary: snap.sessionContext.summary ?? '',
    analysisAgentText: snap.analysisAgentText ?? '',
    turns: snap.turns,
    audioSegments,
  });
});

app.delete('/api/sessions/:id', (req, res) => {
  const sid = req.params.id;
  const userId =
    (typeof req.query.userId === 'string' ? req.query.userId.trim() : '') ||
    (typeof req.body?.userId === 'string' ? req.body.userId.trim() : '');
  if (!userId) {
    res.status(400).json({ error: 'userId requis (query userId)' });
    return;
  }
  const owner = getSessionUserId(sid);
  if (!owner || owner !== userId) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  deleteSessionData(sid);
  sessions.delete(sid);
  sessionOwner.delete(sid);
  logInfo('DELETE session', { sessionId: sid, userId });
  res.status(204).end();
});

app.get('/api/sessions/:id/audio/:seq', (req, res) => {
  const sid = req.params.id;
  const seq = Number(req.params.seq);
  const db = getDb();
  const row = db
    .prepare('SELECT file_path FROM session_audio WHERE session_id = ? AND seq = ?')
    .get(sid, seq) as { file_path: string } | undefined;
  if (!row?.file_path || !fs.existsSync(row.file_path)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(path.resolve(row.file_path));
});

app.post('/api/convert-ref-audio', async (req, res) => {
  const audioBase64 = req.body?.audioBase64;
  logInfo('convert-ref-audio', { inB64Chars: b64Len(audioBase64) });
  if (typeof audioBase64 !== 'string') {
    res.status(400).json({ error: 'audioBase64 requis' });
    return;
  }
  if (!hasFfmpeg()) {
    logWarn('convert-ref-audio: ffmpeg absent');
    res.status(503).json({
      error:
        'ffmpeg introuvable sur le serveur. Installez ffmpeg (brew install ffmpeg) et relancez le serveur.',
    });
    return;
  }
  try {
    const wavBase64 = await convertCompressedBase64ToWavBase64(audioBase64);
    const out = normalizeRefAudioBase64(wavBase64);
    logInfo('convert-ref-audio ok', { outB64Chars: b64Len(out) });
    res.json({ wavBase64: out });
  } catch (e) {
    logError('convert-ref-audio', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Conversion échouée' });
  }
});

app.post('/api/sessions', (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  if (!userId) {
    res.status(400).json({ error: 'userId requis' });
    return;
  }
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  upsertUser(userId, displayName || getUser(userId)?.display_name || '');

  const voiceProfileBase64 =
    typeof req.body?.voiceProfileBase64 === 'string' ? req.body.voiceProfileBase64 : null;
  let userMistralVoiceId =
    typeof req.body?.userMistralVoiceId === 'string' ? req.body.userMistralVoiceId : null;
  const prof = getUser(userId);
  if (!userMistralVoiceId && prof?.mistral_voice_id) {
    userMistralVoiceId = prof.mistral_voice_id;
  }

  const id = randomUUID();
  const state = createInitialSession(voiceProfileBase64, userMistralVoiceId);
  sessions.set(id, state);
  sessionOwner.set(id, userId);
  createSessionRow(id, userId, state);
  logInfo('session créée', {
    sessionId: id,
    userId,
    voiceProfileB64Chars: b64Len(voiceProfileBase64 ?? undefined),
    hasMistralVoiceId: Boolean(userMistralVoiceId),
  });
  res.json({ sessionId: id, state });
});

app.patch('/api/sessions/:id/voice', (req, res) => {
  const sid = req.params.id;
  const s = ensureSession(sid);
  if (!s) {
    logWarn('PATCH voice: session inconnue', { sessionId: sid });
    res.status(404).json({ error: 'Session inconnue' });
    return;
  }
  if (typeof req.body?.voiceProfileBase64 === 'string') {
    s.voiceProfileBase64 = req.body.voiceProfileBase64;
  }
  if (typeof req.body?.userMistralVoiceId === 'string') {
    s.userMistralVoiceId = req.body.userMistralVoiceId;
  }
  sessions.set(sid, s);
  updateSessionSnapshot(sid, s);
  logInfo('PATCH voice', {
    sessionId: sid,
    voiceProfileB64Chars: b64Len(s.voiceProfileBase64 ?? undefined),
    hasMistralVoiceId: Boolean(s.userMistralVoiceId),
  });
  res.json({ state: s });
});

app.post('/api/sessions/:id/transcribe', async (req, res) => {
  const sid = req.params.id;
  if (!ensureSession(sid)) {
    logWarn('transcribe: session inconnue', { sessionId: sid });
    res.status(404).json({ error: 'Session inconnue' });
    return;
  }
  const audioBase64 = req.body?.audioBase64;
  if (typeof audioBase64 !== 'string') {
    res.status(400).json({ error: 'audioBase64 requis' });
    return;
  }
  const filename = typeof req.body?.filename === 'string' ? req.body.filename : 'recording.wav';
  logInfo('transcribe', { sessionId: sid, filename, inB64Chars: b64Len(audioBase64) });
  try {
    const t0 = performance.now();
    const { text } = await transcribeAudioBase64(audioBase64, filename);
    if (isPerfLogEnabled()) {
      logInfo('perf', {
        event: 'POST /transcribe',
        step: 'mistral_stt',
        ms: Math.round(performance.now() - t0),
        textChars: text.length,
      });
    }
    logInfo('transcribe ok', { sessionId: sid, textChars: text.length });
    res.json({ text });
  } catch (e) {
    logError('transcribe', e);
    const msg = e instanceof Error ? e.message : 'STT échoué';
    const overload = /503|502|504|overflow|upstream connect|disconnect\/reset/i.test(msg);
    const code = overload ? 503 : 500;
    const friendly = overload
      ? 'Transcription temporairement indisponible (service surchargé). Réessayez dans un instant.'
      : msg;
    res.status(code).json({ error: friendly });
  }
});

function persistAfterEvent(sessionId: string, state: SessionSnapshot, audio: import('./sessionEngine.js').AudioPart[]) {
  const uid = sessionOwner.get(sessionId);
  if (!uid) return;
  updateSessionSnapshot(sessionId, state);
  if (audio.length > 0) {
    const start = getNextAudioSeq(sessionId);
    appendAudioParts(sessionId, audio, start);
  }
}

app.post('/api/sessions/:id/event', async (req, res) => {
  const id = req.params.id;
  const s = ensureSession(id);
  if (!s) {
    logWarn('event: session inconnue', { sessionId: id });
    res.status(404).json({ error: 'Session inconnue' });
    return;
  }
  const event = req.body as ClientEvent;
  if (!event?.type) {
    res.status(400).json({ error: 'event.type requis' });
    return;
  }
  logInfo('event', {
    sessionId: id,
    type: event.type,
    phaseBefore: s.phase,
    payload:
      event.type === 'ANCHOR_SUBMIT'
        ? { mood: event.mood, transcriptChars: event.transcript?.length ?? 0 }
        : event.type === 'EXPLORATION_MESSAGE'
          ? { textChars: event.text?.length ?? 0, mood: event.mood0to10 }
          : event.type === 'ANALYSIS_MESSAGE'
          ? { textChars: event.text?.length ?? 0, mood: event.mood0to10 }
          : event.type === 'START_INNERVOICE'
            ? { consent: event.consent }
            : event.type === 'FEEDBACK_SUBMIT'
              ? {
                  clarity: event.clarity,
                  energy: event.energy,
                  tension: event.tension,
                  triangle:
                    typeof event.wRepli === 'number'
                      ? { wRepli: event.wRepli, wDispersion: event.wDispersion, wTension: event.wTension }
                      : undefined,
                }
              : {},
  });
  try {
    const tEvent = performance.now();
    const result = await applyEvent(s, event);
    if (isPerfLogEnabled()) {
      logInfo('perf', {
        event: 'POST /event',
        type: event.type,
        step: 'applyEvent_total',
        ms: Math.round(performance.now() - tEvent),
        audioParts: result.audio.length,
      });
    }
    sessions.set(id, result.state);
    persistAfterEvent(id, result.state, result.audio);
    logInfo('event ok', {
      sessionId: id,
      phaseAfter: result.state.phase,
      audioParts: result.audio.length,
      crisis: Boolean(result.crisisMessage),
    });
    res.json({
      state: result.state,
      audio: result.audio,
      crisisMessage: result.crisisMessage,
    });
  } catch (e) {
    logError('event', e);
    const msg = e instanceof Error ? e.message : 'Erreur';
    const overload = /503|502|504|overflow|upstream connect|disconnect\/reset/i.test(msg);
    if (overload) {
      res.status(503).json({
        error:
          'Génération temporairement indisponible (service surchargé). Réessayez dans un instant.',
      });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  const sid = req.params.id;
  const s = ensureSession(sid);
  if (!s) {
    logWarn('GET session: inconnue', { sessionId: sid });
    res.status(404).json({ error: 'Session inconnue' });
    return;
  }
  logInfo('GET session', { sessionId: sid, phase: s.phase, turns: s.turns.length });
  res.json({ state: s });
});

const port = getServerPort();
app.listen(port, () => {
  logInfo(`écoute http://localhost:${port}`, {
    auth: Boolean(getServerSecret()),
    ffmpeg: hasFfmpeg(),
  });
});
