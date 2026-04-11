import { INNERVOICE_PAUSE_MS_BETWEEN_SEGMENTS } from '../constants/voiceParams';
import type { InnervoiceScript } from '../types/session';
import { playMp3Base64 } from './audioPlayer';
import { synthesizeInnervoiceUserTts, type InnervoiceUserTtsInput } from './mistralSpeech';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Enchaîne les 3 temps avec pause (README §4). */
export async function playInnervoiceScript(
  script: InnervoiceScript,
  voice: InnervoiceUserTtsInput,
  onSegment?: (index: 0 | 1 | 2, label: string) => void
): Promise<void> {
  const segments: { key: keyof InnervoiceScript; label: string }[] = [
    { key: 'validation', label: 'Validation' },
    { key: 'reframing', label: 'Recadrage' },
    { key: 'intention', label: 'Intention' },
  ];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = script[seg.key];
    onSegment?.(i as 0 | 1 | 2, seg.label);
    const audio = await synthesizeInnervoiceUserTts(text, voice);
    await playMp3Base64(audio);
    if (i < segments.length - 1) {
      await delay(INNERVOICE_PAUSE_MS_BETWEEN_SEGMENTS);
    }
  }
}
