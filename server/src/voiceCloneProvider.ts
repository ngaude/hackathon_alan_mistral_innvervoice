/**
 * Voice clone provider router — delegates to Mistral or ElevenLabs based on VOICE_PROVIDER env.
 */
import { getVoiceProvider } from './env.js';
import { createMistralClonedVoice } from './mistralVoices.js';
import { createElevenlabsClonedVoice } from './elevenlabsVoices.js';

export async function createClonedVoice(
  sampleBase64: string,
  filename: string,
  name?: string
): Promise<string> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? createElevenlabsClonedVoice(sampleBase64, filename, name)
    : createMistralClonedVoice(sampleBase64, filename, name);
}
