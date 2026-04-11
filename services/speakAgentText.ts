import * as Speech from 'expo-speech';
import { AGENT_VOICE_VOLUME } from '../constants/audioPlayback';
import { mistralApiError } from '../lib/mistralDebug';
import { sanitizeSpokenText } from '../lib/sanitizeSpokenText';
import { synthesizeWithAgentVoice } from './speechProvider';
import { playMp3Base64 } from './audioPlayer';

/** Agent voice (Jane / neutral) — lower volume vs cloned InnerVoice. */
export async function speakAgentText(text: string): Promise<void> {
  const clean = sanitizeSpokenText(text);
  try {
    const b64 = await synthesizeWithAgentVoice(clean);
    await playMp3Base64(b64, { volume: AGENT_VOICE_VOLUME });
    return;
  } catch (e) {
    mistralApiError('speakAgentText → fallback expo-speech', {
      error: e instanceof Error ? e.message : String(e),
      textChars: text.length,
    });
  }
  await new Promise<void>((resolve, reject) => {
    try {
      Speech.speak(clean, {
        language: 'en-US',
        rate: 0.92,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (e) => reject(e),
      });
    } catch (e) {
      reject(e);
    }
  });
}
