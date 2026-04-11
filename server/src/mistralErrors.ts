/** Extrait un message lisible depuis le corps d'erreur HTTP Mistral. */
export function formatMistralErrorResponse(status: number, rawBody: string): string {
  const short = rawBody.length > 800 ? `${rawBody.slice(0, 800)}…` : rawBody;
  try {
    const j = JSON.parse(rawBody) as Record<string, unknown>;
    const obj = j.object;
    const msg = j.message;
    if (typeof msg === 'string') return `Mistral (${status}): ${msg}`;
    if (Array.isArray(msg)) {
      const parts = msg.map((m) =>
        typeof m === 'object' && m && 'msg' in m ? String((m as { msg: string }).msg) : JSON.stringify(m)
      );
      return `Mistral (${status}): ${parts.join(' — ')}`;
    }
    if (obj === 'error' && typeof j.type === 'string') {
      return `Mistral (${status}) [${j.type}]: ${typeof msg === 'string' ? msg : short}`;
    }
  } catch {
    // ignore
  }
  return `Mistral (${status}): ${short}`;
}
