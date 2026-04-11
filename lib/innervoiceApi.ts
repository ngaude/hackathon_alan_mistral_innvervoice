import type { ConversationTurn, SessionSnapshot } from '../types/session';

import { getInnervoiceApiSecret, getInnervoiceApiUrl } from './env';
import { readInnervoiceErrorMessage } from './innervoiceApiErrors';

export type ClientEvent =
  | { type: 'ANCHOR_SUBMIT'; mood: number; transcript: string }
  | { type: 'EXPLORATION_MESSAGE'; text: string; mood0to10?: number }
  | { type: 'ANALYSIS_MESSAGE'; text: string; mood0to10?: number }
  | { type: 'START_INNERVOICE'; consent?: boolean }
  | {
      type: 'FEEDBACK_SUBMIT';
      wRepli?: number;
      wDispersion?: number;
      wTension?: number;
      tension?: number;
      clarity?: number;
      energy?: number;
    };

export interface AudioPart {
  label: string;
  base64: string;
  mimeType: 'audio/mpeg';
  spokenText?: string;
  kind?: 'user' | 'agent' | 'innervoice';
}

export interface UserProfile {
  userId: string;
  displayName: string;
  mistralVoiceId: string | null;
}

export interface SessionListItem {
  id: string;
  title: string | null;
  created_at: number;
}

export interface TimelineSegment {
  seq: number;
  kind: string;
  label: string | null;
  spokenText: string;
  audioPath: string;
  wordTimings: { word: string; startMs: number; endMs: number }[];
}

export interface SessionTimeline {
  sessionId: string;
  title: string;
  summary: string;
  /** Problématique / construction (phase analyse), aligné sur l’audio agent. */
  analysisAgentText: string;
  turns: ConversationTurn[];
  audioSegments: TimelineSegment[];
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = getInnervoiceApiSecret();
  if (secret) {
    h.Authorization = `Bearer ${secret}`;
    h['X-Innervoice-Secret'] = secret;
  }
  return h;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getInnervoiceApiUrl();
  if (!base) throw new Error('EXPO_PUBLIC_INNERVOICE_API_URL non configuré');
  const url = `${base.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    ...init,
    headers: { ...headers(), ...init?.headers },
  });
}

export function getInnervoiceApiBase(): string {
  const base = getInnervoiceApiUrl();
  if (!base) throw new Error('EXPO_PUBLIC_INNERVOICE_API_URL non configuré');
  return base.replace(/\/$/, '');
}

/** URL absolue pour lecture MP3 d’une session (replay historique). */
export function getSessionAudioPlaybackUrl(sessionId: string, seq: number): string {
  return `${getInnervoiceApiBase()}/api/sessions/${encodeURIComponent(sessionId)}/audio/${seq}`;
}

/** En-têtes pour `playMp3FromUrl` si le serveur exige un secret. */
export function innervoiceApiReplayHeaders(): Record<string, string> | undefined {
  const secret = getInnervoiceApiSecret();
  if (!secret) return undefined;
  return { Authorization: `Bearer ${secret}`, 'X-Innervoice-Secret': secret };
}

/** Crée ou met à jour l’utilisateur avec l’id appareil (POST avec `id` + `displayName`). */
export async function syncUserWithServer(userId: string, displayName: string): Promise<UserProfile> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ id: userId, displayName: displayName ?? '' }),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<UserProfile>;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<UserProfile>;
}

export async function updateUserOnServer(
  userId: string,
  patch: { displayName?: string; mistralVoiceId?: string | null; clearMistralVoice?: boolean }
): Promise<UserProfile> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<UserProfile>;
}

export async function cloneVoiceOnServer(
  userId: string,
  sampleBase64: string,
  sampleFilename: string
): Promise<{ mistralVoiceId: string }> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/voice/clone`, {
    method: 'POST',
    body: JSON.stringify({ sampleBase64, sample_filename: sampleFilename }),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<{ mistralVoiceId: string }>;
}

export async function listUserSessions(userId: string): Promise<SessionListItem[]> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/sessions`);
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  const j = (await res.json()) as { sessions?: SessionListItem[] };
  return j.sessions ?? [];
}

export async function getSessionTimeline(sessionId: string): Promise<SessionTimeline> {
  const res = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/timeline`);
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<SessionTimeline>;
}

export async function deleteSessionOnServer(sessionId: string, userId: string): Promise<void> {
  const q = new URLSearchParams({ userId });
  const res = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}?${q}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
}

export async function createRemoteSession(params: {
  userId: string;
  displayName?: string;
  voiceProfileBase64: string | null;
  userMistralVoiceId: string | null;
}): Promise<{ sessionId: string; state: SessionSnapshot }> {
  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      userId: params.userId,
      displayName: params.displayName ?? '',
      voiceProfileBase64: params.voiceProfileBase64,
      userMistralVoiceId: params.userMistralVoiceId,
    }),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<{ sessionId: string; state: SessionSnapshot }>;
}

export async function transcribeOnServer(
  sessionId: string,
  audioBase64: string,
  filename = 'recording.wav'
): Promise<string> {
  const res = await apiFetch(`/api/sessions/${sessionId}/transcribe`, {
    method: 'POST',
    body: JSON.stringify({ audioBase64, filename }),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  const j = (await res.json()) as { text?: string };
  return typeof j.text === 'string' ? j.text : '';
}

export async function postSessionEvent(
  sessionId: string,
  event: ClientEvent
): Promise<{ state: SessionSnapshot; audio: AudioPart[]; crisisMessage?: string }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/event`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(await readInnervoiceErrorMessage(res));
  return res.json() as Promise<{ state: SessionSnapshot; audio: AudioPart[]; crisisMessage?: string }>;
}
