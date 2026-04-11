import {
  assertInnervoiceScriptPart,
  validateInnervoiceScript,
} from '../services/innervoiceValidation';

describe('assertInnervoiceScriptPart', () => {
  it('accepts first-person calm text', () => {
    expect(() =>
      assertInnervoiceScriptPart('I went through something difficult today.', 'test')
    ).not.toThrow();
  });

  it('rejects questions', () => {
    expect(() => assertInnervoiceScriptPart('What should I do?', 'test')).toThrow(/questions/);
  });

  it('rejects second person', () => {
    expect(() => assertInnervoiceScriptPart('You deserve rest.', 'test')).toThrow(/first person/);
  });
});

describe('validateInnervoiceScript', () => {
  it('validates three-part script', () => {
    expect(() =>
      validateInnervoiceScript({
        validation: 'I felt something real.',
        reframing: 'I can move through this.',
        intention: 'I choose to rest tonight.',
      })
    ).not.toThrow();
  });
});
