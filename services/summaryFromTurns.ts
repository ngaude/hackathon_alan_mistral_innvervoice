import type { ConversationTurn } from '../types/session';

export function buildSummaryFromTurns(turns: ConversationTurn[]): string {
  return turns
    .filter((t) => t.role === 'user')
    .map((t) => t.text.trim())
    .filter(Boolean)
    .join(' ');
}
