import { AGENT_REPLY_SYSTEM } from './prompts.js';
import { MISTRAL_CHAT_MODEL } from './voiceParams.js';
import { sanitizeSpokenText } from './sanitizeSpokenText.js';
import type { Phase } from './sessionTypes.js';
import { mistralPostJson } from './mistralClient.js';

export async function generateAgentReply(params: {
  phase: Phase;
  userMessage: string;
  sessionSummary: string;
  brief?: boolean;
  selfReportedMood0to10?: number;
}): Promise<string> {
  const { phase, userMessage, sessionSummary, brief, selfReportedMood0to10 } = params;
  const system = brief
    ? `${AGENT_REPLY_SYSTEM}\n\nReply in 2–4 sentences max. Be concise: mirror the experience, open the problem frame, transition toward replay in your voice (InnerVoice).`
    : AGENT_REPLY_SYSTEM;
  const moodLine =
    selfReportedMood0to10 !== undefined
      ? `\nLive mood hint (0–10, 5 = balance): ${selfReportedMood0to10}/10.`
      : '';
  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: MISTRAL_CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Phase: ${phase}. Session summary: ${sessionSummary || '—'}\nUser message: ${userMessage}${moodLine}`,
      },
    ],
    temperature: 0.6,
  });
  const raw = content.choices[0]?.message?.content?.trim();
  const text = raw ? sanitizeSpokenText(raw) : '';
  return (
    text ||
    "I'm here with you. What matters most for you right now?"
  );
}
