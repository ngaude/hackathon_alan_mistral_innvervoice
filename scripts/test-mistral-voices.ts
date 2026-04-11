/**
 * Test manuel : POST https://api.mistral.ai/v1/audio/voices
 * Usage (racine du repo) : npx tsx scripts/test-mistral-voices.ts
 *                          npm run test:mistral-voices
 * Charge MISTRAL_API_KEY depuis `.env` à la racine.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Buffer } from 'node:buffer';

import { mistralPostJson } from '../server/src/mistralClient.js';

/** WAV PCM16 mono → base64 (même contrat que `lib/pcm16MonoToWavBase64`). */
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
/** ~5 s de silence PCM16 mono (WAV valide pour Mistral). */
const SECONDS = 5;
const pcmBytes = new Uint8Array(SR * SECONDS * 2); // 0 = silence
const sampleBase64 = pcm16MonoToWavBase64(pcmBytes, SR);

async function main(): Promise<void> {
  const k = process.env.MISTRAL_API_KEY?.trim();
  console.log('[test] MISTRAL_API_KEY :', k ? `définie (${k.length} caractères)` : 'absente');
  console.log('[test] Échantillon WAV :', SECONDS, 's @', SR, 'Hz, base64 length', sampleBase64.length);

  try {
    const res = await mistralPostJson<{ id: string }>('/audio/voices', {
      name: `InnerVoice-smoke-${new Date().toISOString().slice(0, 19)}Z`,
      sample_audio: sampleBase64,
      sample_filename: 'smoke.wav',
      languages: ['fr'],
    });
    console.log('[test] OK — voice id :', res.id);
    process.exit(0);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; body?: string };
    console.error('[test] Échec :', err.message ?? e);
    if (typeof err.status === 'number') console.error('[test] HTTP', err.status);
    if (err.body) console.error('[test] Corps (extrait) :', err.body.slice(0, 800));
    process.exit(1);
  }
}

main();
