import { getElevenlabsApiKey } from './env.js';
import { ElevenlabsHttpError } from './elevenlabsClient.js';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

function guessContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  return 'audio/wav';
}

export async function transcribeAudioBase64(
  audioBase64: string,
  filename = 'recording.wav',
  language = 'fr'
): Promise<TranscriptionResult> {
  const key = getElevenlabsApiKey();
  if (!key) throw new Error('ELEVENLABS_API_KEY missing');

  const buf = Buffer.from(audioBase64.replace(/\s/g, ''), 'base64');
  const blob = new Blob([buf], { type: guessContentType(filename) });

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model_id', 'scribe_v1');
  if (language) form.append('language_code', language);

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': key,
    },
    body: form,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new ElevenlabsHttpError(
      `ElevenLabs STT ${res.status}: ${raw.slice(0, 500)}`,
      res.status,
      raw
    );
  }

  const json = JSON.parse(raw) as { text?: string; language_code?: string };
  const text = typeof json.text === 'string' ? json.text.trim() : '';
  return { text, language: json.language_code ?? language };
}
