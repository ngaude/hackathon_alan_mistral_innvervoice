import { AudioQuality, IOSOutputFormat } from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';

/**
 * Options d’enregistrement pour la transcription Mistral, qui n’accepte que **MP3 ou WAV**
 * (erreur 400 sur m4a/aac/3gp).
 *
 * - **iOS** : LINEARPCM → fichier WAV réel.
 * - **Android** : `MediaRecorder` produit souvent du conteneur MP4/3GP (`ftyp`) même avec `.wav` — OK pour
 *   le STT Mistral, **pas** pour le TTS `ref_audio` (WAV/MP3 stricts). Prévoir import fichier ou autre appareil.
 */
export const RECORDING_OPTIONS_STT: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    extension: '.wav',
    outputFormat: 'default',
    audioEncoder: 'default',
    sampleRate: 16000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/** Empreinte vocale / TTS Mistral : même preset WAV que le STT (évite M4A → 400 sur `ref_audio`). */
export const RECORDING_OPTIONS_VOICE_PROFILE: RecordingOptions = RECORDING_OPTIONS_STT;
