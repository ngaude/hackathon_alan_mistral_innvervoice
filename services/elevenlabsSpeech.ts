import { getElevenlabsAgentVoiceId, getElevenlabsModelId, getInnervoiceSimulatedUserVoiceId } from '../lib/env';
import { elevenlabsPostBinary, ElevenlabsHttpError } from './elevenlabsClient';

async function ttsWithVoice(text: string, voiceId: string): Promise<string> {
  const modelId = getElevenlabsModelId();
  return elevenlabsPostBinary(`/text-to-speech/${voiceId}`, {
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });
}

export async function synthesizeWithVoiceId(text: string, voiceId: string): Promise<string> {
  return ttsWithVoice(text, voiceId);
}

export async function synthesizeWithAgentVoice(text: string): Promise<string> {
  const voiceId = getElevenlabsAgentVoiceId();
  if (!voiceId) throw new Error('ELEVENLABS_AGENT_VOICE_ID not set');
  return ttsWithVoice(text, voiceId);
}

export interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

export async function synthesizeInnervoiceUserTts(
  text: string,
  input: InnervoiceUserTtsInput
): Promise<string> {
  const fallback = async () => {
    const voiceId = getElevenlabsAgentVoiceId() || getInnervoiceSimulatedUserVoiceId();
    return ttsWithVoice(text, voiceId);
  };

  try {
    if (input.userMistralVoiceId) {
      try {
        return await synthesizeWithVoiceId(text, input.userMistralVoiceId);
      } catch (e) {
        if (e instanceof ElevenlabsHttpError && (e.status === 403 || e.status === 401))
          return await fallback();
        throw e;
      }
    }
    return await fallback();
  } catch (e) {
    if (e instanceof ElevenlabsHttpError && (e.status === 403 || e.status === 401))
      return await fallback();
    throw e;
  }
}
