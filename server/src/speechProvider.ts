/**
 * TTS provider router — delegates to Mistral or ElevenLabs based on VOICE_PROVIDER env.
 */
import { getVoiceProvider } from './env.js';
import * as mistral from './mistralSpeech.js';
import * as elevenlabs from './elevenlabsSpeech.js';

interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

export async function synthesizeWithVoiceId(text: string, voiceId: string): Promise<string> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabs.synthesizeWithVoiceId(text, voiceId)
    : mistral.synthesizeWithVoiceId(text, voiceId);
}

export async function synthesizeWithVoiceClone(text: string, refAudioBase64: string): Promise<string> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabs.synthesizeWithVoiceClone(text, refAudioBase64)
    : mistral.synthesizeWithVoiceClone(text, refAudioBase64);
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
