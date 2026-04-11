export const INNERVOICE_PAUSE_MS_BETWEEN_SEGMENTS = 1500;

export const MISTRAL_CHAT_MODEL = 'mistral-large-latest';

/**
 * Neutral agent voice (Voxtral API slug). Short alias `marie` in env is mapped to this slug in `lib/env.ts`.
 * List: GET https://api.mistral.ai/v1/audio/voices
 */
export const MISTRAL_AGENT_NEUTRAL_VOICE_SLUG = 'gb_jane_neutral';

/**
 * Mistral preset slug when simulating the user without a voice print / TTS 403 fallback.
 * List: GET /v1/audio/voices
 */
export const MISTRAL_INNERVOICE_SIMULATED_VOICE_ID = 'gb_jane_neutral';
