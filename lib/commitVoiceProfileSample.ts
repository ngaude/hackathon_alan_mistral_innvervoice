import { Platform } from 'react-native';

import { tryConvertCompressedFileToWavBase64 } from './convertCompressedAudioToWavBase64';
import { getInnervoiceApiUrl } from './env';
import { cloneVoiceOnServer } from './innervoiceApi';
import { describeMistralAudioBase64 } from './refAudio';
import { tryConvertM4aBase64ToWavViaHttp } from './refAudioRemoteConvert';
import { getOrCreateUserId } from './userIdentity';
import { useSessionStore } from '../store/sessionStore';

export type CommitVoiceProfileResult = { ok: true } | { ok: false; message: string };

/**
 * Valide le format, applique les conversions M4A si besoin, met à jour le store et clone côté serveur Mistral.
 * Aligné sur le flux `app/onboarding/voice-capture.tsx`.
 */
export async function commitVoiceProfileSample(
  outBase64: string,
  sourceUri?: string | null
): Promise<CommitVoiceProfileResult> {
  let b64 = outBase64;
  let fmt = describeMistralAudioBase64(b64);
  if (fmt.kind === 'mp4_m4a' && sourceUri) {
    const converted = await tryConvertCompressedFileToWavBase64(sourceUri);
    if (converted) {
      b64 = converted;
      fmt = describeMistralAudioBase64(b64);
    }
  }
  if (fmt.kind === 'mp4_m4a') {
    const remote = await tryConvertM4aBase64ToWavViaHttp(b64);
    if (remote) {
      b64 = remote;
      fmt = describeMistralAudioBase64(b64);
    }
  }
  if (fmt.kind === 'mp4_m4a') {
    return {
      ok: false,
      message:
        Platform.OS === 'android'
          ? 'M4A/MP4 is not accepted by Mistral. Options: set EXPO_PUBLIC_REF_AUDIO_CONVERT_URL (remote conversion, Expo Go), import WAV/MP3, or use a development build with local conversion.'
          : 'Audio format not compatible (M4A). Try again, import WAV/MP3, or set EXPO_PUBLIC_REF_AUDIO_CONVERT_URL.',
    };
  }
  if (fmt.kind !== 'wav' && fmt.kind !== 'mp3') {
    return { ok: false, message: 'Unrecognized audio format. Use WAV or MP3.' };
  }
  if (!getInnervoiceApiUrl()) {
    return {
      ok: false,
      message: 'The InnerVoice server is required to store your voice print (Mistral API side).',
    };
  }

  useSessionStore.getState().setVoiceProfile(b64);
  try {
    const ext = fmt.kind === 'mp3' ? 'voice.mp3' : 'voice.wav';
    const uid = await getOrCreateUserId();
    const { mistralVoiceId } = await cloneVoiceOnServer(uid, b64, ext);
    useSessionStore.getState().setUserMistralVoiceId(mistralVoiceId);
  } catch {
    /* voix clonée optionnelle — repli ref_audio / voix neutre */
  }
  return { ok: true };
}
