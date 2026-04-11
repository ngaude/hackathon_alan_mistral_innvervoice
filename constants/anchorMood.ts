/** Live mood scale: 0 = low / sad, 5 = balanced target, 10 = high activation. */
export const ANCHOR_MOOD_MIN = 0;
export const ANCHOR_MOOD_MAX = 10;
export const ANCHOR_MOOD_EQUILIBRIUM = 5;

/** Gradient stops (Alan-aligned: purple → amber → green). */
export const MOOD_COLOR_SAD = '#5B5BD6';
export const MOOD_COLOR_CALM = '#F5A623';
export const MOOD_COLOR_EXCITED = '#3DB07D';

export function clampAnchorMood(n: number): number {
  return Math.min(ANCHOR_MOOD_MAX, Math.max(ANCHOR_MOOD_MIN, Math.round(n)));
}

/** Thumb color by zone. */
export function thumbTintForAnchorMood(value: number): string {
  const v = clampAnchorMood(value);
  if (v <= 3) return MOOD_COLOR_SAD;
  if (v <= 6) return MOOD_COLOR_CALM;
  return MOOD_COLOR_EXCITED;
}

/** Label under the slider (no raw number). */
export function describeAnchorMoodLabel(value: number): string {
  const v = clampAnchorMood(value);
  if (v <= 1) return 'Heavy sadness or emotional emptiness';
  if (v === 2) return 'Melancholic, heavy';
  if (v === 3) return 'Leaning toward sadness';
  if (v === 4) return 'Rather low, melancholic';
  if (v === ANCHOR_MOOD_EQUILIBRIUM) return 'Balanced calm between passions';
  if (v === 6) return 'Near calm, slight lift';
  if (v === 7) return 'Rising energy';
  if (v === 8) return 'Excited, lively activation';
  if (v >= 9) return 'Very activated — strong stress or buzz';
  return 'Calm';
}

/**
 * Phrase for LLM prompts (STT complement).
 * Emphasizes balanced passions at the center of the scale.
 */
export function formatAnchorMoodNudgeForLLM(value: number): string {
  const v = clampAnchorMood(value);
  return [
    `Self-reported mood: ${v}/10 on a scale where 0 = sadness or emotional emptiness,`,
    `5 = balanced calm between passions, 10 = strong excitement or activation.`,
    `The user can adjust this slider anytime; it complements the voice transcript.`,
  ].join(' ');
}
