/** Estimation de timings mots pour sous-titres (sans API native timestamps). */
interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export function estimateWordTimings(text: string, durationMs: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const total = Math.max(800, durationMs);
  const per = total / words.length;
  return words.map((word, i) => ({
    word,
    startMs: Math.round(i * per),
    endMs: Math.round((i + 1) * per),
  }));
}

/** Durée heuristique à partir de la taille MP3 base64 (~128 kbps) et longueur du texte. */
export function estimateDurationMsFromMp3Base64(b64: string, text: string): number {
  const raw = b64.replace(/\s/g, '');
  const byteLen = Math.floor((raw.length * 3) / 4);
  const fromBytes = (byteLen * 8) / 128000;
  const sec = Math.max(0.8, Math.min(120, fromBytes || 2));
  const fromText = (text.split(/\s+/).filter(Boolean).length / 2.8) * 1000;
  return Math.round(Math.max(sec * 1000, fromText, 1200));
}
