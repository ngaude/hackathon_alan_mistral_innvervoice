import { describeMistralAudioBase64, normalizeRefAudioBase64 } from './refAudio.js';
import { getEffectiveAgentVoiceId, getInnervoiceSimulatedUserVoiceId, getMistralTtsModel } from './env.js';
import { MistralHttpError, mistralPostJson } from './mistralClient.js';

interface SpeechResponse {
  audio_data?: string;
  audioData?: string;
}

function extractAudioData(res: SpeechResponse): string | undefined {
  const a = res.audio_data ?? res.audioData;
  return typeof a === 'string' && a.length > 0 ? a : undefined;
}

export async function synthesizeWithVoiceClone(text: string, refAudioBase64: string): Promise<string> {
  const ref = normalizeRefAudioBase64(refAudioBase64);
  const format = describeMistralAudioBase64(refAudioBase64);
  if (format.kind === 'mp4_m4a') {
    throw new Error(
      'M4A/MP4: Mistral accepts WAV or MP3 for ref_audio. Re-record or convert.'
    );
  }
  if (ref.length < 200) {
    throw new Error('Voice sample too short for cloning.');
  }
  const model = getMistralTtsModel();
  const res = await mistralPostJson<SpeechResponse>('/audio/speech', {
    model,
    input: text,
    ref_audio: ref,
    response_format: 'mp3',
  });
  const audio = extractAudioData(res);
  if (!audio) throw new Error('TTS response missing audio_data');
  return audio;
}

export async function synthesizeWithVoiceId(text: string, voiceId: string): Promise<string> {
  const model = getMistralTtsModel();
  const res = await mistralPostJson<SpeechResponse>('/audio/speech', {
    model,
    input: text,
    voice_id: voiceId,
    response_format: 'mp3',
  });
  const audio = extractAudioData(res);
  if (!audio) throw new Error('TTS response missing audio_data');
  return audio;
}

export async function synthesizeWithAgentVoice(text: string): Promise<string> {
  return synthesizeWithVoiceId(text, getEffectiveAgentVoiceId());
}

export async function synthesizeWithSimulatedInnervoiceUser(text: string): Promise<string> {
  return synthesizeWithVoiceId(text, getInnervoiceSimulatedUserVoiceId());
}

interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

export async function synthesizeInnervoiceUserTts(text: string, input: InnervoiceUserTtsInput): Promise<string> {
  const fallback = () => synthesizeWithSimulatedInnervoiceUser(text);
  try {
    if (input.userMistralVoiceId) {
      try {
        return await synthesizeWithVoiceId(text, input.userMistralVoiceId);
      } catch (e) {
        if (e instanceof MistralHttpError && e.status === 403) return await fallback();
        throw e;
      }
    }
    if (input.voiceProfileBase64) {
      try {
        return await synthesizeWithVoiceClone(text, input.voiceProfileBase64);
      } catch (e) {
        if (e instanceof MistralHttpError && e.status === 403) return await fallback();
        throw e;
      }
    }
    return await fallback();
  } catch (e) {
    if (e instanceof MistralHttpError && e.status === 403) return await fallback();
    throw e;
  }
}
