/**
 * Parses InnerVoice backend JSON errors and avoids showing raw HTML / proxy blobs (503 overflow, etc.).
 */
export async function readInnervoiceErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  const status = res.status;

  try {
    const j = JSON.parse(text) as { error?: string; message?: string };
    if (typeof j.error === 'string' && j.error.trim()) return j.error.trim();
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
  } catch {
    /* non-JSON body */
  }

  if (status === 503 || status === 502 || status === 504) {
    return 'Service temporarily unavailable. Try again in a moment.';
  }

  const lower = text.toLowerCase();
  if (
    status === 500 &&
    (lower.includes('upstream') || lower.includes('overflow') || lower.includes('disconnect'))
  ) {
    return 'Transcription temporarily unavailable (upstream busy). Try again in a moment.';
  }

  if (text.length > 300 && (text.includes('<!DOCTYPE') || text.includes('<html'))) {
    return 'Server error. Try again later.';
  }

  const trimmed = text.trim();
  if (trimmed.length > 500) return trimmed.slice(0, 280) + '…';
  return trimmed || `Error ${status}`;
}
