import { getElevenlabsApiKey } from '../lib/env';

const BASE = 'https://api.elevenlabs.io/v1';

export class ElevenlabsHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'ElevenlabsHttpError';
  }
}

export async function elevenlabsPostBinary(
  path: string,
  body: Record<string, unknown>
): Promise<string> {
  const key = getElevenlabsApiKey();
  if (!key) throw new ElevenlabsHttpError('ELEVENLABS_API_KEY missing', 401);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ElevenlabsHttpError(
      `ElevenLabs ${res.status}: ${text.slice(0, 500)}`,
      res.status,
      text
    );
  }
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
