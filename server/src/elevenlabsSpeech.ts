import { getElevenlabsAgentVoiceId, getElevenlabsModelId, getInnervoiceSimulatedUserVoiceId } from './env.js';
import { elevenlabsPostBinary, ElevenlabsHttpError } from './elevenlabsClient.js';

async function ttsWithVoice(text: string, voiceId: string): Promise<string> {
  const modelId = getElevenlabsModelId();
  const buf = await elevenlabsPostBinary(`/text-to-speech/${voiceId}`, {
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });
  return buf.toString('base64');
}

export async function synthesizeWithVoiceId(text: string, voiceId: string): Promise<string> {
  return ttsWithVoice(text, voiceId);
}

export async function synthesizeWithVoiceClone(text: string, _refAudioBase64: string): Promise<string> {
  // ElevenLabs instant clone requires a pre-created voice_id — ref_audio passthrough not supported.
  // Callers should clone first via voiceCloneProvider, then use the returned voiceId.
  throw new Error(
    'ElevenLabs does not support zero-shot ref_audio TTS. Clone the voice first via /api/users/:id/voice/clone.'
  );
}

export async function synthesizeWithAgentVoice(text: string): Promise<string> {
  const voiceId = getElevenlabsAgentVoiceId();
  if (!voiceId) throw new Error('ELEVENLABS_AGENT_VOICE_ID not set');
  return ttsWithVoice(text, voiceId);
}

export async function synthesizeWithSimulatedInnervoiceUser(text: string): Promise<string> {
  const voiceId = getElevenlabsAgentVoiceId() || getInnervoiceSimulatedUserVoiceId();
  return ttsWithVoice(text, voiceId);
}

interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

export async function synthesizeInnervoiceUserTts(
  text: string,
  input: InnervoiceUserTtsInput
): Promise<string> {
  const fallback = () => synthesizeWithSimulatedInnervoiceUser(text);
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
