import Constants from 'expo-constants';

/** Traces détaillées : dev, ou `EXPO_PUBLIC_DEBUG_MISTRAL=1`, ou `extra.debugMistral` dans app.config. */
function isMistralVerbose(): boolean {
  if (__DEV__) return true;
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEBUG_MISTRAL === '1') return true;
  const extra = Constants.expoConfig?.extra as { debugMistral?: boolean | string } | undefined;
  return extra?.debugMistral === true || extra?.debugMistral === 'true';
}

/** Logs détaillés (requêtes, métadonnées) — désactivés si pas verbose. */
export function mistralTrace(tag: string, data: Record<string, unknown>): void {
  if (!isMistralVerbose()) return;
  console.log(`[InnerVoice/Mistral] ${tag}`, data);
}

/** Toujours afficher (Metro / device logs) — erreurs API. */
export function mistralApiError(context: string, data: Record<string, unknown>): void {
  console.warn(`[InnerVoice/Mistral ERROR] ${context}`, data);
}

export function summarizeBase64Field(
  label: string,
  raw: string | undefined | null
): Record<string, unknown> {
  if (raw == null || typeof raw !== 'string') return { label, present: false };
  const t = raw.trim();
  return {
    label,
    present: true,
    lengthChars: t.length,
    approxBytesDecoded: Math.floor((t.length * 3) / 4),
    looksLikeDataUrl: /^data:audio\//i.test(t),
    head: `${t.slice(0, 48)}${t.length > 48 ? '…' : ''}`,
  };
}

/** Corps JSON pour les logs (pas de dump multi-Mo de ref_audio). */
export function redactBodyForLog(body: Record<string, unknown>): Record<string, unknown> {
  const REDACT = ['ref_audio', 'sample_audio'];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (REDACT.includes(k) && typeof v === 'string') {
      out[k] = summarizeBase64Field(k, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
