import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';

import { RECORDING_OPTIONS_STT, RECORDING_OPTIONS_VOICE_PROFILE } from '../constants/recordingStt';

type RecorderQuality = 'low' | 'high' | 'stt' | 'voiceProfile';

export interface RecordingResult {
  uri: string;
  base64: string;
}

function optionsForQuality(q: RecorderQuality): Audio.RecordingOptions {
  if (q === 'stt') return RECORDING_OPTIONS_STT;
  /** WAV 16 kHz — requis pour Mistral TTS `ref_audio` (pas de M4A « haute qualité »). */
  if (q === 'voiceProfile') return RECORDING_OPTIONS_VOICE_PROFILE;
  if (q === 'high') return Audio.RecordingOptionsPresets.HIGH_QUALITY;
  return Audio.RecordingOptionsPresets.LOW_QUALITY;
}

export function useRecorder(quality: RecorderQuality = 'low') {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback(async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Microphone permission denied');
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(optionsForQuality(quality));
    await rec.startAsync();
    setRecording(rec);
    setIsRecording(true);
  }, [quality]);

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    if (!recording) return null;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64 };
  }, [recording]);

  return { start, stop, isRecording };
}
