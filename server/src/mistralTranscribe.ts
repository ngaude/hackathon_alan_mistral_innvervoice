import { getMistralApiKey, getMistralSttModel } from './env.js';
import { formatMistralErrorResponse } from './mistralErrors.js';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

function guessNameType(filename: string): { name: string; type: string } {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.wav')) return { name: filename, type: 'audio/wav' };
  if (lower.endsWith('.mp3')) return { name: filename, type: 'audio/mpeg' };
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return { name: filename, type: 'audio/mp4' };
  return { name: 'recording.wav', type: 'audio/wav' };
}

/**
 * STT Mistral — multipart depuis base64 (Node 18+).
 */
export async function transcribeAudioBase64(
  audioBase64: string,
  filename = 'recording.wav',
  language = 'fr'
): Promise<TranscriptionResult> {
  const key = getMistralApiKey();
  if (!key) throw new Error('MISTRAL_API_KEY manquante');

  const model = getMistralSttModel();
  const buf = Buffer.from(audioBase64.replace(/\s/g, ''), 'base64');
  const { name, type } = guessNameType(filename);
  const blob = new Blob([buf], { type });

  const form = new FormData();
  form.append('model', model);
  form.append('language', language);
  form.append('stream', 'false');
  form.append('file', blob, name);

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
    throw new Error(formatMistralErrorResponse(res.status, raw));
  }

  const json = JSON.parse(raw) as { text?: string; language?: string | null };
  const text = typeof json.text === 'string' ? json.text.trim() : '';
  return { text, language: json.language };
}
