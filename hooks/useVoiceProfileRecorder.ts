import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { RecordingResult } from './useRecorder';
import { useRecorder } from './useRecorder';

/**
 * Expo Go : pas de modules natifs du projet.
 * Ne pas utiliser `import type` depuis `react-native-audio-api` : Metro peut quand même résoudre le module
 * et exécuter son initialisation (`new AudioAPIModule()` au chargement → erreur native module not found).
 */
function isRunningInExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Enregistrement d’empreinte vocale pour Mistral (`ref_audio`).
 *
 * **Android**
 * - **Development build** (binaire compilé avec le projet : `npx expo run:android`, EAS Build, etc.) :
 *   le module natif `react-native-audio-api` est présent → **WAV live** au micro (format compatible Mistral).
 * - **Expo Go** : ce module **n’est pas chargé** (Expo Go ne contient pas les natifs du repo).
 *   On retombe sur **`expo-av`**, qui sort souvent du M4A/MP4 → **repli + import d’un fichier WAV/MP3**
 *   si le clone échoue, ou utiliser un build natif pour le live.
 * - Si l’init native **échoue** (autre cause), même repli `expo-av` (`androidFallbackExpo`).
 *
 * **iOS / web** : `expo-av` (iOS produit déjà du WAV correct pour ce flux).
 */
export function useVoiceProfileRecorder() {
  const expoRec = useRecorder('voiceProfile');
  const [androidRecording, setAndroidRecording] = useState(false);
  /** Si `true`, Android utilise expo-av (pas de WAV garanti). */
  const [androidFallbackExpo, setAndroidFallbackExpo] = useState(false);
  /** Réf. enregistreur natif — type volontairement lâche pour éviter tout import du package au parse Metro. */
  const nativeRef = useRef<{ stop: () => { status: string; path?: string; message?: string } } | null>(null);

  const start = useCallback(async () => {
    if (Platform.OS !== 'android') {
      await expoRec.start();
      return;
    }
    if (isRunningInExpoGo() || androidFallbackExpo) {
      await expoRec.start();
      return;
    }

    try {
      const {
        AudioRecorder: AR,
        AudioManager,
        FileFormat,
        FilePreset,
        FileDirectory,
      } = await import('react-native-audio-api');

      AudioManager.setAudioSessionOptions({
        iosCategory: 'record',
        iosMode: 'default',
        iosOptions: [],
      });

      const perm = await AudioManager.requestRecordingPermissions();
      if (perm !== 'Granted') {
        throw new Error('Permission microphone refusée');
      }

      const sessionOk = await AudioManager.setAudioSessionActivity(true);
      if (!sessionOk) {
        throw new Error('Session audio indisponible');
      }

      const recorder = new AR();
      const prep = recorder.enableFileOutput({
        format: FileFormat.Wav,
        preset: FilePreset.Lossless,
        channelCount: 1,
        directory: FileDirectory.Cache,
        fileNamePrefix: 'innervoice-voice',
      });

      if (prep.status === 'error') {
        await AudioManager.setAudioSessionActivity(false);
        throw new Error(prep.message);
      }

      const started = recorder.start();
      if (started.status === 'error') {
        await AudioManager.setAudioSessionActivity(false);
        throw new Error(started.message);
      }

      nativeRef.current = recorder;
      setAndroidRecording(true);
    } catch {
      setAndroidFallbackExpo(true);
      await expoRec.start();
    }
  }, [androidFallbackExpo, expoRec]);

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    if (Platform.OS !== 'android') {
      return expoRec.stop();
    }
    if (isRunningInExpoGo() || androidFallbackExpo) {
      return expoRec.stop();
    }

    const recorder = nativeRef.current;
    nativeRef.current = null;
    if (!recorder) return null;

    const { AudioManager } = await import('react-native-audio-api');
    const result = recorder.stop();
    setAndroidRecording(false);

    try {
      await AudioManager.setAudioSessionActivity(false);
    } catch {
      /* ignore */
    }

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    const rawPath = result.path;
    if (!rawPath) {
      throw new Error('Chemin fichier enregistrement indéfini');
    }
    const uri = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64 };
  }, [androidFallbackExpo, expoRec]);

  const isRecording =
    Platform.OS === 'android' && !isRunningInExpoGo() && !androidFallbackExpo
      ? androidRecording
      : expoRec.isRecording;

  return { start, stop, isRecording };
}
