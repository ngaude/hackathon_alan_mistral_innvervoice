import Constants from 'expo-constants';

import { pcm16MonoToWavBase64 } from './pcm16MonoToWavBase64';

/** Aligné sur `RECORDING_OPTIONS_*` / Mistral — le décodeur natif peut resampler vers ce taux. */
const TARGET_SAMPLE_RATE = 16000;

/**
 * Décode un fichier local (M4A/MP4/AAC…) via `react-native-audio-api` (FFmpeg natif) et produit un WAV PCM
 * 16-bit mono en base64 brut, compatible Mistral `ref_audio`.
 *
 * Retourne `null` si le module natif n’est pas disponible (ex. Expo Go) ou si le décodage échoue.
 */
export async function tryConvertCompressedFileToWavBase64(fileUri: string): Promise<string | null> {
  if (Constants.appOwnership === 'expo') {
    return null;
  }
  try {
    const { decodeAudioData } = await import('react-native-audio-api');
    if (typeof decodeAudioData !== 'function') return null;

    const buffer = await decodeAudioData(fileUri, TARGET_SAMPLE_RATE);
    const { length, numberOfChannels: n, sampleRate } = buffer;
    if (n < 1 || length === 0) return null;

    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let c = 0; c < n; c++) {
        sum += buffer.getChannelData(c)[i] ?? 0;
      }
      mono[i] = sum / n;
    }

    const pcm = new Uint8Array(length * 2);
    const view = new DataView(pcm.buffer);
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]!));
      view.setInt16(i * 2, Math.round(s * 32767), true);
    }

    return pcm16MonoToWavBase64(pcm, sampleRate);
  } catch {
    return null;
  }
}
