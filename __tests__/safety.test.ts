import { crisisUserMessage, detectCrisis } from '../services/safety';

describe('detectCrisis', () => {
  it('returns false for neutral text', () => {
    expect(detectCrisis('I feel tired tonight')).toBe(false);
  });

  it('detects suicide-related phrasing', () => {
    expect(detectCrisis('I want to kill myself')).toBe(true);
    expect(detectCrisis("J'ai envie de me suicider")).toBe(true);
    expect(detectCrisis('thinking about suicide')).toBe(true);
  });
});

describe('crisisUserMessage', () => {
  it('mentions crisis resources', () => {
    expect(crisisUserMessage()).toMatch(/988|3114|112/);
  });
});
