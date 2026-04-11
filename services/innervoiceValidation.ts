import { looksLikeSelfHarmInnervoice } from './safety';

/** InnerVoice: first-person monologue, no questions (README §4) */
export function assertInnervoiceScriptPart(text: string, label: string): void {
  const t = text.trim();
  if (!t) throw new Error(`InnerVoice ${label}: empty text`);
  if (t.includes('?')) {
    throw new Error(`InnerVoice ${label}: questions are not allowed in InnerVoice mode`);
  }
  if (/\b(you|your|yours|yourself)\b/i.test(t) || /\b(vous|tu|ton|ta|tes|toi)\b/i.test(t)) {
    throw new Error(`InnerVoice ${label}: use first person only (I)`);
  }
  if (looksLikeSelfHarmInnervoice(t)) {
    throw new Error(`InnerVoice ${label}: unsafe wording — regenerate with self-compassion`);
  }
}

export function validateInnervoiceScript(parts: {
  validation: string;
  reframing: string;
  intention: string;
}): void {
  assertInnervoiceScriptPart(parts.validation, 'validation');
  assertInnervoiceScriptPart(parts.reframing, 'reframing');
  assertInnervoiceScriptPart(parts.intention, 'intention');
}
