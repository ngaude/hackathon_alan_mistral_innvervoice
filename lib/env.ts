import Constants from 'expo-constants';

import {
  MISTRAL_AGENT_NEUTRAL_VOICE_SLUG,
  MISTRAL_CHAT_MODEL_DEFAULT,
  MISTRAL_INNERVOICE_SIMULATED_VOICE_ID,
} from '../constants/voiceParams';

export type VoiceProviderType = 'mistral' | 'elevenlabs';

export function getVoiceProvider(): VoiceProviderType {
  const fromExpo = (Constants.expoConfig?.extra?.voiceProvider as string | undefined)?.trim().toLowerCase();
  if (fromExpo === 'elevenlabs') return 'elevenlabs';
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.VOICE_PROVIDER === 'string'
      ? process.env.VOICE_PROVIDER.trim().toLowerCase()
      : '';
  if (fromProcess === 'elevenlabs') return 'elevenlabs';
  return 'mistral';
}

export function getElevenlabsApiKey(): string {
  const fromExpo = (Constants.expoConfig?.extra?.elevenlabsApiKey as string | undefined)?.trim() ?? '';
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.ELEVENLABS_API_KEY === 'string'
      ? process.env.ELEVENLABS_API_KEY.trim()
      : '';
  return fromExpo || fromProcess;
}

export function getElevenlabsModelId(): string {
  const fromExpo = (Constants.expoConfig?.extra?.elevenlabsModelId as string | undefined)?.trim();
  return fromExpo || 'eleven_multilingual_v2';
}

export function getElevenlabsAgentVoiceId(): string {
  const fromExpo = (Constants.expoConfig?.extra?.elevenlabsAgentVoiceId as string | undefined)?.trim();
  return fromExpo || '';
}

export function getMistralApiKey(): string {
  const fromExpo = (Constants.expoConfig?.extra?.mistralApiKey as string | undefined)?.trim() ?? '';
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_API_KEY === 'string'
      ? process.env.MISTRAL_API_KEY.trim()
      : '';
  return fromExpo || fromProcess;
}

export function getEffectiveAgentVoiceId(): string {
  const rawOverride = Constants.expoConfig?.extra?.mistralAgentVoiceId as string | undefined;
  const override = rawOverride?.trim() || undefined;
  if (override) {
    return override === 'marie' ? MISTRAL_AGENT_NEUTRAL_VOICE_SLUG : override;
  }
  const preset = Constants.expoConfig?.extra?.mistralDefaultAgentVoiceId as string | undefined;
  const raw = (preset?.trim() || MISTRAL_AGENT_NEUTRAL_VOICE_SLUG).trim();
  return raw === 'marie' ? MISTRAL_AGENT_NEUTRAL_VOICE_SLUG : raw;
}

export function getInnervoiceSimulatedUserVoiceId(): string {
  const fromExpo = (Constants.expoConfig?.extra?.mistralInnervoiceSimulatedVoiceId as string | undefined)?.trim();
  if (fromExpo) return fromExpo;
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID === 'string'
      ? process.env.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID.trim()
      : '';
  return fromProcess || MISTRAL_INNERVOICE_SIMULATED_VOICE_ID;
}

export function getMistralTtsModel(): string {
  const m = Constants.expoConfig?.extra?.mistralTtsModel as string | undefined;
  const t = m?.trim();
  return t || 'voxtral-mini-tts-2603';
}

export function getMistralSttModel(): string {
  const m = Constants.expoConfig?.extra?.mistralSttModel as string | undefined;
  const t = m?.trim();
  return t || 'voxtral-mini-latest';
}

export function getMistralChatModel(): string {
  const fromExpo = (Constants.expoConfig?.extra?.mistralChatModel as string | undefined)?.trim();
  if (fromExpo) return fromExpo;
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_CHAT_MODEL === 'string'
      ? process.env.MISTRAL_CHAT_MODEL.trim()
      : '';
  return fromProcess || MISTRAL_CHAT_MODEL_DEFAULT;
}

export function getInnervoiceApiUrl(): string | undefined {
  const u = Constants.expoConfig?.extra?.innervoiceApiUrl as string | undefined;
  const t = u?.trim();
  return t || undefined;
}

export function getInnervoiceApiSecret(): string | undefined {
  const s = Constants.expoConfig?.extra?.innervoiceApiSecret as string | undefined;
  const t = s?.trim();
  return t || undefined;
}

export function getRefAudioConvertUrl(): string | undefined {
  const explicit = (Constants.expoConfig?.extra?.refAudioConvertUrl as string | undefined)?.trim();
  if (explicit) return explicit;
  const base = getInnervoiceApiUrl();
  if (base) return `${base.replace(/\/$/, '')}/api/convert-ref-audio`;
  return undefined;
}

export function getRefAudioConvertSecret(): string | undefined {
  const explicit = (Constants.expoConfig?.extra?.refAudioConvertSecret as string | undefined)?.trim();
  if (explicit) return explicit;
  return getInnervoiceApiSecret();
}
