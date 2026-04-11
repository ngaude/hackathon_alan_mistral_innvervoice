import type { ConversationTurn } from './sessionTypes.js';

export function buildSummaryFromTurns(turns: ConversationTurn[]): string {
  return turns
    .filter((t) => t.role === 'user')
    .map((t) => t.text.trim())
    .filter(Boolean)
    .join(' ');
}
