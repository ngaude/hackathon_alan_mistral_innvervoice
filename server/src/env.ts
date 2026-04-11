/** Variables d’environnement serveur (fichier `.env` à la racine `server/` ou export manuel). */

export function getMistralApiKey(): string {
  return (process.env.MISTRAL_API_KEY ?? '').trim();
}

export function getMistralTtsModel(): string {
  return (process.env.MISTRAL_TTS_MODEL ?? '').trim() || 'voxtral-mini-tts-2603';
}

export function getMistralSttModel(): string {
  return (process.env.MISTRAL_STT_MODEL ?? '').trim() || 'voxtral-mini-latest';
}

export function getEffectiveAgentVoiceId(): string {
  const id = (process.env.MISTRAL_AGENT_VOICE_ID ?? '').trim();
  if (id) return id === 'marie' ? 'gb_jane_neutral' : id;
  const preset = (process.env.MISTRAL_DEFAULT_AGENT_VOICE_ID ?? '').trim() || 'gb_jane_neutral';
  return preset === 'marie' ? 'gb_jane_neutral' : preset;
}

/** Mistral voice slug (GET /v1/audio/voices) — simulated user without print / TTS 403 fallback. */
export function getInnervoiceSimulatedUserVoiceId(): string {
  return (process.env.MISTRAL_INNERVOICE_SIMULATED_VOICE_ID ?? '').trim() || 'gb_jane_neutral';
}

export function getServerPort(): number {
  const p = Number(process.env.PORT);
  return Number.isFinite(p) && p > 0 ? p : 8787;
}

/** Si défini, le client doit envoyer `Authorization: Bearer <secret>` ou `X-Innervoice-Secret`. */
export function getServerSecret(): string | undefined {
  const s = (process.env.INNERVOICE_SERVER_SECRET ?? '').trim();
  return s || undefined;
}

/** Logs `perf` détaillés sur stderr (voir `sessionEngine` + routes `transcribe` / `event`). */
export function isPerfLogEnabled(): boolean {
  return process.env.INNERVOICE_PERF_LOG === '1';
}
