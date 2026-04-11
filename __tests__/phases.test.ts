import { nextPhase, PHASE_ORDER } from '../constants/phases';

describe('phases', () => {
  it('orders seven phases', () => {
    expect(PHASE_ORDER).toHaveLength(7);
    expect(PHASE_ORDER[0]).toBe('ONBOARDING');
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('CLOSING');
  });

  it('nextPhase advances', () => {
    expect(nextPhase('ONBOARDING')).toBe('ANCHORING');
    expect(nextPhase('CLOSING')).toBeNull();
  });
});
