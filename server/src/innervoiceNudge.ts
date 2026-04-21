import { innervoiceNudgePrompt } from './prompts.js';
import { getMistralChatModel } from './voiceParams.js';
import { sanitizeSpokenText } from './sanitizeSpokenText.js';
import { COGNITIVE_DISTORTION_LABELS, type CognitiveDistortionId } from './cognitiveDistortions.js';
import { mistralPostJson } from './mistralClient.js';

export const INNERVOICE_NUDGE_TEXT =
  "What I'm living matters. I can hear myself speak to myself in my own voice, in the first person, with kindness.";

export async function generateInnervoiceNudgeText(params: {
  summaryHint: string;
  primaryDistortion: CognitiveDistortionId | null;
}): Promise<string> {
  const label = params.primaryDistortion
    ? COGNITIVE_DISTORTION_LABELS[params.primaryDistortion]
    : null;
  try {
    const content = await mistralPostJson<{
      choices: { message: { content: string } }[];
    }>('/chat/completions', {
      model: getMistralChatModel(),
      messages: [{ role: 'user', content: innervoiceNudgePrompt(label, params.summaryHint) }],
      temperature: 0.45,
    });
    const raw = content.choices[0]?.message?.content?.trim();
    const text = raw ? sanitizeSpokenText(raw) : '';
    const oneLine = text.replace(/\n+/g, ' ').trim();
    if (oneLine.length >= 12 && oneLine.length < 420) return oneLine;
  } catch {
    /* fallback */
  }
  return INNERVOICE_NUDGE_TEXT;
}
