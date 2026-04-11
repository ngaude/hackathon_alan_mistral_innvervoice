import { clampAnchorMood } from '../constants/anchorMood';
import { COGNITIVE_DISTORTION_LABELS } from '../constants/cognitiveDistortions';

/**
 * One readable line for the closing screen (avoids score lists).
 * Optional: distortion hints (cues, not a diagnosis).
 */
export function formatClosingRestitution(
  summary: string,
  opts?: { cognitiveDistortions?: string[]; sessionNote?: string }
): string {
  const t = summary.replace(/\s+/g, ' ').trim();
  const base =
    !t.length
      ? 'Thank you for this moment. Take time to note what touched you.'
      : (() => {
          const oneSentence = t.match(/^[^.!?]+[.!?]/);
          if (oneSentence) {
            const s = oneSentence[0].trim();
            if (s.length <= 280) return s;
          }
          if (t.length <= 280) return t;
          return `${t.slice(0, 277).trim()}…`;
        })();

  const extra: string[] = [];
  const ids = opts?.cognitiveDistortions?.filter(Boolean) ?? [];
  if (ids.length) {
    const labels = ids.map((id) => COGNITIVE_DISTORTION_LABELS[id] ?? id).join(' · ');
    extra.push(`Interpretation cues noted: ${labels}.`);
  }
  if (opts?.sessionNote?.trim()) {
    extra.push(opts.sessionNote.trim());
  }
  if (!extra.length) return base;
  return `${base}\n\n${extra.join('\n')}`;
}

/** Kind line on mood movement (no raw numbers). */
export function formatMoodMovementLine(beforeRaw: number, afterRaw: number): string {
  const before = clampAnchorMood(beforeRaw);
  const after = clampAnchorMood(afterRaw);
  const delta = after - before;
  if (delta === 0) {
    return 'Between the start and end of the session, your mood seems to sit in a similar zone — neither good nor bad.';
  }
  if (delta > 0) {
    return 'Your mood seems a little lighter or more alive — welcome that shift without judging it.';
  }
  return 'Your mood seems a bit heavier or quieter — that is information, not a verdict.';
}
