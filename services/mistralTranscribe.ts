import * as FileSystem from 'expo-file-system/legacy';

import { getMistralApiKey, getMistralSttModel } from '../lib/env';
import { mistralApiError, mistralTrace } from '../lib/mistralDebug';
import { formatMistralErrorResponse } from './mistralErrors';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

/** Déduit nom + Content-Type pour Mistral (WAV / MP3 attendus). */
function filePartForUri(uri: string): { name: string; type: string } {
  const seg = uri.split('/').pop() ?? 'audio.wav';
  const lower = seg.toLowerCase();
  if (lower.endsWith('.wav')) return { name: seg.endsWith('.wav') ? seg : `${seg}.wav`, type: 'audio/wav' };
  if (lower.endsWith('.mp3')) return { name: seg, type: 'audio/mpeg' };
  if (lower.endsWith('.aac')) return { name: seg, type: 'audio/aac' };
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return { name: seg, type: 'audio/mp4' };
  return { name: 'recording.wav', type: 'audio/wav' };
}

/**
 * Transcription Voxtral (STT) — multipart.
 * L’API exige un fichier **MP3 ou WAV** valide (sinon 400).
 */
export async function transcribeAudioFromUri(fileUri: string, language = 'fr'): Promise<TranscriptionResult> {
  const key = getMistralApiKey();
  if (!key) throw new Error('MISTRAL_API_KEY manquante');

  const model = getMistralSttModel();
  const form = new FormData();
  form.append('model', model);
  form.append('language', language);
  form.append('stream', 'false');

  const { name, type } = filePartForUri(fileUri);
  form.append('file', {
    uri: fileUri,
    name,
    type,
  } as unknown as Blob);

  let fileInfo: Record<string, unknown> = { uri: fileUri };
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    fileInfo = {
      uri: fileUri,
      exists: info.exists,
      size: 'size' in info ? info.size : undefined,
      isDirectory: 'isDirectory' in info ? info.isDirectory : undefined,
    };
  } catch (e) {
    fileInfo.getInfoAsyncError = e instanceof Error ? e.message : String(e);
  }

  mistralTrace('STT request', {
    endpoint: '/v1/audio/transcriptions',
    model,
    language,
    multipartFilename: name,
    multipartType: type,
    file: fileInfo,
    hint: 'Mistral STT accepte surtout WAV/MP3 ; 400 "failed to load audio" = format/extension invalide ou fichier vide.',
  });

  const res = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    body: form,
  });

  const raw = await res.text();
  if (!res.ok) {
    mistralApiError('STT failed', {
      status: res.status,
      model,
      multipartFilename: name,
      multipartType: type,
      file: fileInfo,
      responseBodyPreview: raw.length > 2500 ? `${raw.slice(0, 2500)}…` : raw,
    });
    throw new Error(formatMistralErrorResponse(res.status, raw));
  }

  mistralTrace('STT ok', {
    model,
    responseChars: raw.length,
    textPreview: (() => {
      try {
        const j = JSON.parse(raw) as { text?: string };
        const t = typeof j.text === 'string' ? j.text : '';
        return t.length > 120 ? `${t.slice(0, 120)}…` : t;
      } catch {
        return '(parse error)';
      }
    })(),
  });

  const json = JSON.parse(raw) as { text?: string; language?: string | null };
  const text = typeof json.text === 'string' ? json.text.trim() : '';
  return { text, language: json.language };
}
