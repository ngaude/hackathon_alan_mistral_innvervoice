import { innervoiceReplayPrompt } from './prompts.js';
import { getMistralChatModel } from './voiceParams.js';
import { sanitizeSpokenText } from './sanitizeSpokenText.js';
import type { EmotionalState, InnervoiceScript, SessionContext } from './sessionTypes.js';
import { validateInnervoiceScript } from './innervoiceValidation.js';
import { mistralPostJson } from './mistralClient.js';

interface RawInnervoice {
  validation?: string;
  reframing?: string;
  intention?: string;
}

export async function generateInnervoiceScript(
  ctx: SessionContext,
  emotional: EmotionalState
): Promise<InnervoiceScript> {
  const prompt = innervoiceReplayPrompt(ctx.summary, emotional.primary_emotion, {
    cognitiveDistortions: ctx.cognitiveDistortions,
    beck: ctx.beckTriangle,
  });
  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: getMistralChatModel(),
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const rawText = content.choices[0]?.message?.content;
  if (!rawText) throw new Error('Empty InnerVoice replay');
  const parsed = JSON.parse(rawText) as RawInnervoice;
  const script: InnervoiceScript = {
    validation: sanitizeSpokenText(String(parsed.validation ?? '')),
    reframing: sanitizeSpokenText(String(parsed.reframing ?? '')),
    intention: sanitizeSpokenText(String(parsed.intention ?? '')),
  };
  validateInnervoiceScript(script);
  return script;
}
