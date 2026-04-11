import Constants from 'expo-constants';

import { MISTRAL_AGENT_NEUTRAL_VOICE_SLUG, MISTRAL_INNERVOICE_SIMULATED_VOICE_ID } from '../constants/voiceParams';

/**
 * Clé API : injectée au build via `app.config.js` → `expo.extra.mistralApiKey` (depuis `.env`).
 * En runtime RN, `process.env.MISTRAL_API_KEY` n’est en général **pas** défini sans plugin Babel ;
 * on utilise donc surtout `Constants.expoConfig.extra`.
 *
 * Important : si `extra.mistralApiKey` vaut `''`, l’opérateur `??` ne bascule pas sur `process.env`
 * (car `''` n’est pas nullish) — d’où le repli explicite avec `||`.
 */
export function getMistralApiKey(): string {
  const fromExpo = (Constants.expoConfig?.extra?.mistralApiKey as string | undefined)?.trim() ?? '';
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_API_KEY === 'string'
      ? process.env.MISTRAL_API_KEY.trim()
      : '';
  return fromExpo || fromProcess;
}

/**
 * Voix TTS « agent » (neutre) : `MISTRAL_AGENT_VOICE_ID` si défini, sinon
 * `MISTRAL_DEFAULT_AGENT_VOICE_ID` (default **gb_jane_neutral**, API slug — not the short alias `marie`).
 */
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

/**
 * Simulated user voice (Jane neutral preset): no print, or fallback if TTS clone / personal voice returns 403.
 * Surcharge : `MISTRAL_INNERVOICE_SIMULATED_VOICE_ID` dans `.env` → `expo.extra`.
 */
export function getInnervoiceSimulatedUserVoiceId(): string {
  const fromExpo = (Constants.expoConfig?.extra?.mistralInnervoiceSimulatedVoiceId as string | undefined)?.trim();
  if (fromExpo) return fromExpo;
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID === 'string'
      ? process.env.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID.trim()
      : '';
  return fromProcess || MISTRAL_INNERVOICE_SIMULATED_VOICE_ID;
}

/** Modèle Voxtral TTS (`voxtral-mini-tts-2603`, etc.). Surcharge : `MISTRAL_TTS_MODEL` dans `.env`. */
export function getMistralTtsModel(): string {
  const m = Constants.expoConfig?.extra?.mistralTtsModel as string | undefined;
  const t = m?.trim();
  return t || 'voxtral-mini-tts-2603';
}

/** Modèle STT Voxtral (transcription). */
export function getMistralSttModel(): string {
  const m = Constants.expoConfig?.extra?.mistralSttModel as string | undefined;
  const t = m?.trim();
  return t || 'voxtral-mini-latest';
}

/**
 * URL du serveur InnerVoice (`server/`) — si défini, la logique LLM / session passe par l’API.
 * Injectée via `app.config.js` : priorité à `EXPO_PUBLIC_INNERVOICE_API_URL`, sinon `http://<IP LAN>:port`
 * (port `EXPO_PUBLIC_INNERVOICE_API_PORT` ou 8787). Vide seulement si aucune interface réseau n’a été détectée au build.
 */
export function getInnervoiceApiUrl(): string | undefined {
  const u = Constants.expoConfig?.extra?.innervoiceApiUrl as string | undefined;
  const t = u?.trim();
  return t || undefined;
}

/** Optionnel : même secret que `INNERVOICE_SERVER_SECRET` côté serveur. */
export function getInnervoiceApiSecret(): string | undefined {
  const s = Constants.expoConfig?.extra?.innervoiceApiSecret as string | undefined;
  const t = s?.trim();
  return t || undefined;
}

/**
 * URL de conversion M4A → WAV (empreinte Mistral, **Expo Go**).
 * - `EXPO_PUBLIC_REF_AUDIO_CONVERT_URL` si défini ;
 * - sinon, si `EXPO_PUBLIC_INNERVOICE_API_URL` est défini → `{innervoice}/api/convert-ref-audio` (serveur avec ffmpeg).
 */
export function getRefAudioConvertUrl(): string | undefined {
  const explicit = (Constants.expoConfig?.extra?.refAudioConvertUrl as string | undefined)?.trim();
  if (explicit) return explicit;
  const base = getInnervoiceApiUrl();
  if (base) return `${base.replace(/\/$/, '')}/api/convert-ref-audio`;
  return undefined;
}

/** Secret pour la conversion : `REF_AUDIO` dédié, ou repli sur `EXPO_PUBLIC_INNERVOICE_API_SECRET`. */
export function getRefAudioConvertSecret(): string | undefined {
  const explicit = (Constants.expoConfig?.extra?.refAudioConvertSecret as string | undefined)?.trim();
  if (explicit) return explicit;
  return getInnervoiceApiSecret();
}
