const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicide\b/i,
  /\bkill myself\b/i,
  /\bwant to die\b/i,
  /\bend it all\b/i,
  /\bme suicider\b/i,
  /\benvie de mourir\b/i,
  /\bfinir avec tout\b/i,
  /\bme tuer\b/i,
  /\bme faire du mal\b/i,
  /\bhomicide\b/i,
  /\bbattu[e]?\s+sévèrement\b/i,
];

const EMERGENCY_EN =
  'If you are in immediate danger, call your local emergency number. In the US: call or text 988 (Suicide & Crisis Lifeline). In France: 3114 (24/7). In the EU: 112.';

export function detectCrisis(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CRISIS_PATTERNS.some((re) => re.test(t));
}

export function crisisUserMessage(): string {
  return EMERGENCY_EN;
}

const NEGATIVE_SELF_PATTERNS: RegExp[] = [
  /\bje\s+suis\s+nul(le)?\b/i,
  /\bje\s+mérite\s+de\s+mourir\b/i,
  /\bje\s+vais\s+me\s+tuer\b/i,
  /\bi\s*'?\s*m\s+worthless\b/i,
  /\bi\s+deserve\s+to\s+die\b/i,
];

export function looksLikeSelfHarmInnervoice(text: string): boolean {
  return NEGATIVE_SELF_PATTERNS.some((re) => re.test(text));
}
