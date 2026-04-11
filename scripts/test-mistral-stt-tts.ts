/**
 * Smoke test : STT (transcriptions) + TTS (speech) Mistral via le même code que le serveur.
 * Usage (racine) : npx tsx scripts/test-mistral-stt-tts.ts
 * Charge MISTRAL_API_KEY depuis `.env` à la racine.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Buffer } from 'node:buffer';

import { getEffectiveAgentVoiceId, getMistralSttModel, getMistralTtsModel } from '../server/src/env.js';
import { transcribeAudioBase64 } from '../server/src/mistralTranscribe.js';
import { synthesizeWithVoiceId } from '../server/src/mistralSpeech.js';

/** WAV PCM16 mono → base64 (identique à `scripts/test-mistral-voices.ts`). */
function pcm16MonoToWavBase64(pcm: Uint8Array, sampleRate: number): string {
  if (pcm.byteLength % 2 !== 0) throw new Error('PCM non paire');
  const dataSize = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) u8[o + i] = s.charCodeAt(i);
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);
  u8.set(pcm, 44);
  return Buffer.from(u8).toString('base64');
}

const SR = 16_000;
const SECONDS = 3;
const pcmBytes = new Uint8Array(SR * SECONDS * 2);
const wavBase64 = pcm16MonoToWavBase64(pcmBytes, SR);

async function main(): Promise<void> {
  const k = process.env.MISTRAL_API_KEY?.trim();
  console.log('[smoke] MISTRAL_API_KEY :', k ? `définie (${k.length} caractères)` : 'absente');
  if (!k) {
    console.error('[smoke] Arrêt : ajoutez MISTRAL_API_KEY dans .env à la racine.');
    process.exit(1);
  }

  const sttModel = getMistralSttModel();
  const ttsModel = getMistralTtsModel();
  const voiceId = getEffectiveAgentVoiceId();
  console.log('[smoke] Modèles : STT =', sttModel, '| TTS =', ttsModel);
  console.log('[smoke] Voix agent (TTS) :', voiceId);

  console.log('\n[smoke] STT — envoi WAV silence (~3 s)…');
  try {
    const stt = await transcribeAudioBase64(wavBase64, 'smoke.wav', 'fr');
    console.log('[smoke] STT OK — texte :', JSON.stringify(stt.text), '| lang :', stt.language ?? '—');
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('[smoke] STT échec :', err.message ?? e);
    process.exit(1);
  }

  const phrase = 'Bonjour, ceci est un test InnerVoice.';
  console.log('\n[smoke] TTS — phrase :', JSON.stringify(phrase));
  try {
    const mp3b64 = await synthesizeWithVoiceId(phrase, voiceId);
    console.log('[smoke] TTS OK — audio base64 length :', mp3b64.length, '(caractères)');
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number };
    console.error('[smoke] TTS échec :', err.message ?? e);
    if (typeof err.status === 'number') console.error('[smoke] HTTP', err.status);
    process.exit(1);
  }

  console.log('\n[smoke] Terminé sans erreur.');
}

main();
