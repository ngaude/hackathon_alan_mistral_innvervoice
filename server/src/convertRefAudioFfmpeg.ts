import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { normalizeRefAudioBase64 } from './refAudio.js';

/**
 * M4A/MP4/AAC → WAV PCM 16 kHz mono (Mistral `ref_audio`) via **ffmpeg** sur le PATH.
 */
export async function convertCompressedBase64ToWavBase64(audioBase64: string): Promise<string> {
  const raw = normalizeRefAudioBase64(audioBase64);
  const id = randomUUID();
  const inFile = path.join(tmpdir(), `iv-in-${id}.m4a`);
  const outFile = path.join(tmpdir(), `iv-out-${id}.wav`);
  try {
    await writeFile(inFile, Buffer.from(raw, 'base64'));

    const ff = spawnSync(
      'ffmpeg',
      ['-y', '-i', inFile, '-ar', '16000', '-ac', '1', '-f', 'wav', outFile],
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    if (ff.status !== 0) {
      const err = `${ff.stderr || ''}${ff.stdout || ''}`.toString().slice(0, 400);
      throw new Error(`ffmpeg (${ff.status}): ${err || 'échec'}`);
    }

    const out = await readFile(outFile);
    return out.toString('base64');
  } finally {
    await unlink(inFile).catch(() => {});
    await unlink(outFile).catch(() => {});
  }
}

export function hasFfmpeg(): boolean {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  return r.status === 0;
}
