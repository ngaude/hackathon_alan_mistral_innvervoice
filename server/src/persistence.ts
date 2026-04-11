import fs from 'node:fs';
import path from 'node:path';

import { getAudioDir, getDb } from './db.js';
import { estimateDurationMsFromMp3Base64, estimateWordTimings } from './wordTimings.js';
import { logInfo } from './log.js';
import type { AudioPart } from './sessionEngine.js';
import type { SessionSnapshot } from './sessionTypes.js';

export function upsertUser(id: string, displayName: string): void {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (row) {
    db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(displayName, now, id);
  } else {
    db.prepare('INSERT INTO users (id, display_name, mistral_voice_id, created_at, updated_at) VALUES (?,?,?,?,?)').run(
      id,
      displayName,
      null,
      now,
      now
    );
  }
}

export function setUserMistralVoice(userId: string, voiceId: string | null): void {
  const db = getDb();
  const now = Date.now();
  db.prepare('UPDATE users SET mistral_voice_id = ?, updated_at = ? WHERE id = ?').run(voiceId, now, userId);
}

export function getUser(userId: string): {
  id: string;
  display_name: string;
  mistral_voice_id: string | null;
} | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, display_name, mistral_voice_id FROM users WHERE id = ?')
    .get(userId) as { id: string; display_name: string; mistral_voice_id: string | null } | undefined;
  return row ?? null;
}

export function createSessionRow(sessionId: string, userId: string, snapshot: SessionSnapshot): void {
  const db = getDb();
  const now = Date.now();
  const title = deriveTitle(snapshot);
  db.prepare(
    `INSERT INTO sessions (id, user_id, title, summary, snapshot_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(sessionId, userId, title, '', JSON.stringify(snapshot), now, now);
  logInfo('persist session créée', { sessionId, userId });
}

export function updateSessionSnapshot(sessionId: string, snapshot: SessionSnapshot): void {
  const db = getDb();
  const now = Date.now();
  const title = deriveTitle(snapshot);
  const summary = snapshot.sessionContext.summary?.slice(0, 500) ?? '';
  db.prepare('UPDATE sessions SET title = ?, summary = ?, snapshot_json = ?, updated_at = ? WHERE id = ?').run(
    title,
    summary,
    JSON.stringify(snapshot),
    now,
    sessionId
  );
}

function deriveTitle(s: SessionSnapshot): string {
  const firstUser = s.turns.find((t) => t.role === 'user');
  const t = firstUser?.text?.trim() ?? '';
  if (t.length > 0) return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  return `Session ${new Date().toLocaleDateString('en-US')}`;
}

export function getNextAudioSeq(sessionId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(MAX(seq), -1) AS m FROM session_audio WHERE session_id = ?').get(sessionId) as
    | { m: number }
    | undefined;
  return (row?.m ?? -1) + 1;
}

export function appendAudioParts(sessionId: string, parts: AudioPart[], startSeq: number): number {
  const db = getDb();
  const dir = path.join(getAudioDir(), sessionId);
  fs.mkdirSync(dir, { recursive: true });
  let seq = startSeq;
  const ins = db.prepare(
    `INSERT INTO session_audio (session_id, seq, kind, label, spoken_text, file_path, word_timings_json)
     VALUES (?,?,?,?,?,?,?)`
  );

  for (const p of parts) {
    const buf = Buffer.from(p.base64, 'base64');
    const fname = `${seq}.mp3`;
    const fpath = path.join(dir, fname);
    fs.writeFileSync(fpath, buf);
    const text = p.spokenText ?? '';
    const dur = estimateDurationMsFromMp3Base64(p.base64, text);
    const timings = estimateWordTimings(text, dur);
    const kind = inferKind(p);
    ins.run(sessionId, seq, kind, p.label ?? '', text, fpath, JSON.stringify(timings));
    seq += 1;
  }
  logInfo('persist audio', { sessionId, parts: parts.length, seqEnd: seq - 1 });
  return seq;
}

function inferKind(part: AudioPart): string {
  if (part.kind) return part.kind;
  const label = part.label;
  if (label.includes('InnerVoice') || label === 'Validation' || label === 'Recadrage' || label === 'Intention')
    return 'innervoice';
  if (label.includes('Agent') || label === 'Clôture' || label === 'Transition') return 'agent';
  return 'agent';
}

export function listSessionsForUser(userId: string): { id: string; title: string | null; created_at: number }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, title, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    )
    .all(userId) as { id: string; title: string | null; created_at: number }[];
}

interface TimelineSegment {
  seq: number;
  kind: string;
  label: string | null;
  spokenText: string;
  /** Chemin relatif à concaténer à l’URL du serveur (ex. `http://host:8787`). */
  audioPath: string;
  wordTimings: { word: string; startMs: number; endMs: number }[];
}

export function getTimeline(sessionId: string): TimelineSegment[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT seq, kind, label, spoken_text, word_timings_json FROM session_audio WHERE session_id = ? ORDER BY seq ASC`
    )
    .all(sessionId) as {
    seq: number;
    kind: string;
    label: string | null;
    spoken_text: string | null;
    word_timings_json: string | null;
  }[];

  return rows.map((r) => ({
    seq: r.seq,
    kind: r.kind,
    label: r.label,
    spokenText: r.spoken_text ?? '',
    audioPath: `/api/sessions/${sessionId}/audio/${r.seq}`,
    wordTimings: r.word_timings_json ? (JSON.parse(r.word_timings_json) as TimelineSegment['wordTimings']) : [],
  }));
}

function getSessionSnapshotJson(sessionId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT snapshot_json FROM sessions WHERE id = ?').get(sessionId) as
    | { snapshot_json: string }
    | undefined;
  return row?.snapshot_json ?? null;
}

export function getSessionUserId(sessionId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function loadSessionSnapshot(sessionId: string): SessionSnapshot | null {
  const j = getSessionSnapshotJson(sessionId);
  if (!j) return null;
  try {
    return JSON.parse(j) as SessionSnapshot;
  } catch {
    return null;
  }
}

/** Supprime la session, les pistes audio SQLite et les fichiers sur disque. */
export function deleteSessionData(sessionId: string): void {
  const db = getDb();
  const dir = path.join(getAudioDir(), sessionId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  db.prepare('DELETE FROM session_audio WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  logInfo('session supprimée', { sessionId });
}
