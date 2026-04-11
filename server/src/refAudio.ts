export function normalizeRefAudioBase64(b64: string): string {
  const t = b64.trim();
  const dataUrl = /^data:audio\/[^;]+;base64,(.+)$/is.exec(t);
  if (dataUrl?.[1]) return dataUrl[1].replace(/\s/g, '');
  return t.replace(/\s/g, '');
}

export function describeMistralAudioBase64(b64: string): {
  kind: 'wav' | 'mp3' | 'mp4_m4a' | 'unknown';
  detail: string;
} {
  const raw = normalizeRefAudioBase64(b64);
  if (raw.length < 16) {
    return { kind: 'unknown', detail: 'trop court' };
  }
  try {
    const slice = raw.slice(0, 96);
    const pad = slice.length % 4 === 0 ? '' : '='.repeat(4 - (slice.length % 4));
    const bin = Buffer.from(slice + pad, 'base64').toString('binary');
    if (bin.length >= 12 && bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WAVE') {
      return { kind: 'wav', detail: 'RIFF/WAVE' };
    }
    if (bin.length >= 3 && bin.slice(0, 3) === 'ID3') {
      return { kind: 'mp3', detail: 'ID3' };
    }
    const b0 = bin.charCodeAt(0);
    const b1 = bin.charCodeAt(1);
    if (b0 === 0xff && (b1 & 0xe0) === 0xe0) {
      return { kind: 'mp3', detail: 'frame sync' };
    }
    if (bin.length >= 8 && bin.slice(4, 8) === 'ftyp') {
      return { kind: 'mp4_m4a', detail: 'ISO/MP4' };
    }
  } catch {
    return { kind: 'unknown', detail: 'décodage base64 impossible' };
  }
  return { kind: 'unknown', detail: 'en-tête non reconnu' };
}
