/** Mirrors `constants/anchorMood.ts` (same logic for server prompts). */

function clampAnchorMood(n: number): number {
  return Math.min(10, Math.max(0, Math.round(n)));
}

export function formatAnchorMoodNudgeForLLM(value: number): string {
  const v = clampAnchorMood(value);
  return [
    `Self-reported mood: ${v}/10 on a scale where 0 = sadness or emotional emptiness,`,
    `5 = balanced calm between passions, 10 = strong excitement or activation.`,
    `The user can adjust this slider anytime; it complements the voice transcript.`,
  ].join(' ');
}
