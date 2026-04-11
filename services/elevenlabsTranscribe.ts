import * as FileSystem from 'expo-file-system/legacy';

import { getElevenlabsApiKey } from '../lib/env';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

function filePartForUri(uri: string): { name: string; type: string } {
  const seg = uri.split('/').pop() ?? 'audio.wav';
  const lower = seg.toLowerCase();
  if (lower.endsWith('.wav')) return { name: seg.endsWith('.wav') ? seg : `${seg}.wav`, type: 'audio/wav' };
  if (lower.endsWith('.mp3')) return { name: seg, type: 'audio/mpeg' };
  if (lower.endsWith('.aac')) return { name: seg, type: 'audio/aac' };
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return { name: seg, type: 'audio/mp4' };
  return { name: 'recording.wav', type: 'audio/wav' };
}

export async function transcribeAudioFromUri(fileUri: string, language = 'fr'): Promise<TranscriptionResult> {
  const key = getElevenlabsApiKey();
  if (!key) throw new Error('ELEVENLABS_API_KEY missing');

  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  if (language) form.append('language_code', language);

  const { name, type } = filePartForUri(fileUri);
  form.append('file', {
    uri: fileUri,
    name,
    type,
  } as unknown as Blob);

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      Accept: 'application/json',
    },
    body: form,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs STT ${res.status}: ${raw.slice(0, 500)}`);
  }

  const json = JSON.parse(raw) as { text?: string; language_code?: string };
  const text = typeof json.text === 'string' ? json.text.trim() : '';
  return { text, language: json.language_code ?? language };
}
