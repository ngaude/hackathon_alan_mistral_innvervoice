import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { tryConvertCompressedFileToWavBase64 } from './convertCompressedAudioToWavBase64';
import { describeMistralAudioBase64 } from './refAudio';
import { tryConvertM4aBase64ToWavViaHttp } from './refAudioRemoteConvert';

/** Fichier audio acceptable pour Mistral `ref_audio` (WAV ou MP3 détectés par en-tête). */
function isMistralRefAudioBase64Ok(base64: string): boolean {
  const k = describeMistralAudioBase64(base64).kind;
  return k === 'wav' || k === 'mp3';
}

/**
 * Import utilisateur (surtout Android : enregistrement micro → souvent MP4/M4A).
 * Retourne le base64 brut ou null si annulé.
 */
export async function pickMistralCompatibleAudioBase64(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/*'],
    copyToCacheDirectory: true,
  });
  if (!res.canceled && res.assets?.[0]) {
    const uri = res.assets[0].uri;
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (isMistralRefAudioBase64Ok(b64)) return b64;

    if (describeMistralAudioBase64(b64).kind === 'mp4_m4a') {
      const wav = await tryConvertCompressedFileToWavBase64(uri);
      if (wav && isMistralRefAudioBase64Ok(wav)) return wav;
      const remote = await tryConvertM4aBase64ToWavViaHttp(b64);
      if (remote && isMistralRefAudioBase64Ok(remote)) return remote;
    }

    throw new Error(
      'Fichier non reconnu comme WAV ou MP3. M4A : conversion locale (development build) ou distante (EXPO_PUBLIC_REF_AUDIO_CONVERT_URL), sinon exportez un WAV 16 kHz mono.'
    );
  }
  return null;
}
