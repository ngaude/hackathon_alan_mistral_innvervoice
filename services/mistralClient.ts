import { getMistralApiKey } from '../lib/env';
import { mistralApiError, mistralTrace, redactBodyForLog } from '../lib/mistralDebug';
import { formatMistralErrorResponse } from './mistralErrors';

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

export async function mistralPostJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const key = getMistralApiKey();
  if (!key) {
    throw new MistralHttpError('MISTRAL_API_KEY manquante', 401);
  }
  mistralTrace('POST JSON', { path, body: redactBodyForLog(body) });
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
    mistralApiError('POST JSON failed', {
      path,
      status: res.status,
      responseBodyPreview: text.length > 2500 ? `${text.slice(0, 2500)}…` : text,
      responseLength: text.length,
    });
    const detail = formatMistralErrorResponse(res.status, text);
    throw new MistralHttpError(detail, res.status, text);
  }
  mistralTrace('POST JSON ok', { path, status: res.status, responseChars: text.length });
  return JSON.parse(text) as T;
}
