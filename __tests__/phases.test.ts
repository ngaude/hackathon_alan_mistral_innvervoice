import { nextPhase, PHASE_ORDER } from '../constants/phases';

describe('phases', () => {
  it('orders six phases', () => {
    expect(PHASE_ORDER).toHaveLength(6);
    expect(PHASE_ORDER[0]).toBe('ONBOARDING');
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('CLOSING');
  });

  it('nextPhase advances', () => {
    expect(nextPhase('ONBOARDING')).toBe('SHARING');
    expect(nextPhase('CLOSING')).toBeNull();
  });
});
