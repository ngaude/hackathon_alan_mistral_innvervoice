import { AGENT_VOICE_VOLUME } from '../constants/audioPlayback';
import { INNERVOICE_PAUSE_MS_BETWEEN_SEGMENTS } from '../constants/voiceParams';
import { playMp3Base64 } from '../services/audioPlayer';

interface ServerAudioPart {
  base64: string;
  spokenText?: string;
  kind?: 'user' | 'agent' | 'innervoice';
}

/**
 * Séquence renvoyée par le serveur : enchaîne les MP3.
 * Cas 4 pistes : rejeu InnerVoice (3 segments + transition) — pause seulement après les 2 premières.
 */
export async function playServerAudioParts(
  parts: ServerAudioPart[] | string[],
  onCaption?: (text: string | null, index: number) => void
): Promise<void> {
  const normalized: ServerAudioPart[] = parts.map((p) =>
    typeof p === 'string' ? { base64: p } : p
  );
  const n = normalized.length;
  const innervoiceFour = n === 4;
  for (let i = 0; i < n; i++) {
    const seg = normalized[i]!;
    onCaption?.(seg.spokenText ?? null, i);
    const vol = seg.kind === 'agent' ? AGENT_VOICE_VOLUME : 1;
    await playMp3Base64(seg.base64, { volume: vol });
    if (innervoiceFour && (i === 0 || i === 1)) {
      await new Promise<void>((r) => setTimeout(r, INNERVOICE_PAUSE_MS_BETWEEN_SEGMENTS));
    }
  }
  onCaption?.(null, n);
}
