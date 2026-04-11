/** Logs API — jamais de base64 / clés complets. */

const P = '[InnerVoice/API]';

export function logInfo(message: string, data?: Record<string, unknown>): void {
  if (data && Object.keys(data).length > 0) {
    console.log(`${P} ${message}`, data);
  } else {
    console.log(`${P} ${message}`);
  }
}

export function logWarn(message: string, data?: Record<string, unknown>): void {
  console.warn(`${P} ${message}`, data ?? '');
}

export function logError(message: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${P} ${message}`, msg);
}

/** Taille indicative d’un champ base64 (caractères). */
export function b64Len(b64: string | undefined | null): number {
  if (typeof b64 !== 'string') return 0;
  return b64.replace(/\s/g, '').length;
}
