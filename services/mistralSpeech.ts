import { getEffectiveAgentVoiceId, getInnervoiceSimulatedUserVoiceId, getMistralTtsModel } from '../lib/env';
import { mistralTrace, summarizeBase64Field } from '../lib/mistralDebug';
import { describeMistralAudioBase64, normalizeRefAudioBase64 } from '../lib/refAudio';
import { MistralHttpError, mistralPostJson } from './mistralClient';

interface SpeechResponse {
  audio_data?: string;
  audioData?: string;
}

function extractAudioData(res: SpeechResponse): string | undefined {
  const a = res.audio_data ?? res.audioData;
  return typeof a === 'string' && a.length > 0 ? a : undefined;
}

/** Synthèse avec échantillon utilisateur (zero-shot clone). */
async function synthesizeWithVoiceClone(
  text: string,
  refAudioBase64: string
): Promise<string> {
  const ref = normalizeRefAudioBase64(refAudioBase64);
  const format = describeMistralAudioBase64(refAudioBase64);
  mistralTrace('TTS ref_audio', {
    inputTextChars: text.length,
    ref: summarizeBase64Field('ref_audio', ref),
    detectedFormat: format,
    model: getMistralTtsModel(),
    hint:
      format.kind === 'mp4_m4a'
        ? 'M4A/MP4 rejected by Mistral — record as WAV (voiceProfile preset).'
        : '400 on ref_audio = unreadable sample, too short, or broken base64.',
  });
  if (format.kind === 'mp4_m4a') {
    throw new Error(
      'M4A/MP4: Mistral only accepts MP3 or WAV for cloning. On Android, import WAV/MP3 from the voice screen, or re-record on a device that outputs WAV (e.g. iOS).'
    );
  }
  if (ref.length < 200) {
    mistralTrace('TTS ref_audio rejected (local)', { reason: 'too_short', length: ref.length });
    throw new Error(
      'Voice sample too short or invalid. Re-record 5–10 s of audio (check network / mic quality).'
    );
  }
  const model = getMistralTtsModel();
  const res = await mistralPostJson<SpeechResponse>('/audio/speech', {
    model,
    input: text,
    ref_audio: ref,
    response_format: 'mp3',
  });
  const audio = extractAudioData(res);
  if (!audio) {
    throw new Error('TTS response missing audio_data — check model and API permissions.');
  }
  return audio;
}

/** Preset “Jane” neutral — simulated user (no print or 403 fallback). */
async function synthesizeWithSimulatedInnervoiceUser(text: string): Promise<string> {
  const voiceId = getInnervoiceSimulatedUserVoiceId();
  mistralTrace('TTS simulated user (Jane neutral)', { voiceId, inputTextChars: text.length });
  return synthesizeWithVoiceId(text, voiceId);
}

export interface InnervoiceUserTtsInput {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}

/**
 * User TTS: clone / personal voice_id when available; else Jane neutral preset.
 * On HTTP **403** (TTS / clone rights), fall back to Jane neutral preset.
 */
export async function synthesizeInnervoiceUserTts(text: string, input: InnervoiceUserTtsInput): Promise<string> {
  const trySimulated = () => synthesizeWithSimulatedInnervoiceUser(text);

  try {
    if (input.userMistralVoiceId) {
      try {
        return await synthesizeWithVoiceId(text, input.userMistralVoiceId);
      } catch (e) {
        if (e instanceof MistralHttpError && e.status === 403) return await trySimulated();
        throw e;
      }
    }
    if (input.voiceProfileBase64) {
      try {
        return await synthesizeWithVoiceClone(text, input.voiceProfileBase64);
      } catch (e) {
        if (e instanceof MistralHttpError && e.status === 403) return await trySimulated();
        throw e;
      }
    }
    return await trySimulated();
  } catch (e) {
    if (e instanceof MistralHttpError && e.status === 403) return await trySimulated();
    throw e;
  }
}

/** Synthesis with a Mistral `voice_id` (saved voice or preset slug, e.g. `gb_jane_neutral`). */
async function synthesizeWithVoiceId(text: string, voiceId: string): Promise<string> {
  const model = getMistralTtsModel();
  mistralTrace('TTS voice_id', {
    model,
    voiceId,
    inputTextChars: text.length,
    hint: '400 = unknown voice_id or incompatible model.',
  });
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

/** Agent voice: default preset (`gb_jane_neutral`) or `MISTRAL_AGENT_VOICE_ID` if set. */
export async function synthesizeWithAgentVoice(text: string): Promise<string> {
  const voiceId = getEffectiveAgentVoiceId();
  return synthesizeWithVoiceId(text, voiceId);
}
