import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useMemo } from 'react';

import { RECORDING_OPTIONS_STT, RECORDING_OPTIONS_VOICE_PROFILE } from '../constants/recordingStt';

type RecorderQuality = 'low' | 'high' | 'stt' | 'voiceProfile';

function optionsForQuality(q: RecorderQuality): RecordingOptions {
  if (q === 'stt') return RECORDING_OPTIONS_STT;
  if (q === 'voiceProfile') return RECORDING_OPTIONS_VOICE_PROFILE;
  if (q === 'high') return RecordingPresets.HIGH_QUALITY;
  return RecordingPresets.LOW_QUALITY;
}

export interface RecordingResult {
  uri: string;
  base64: string;
}

export function useRecorder(quality: RecorderQuality = 'low') {
  const options = useMemo(() => optionsForQuality(quality), [quality]);
  const recorder = useAudioRecorder(options);
  const recorderState = useAudioRecorderState(recorder, 200);
  const isRecording = recorderState.isRecording;

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Microphone permission denied');
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    if (!recorder.getStatus().isRecording) {
      return null;
    }
    await recorder.stop();
    const uriRaw = recorder.uri;
    if (!uriRaw) return null;
    const uri = uriRaw.startsWith('file://') ? uriRaw : `file://${uriRaw}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64 };
  }, [recorder]);

  return { start, stop, isRecording };
}
