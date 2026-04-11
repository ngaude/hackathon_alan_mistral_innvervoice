import { innervoiceReplayPrompt } from '../constants/prompts';
import { MISTRAL_CHAT_MODEL } from '../constants/voiceParams';
import { sanitizeSpokenText } from '../lib/sanitizeSpokenText';
import type { EmotionalState, InnervoiceScript, SessionContext } from '../types/session';
import { validateInnervoiceScript } from './innervoiceValidation';
import { mistralPostJson } from './mistralClient';

interface RawInnervoice {
  validation?: string;
  reframing?: string;
  intention?: string;
}

export async function generateInnervoiceScript(
  ctx: SessionContext,
  emotional: EmotionalState
): Promise<InnervoiceScript> {
  const prompt = innervoiceReplayPrompt(ctx.summary, emotional.primary_emotion);
  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: MISTRAL_CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const rawText = content.choices[0]?.message?.content;
  if (!rawText) throw new Error('Rejeu InnerVoice vide');
  const parsed = JSON.parse(rawText) as RawInnervoice;
  const script: InnervoiceScript = {
    validation: sanitizeSpokenText(String(parsed.validation ?? '')),
    reframing: sanitizeSpokenText(String(parsed.reframing ?? '')),
    intention: sanitizeSpokenText(String(parsed.intention ?? '')),
  };
  validateInnervoiceScript(script);
  return script;
}
