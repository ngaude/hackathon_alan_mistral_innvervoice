/**
 * Client-side TTS provider router — delegates to Mistral or ElevenLabs based on VOICE_PROVIDER.
 */
import { getVoiceProvider } from '../lib/env';
import * as mistral from './mistralSpeech';
import * as elevenlabs from './elevenlabsSpeech';

export interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

export async function synthesizeWithAgentVoice(text: string): Promise<string> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabs.synthesizeWithAgentVoice(text)
    : mistral.synthesizeWithAgentVoice(text);
}

export async function synthesizeInnervoiceUserTts(
  text: string,
  input: InnervoiceUserTtsInput
): Promise<string> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabs.synthesizeInnervoiceUserTts(text, input)
    : mistral.synthesizeInnervoiceUserTts(text, input);
}
