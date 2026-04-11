import { getMistralApiKey } from './env.js';
import { formatMistralErrorResponse } from './mistralErrors.js';

const BASE = 'https://api.mistral.ai/v1';

export class MistralHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'MistralHttpError';
  }
}

function redactBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if ('ref_audio' in out) out.ref_audio = '[redacted]';
  return out;
}

export async function mistralPostJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = getMistralApiKey();
  if (!key) {
    throw new MistralHttpError('MISTRAL_API_KEY manquante', 401);
  }
  if (process.env.INNERVOICE_DEBUG_MISTRAL === '1') {
    console.log('[Mistral] POST', path, redactBody(body));
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = formatMistralErrorResponse(res.status, text);
    throw new MistralHttpError(detail, res.status, text);
  }
  return JSON.parse(text) as T;
}

/** GET JSON (ex. liste des voix) — utilisé par les scripts `scripts/`. */
export async function mistralGetJson<T>(path: string): Promise<T> {
  const key = getMistralApiKey();
  if (!key) {
    throw new MistralHttpError('MISTRAL_API_KEY manquante', 401);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = formatMistralErrorResponse(res.status, text);
    throw new MistralHttpError(detail, res.status, text);
  }
  return JSON.parse(text) as T;
}
