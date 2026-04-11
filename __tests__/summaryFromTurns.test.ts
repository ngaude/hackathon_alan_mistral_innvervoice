import { buildSummaryFromTurns } from '../services/summaryFromTurns';
import type { ConversationTurn } from '../types/session';

describe('buildSummaryFromTurns', () => {
  it('joins user messages', () => {
    const turns: ConversationTurn[] = [
      {
        id: '1',
        role: 'user',
        text: 'Premier',
        phase: 'EXPLORATION',
        voiceMode: 'AGENT',
        createdAt: 1,
      },
      {
        id: '2',
        role: 'agent',
        text: 'Réponse',
        phase: 'EXPLORATION',
        voiceMode: 'AGENT',
        createdAt: 2,
      },
      {
        id: '3',
        role: 'user',
        text: 'Deuxième',
        phase: 'EXPLORATION',
        voiceMode: 'AGENT',
        createdAt: 3,
      },
    ];
    expect(buildSummaryFromTurns(turns)).toBe('Premier Deuxième');
  });
});
