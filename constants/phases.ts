import type { Phase } from '../types/session';

export const PHASE_ORDER: Phase[] = [
  'ONBOARDING',
  'ANCHORING',
  'EXPLORATION',
  'ANALYSIS',
  'INNERVOICE',
  'FEEDBACK',
  'CLOSING',
];

export const PHASE_LABELS: Record<Phase, string> = {
  ONBOARDING: 'Voice welcome',
  ANCHORING: 'Anchoring',
  EXPLORATION: 'Exploration',
  ANALYSIS: 'Construction',
  INNERVOICE: 'InnerVoice replay',
  FEEDBACK: 'Feedback',
  CLOSING: 'Closing',
};

export function nextPhase(current: Phase): Phase | null {
  const i = PHASE_ORDER.indexOf(current);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1] ?? null;
}
