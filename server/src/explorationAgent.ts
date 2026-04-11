import { EXPLORATION_FOLLOWUP_SYSTEM, EXPLORATION_OPENING_SYSTEM } from './prompts.js';
import { MISTRAL_CHAT_MODEL } from './voiceParams.js';
import { sanitizeSpokenText } from './sanitizeSpokenText.js';
import type { EmotionalState } from './sessionTypes.js';
import { mistralPostJson } from './mistralClient.js';

function moodLine(mood?: number): string {
  if (mood === undefined) return '';
  return `\nMood slider (0–10, 5 = balance): ${mood}/10.`;
}

export async function generateExplorationOpening(params: {
  anchorTranscript: string;
  emotional: EmotionalState;
  selfReportedMood0to10?: number;
}): Promise<string> {
  const { anchorTranscript, emotional, selfReportedMood0to10 } = params;
  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: MISTRAL_CHAT_MODEL,
    messages: [
      { role: 'system', content: EXPLORATION_OPENING_SYSTEM },
      {
        role: 'user',
        content: `Anchoring (first share): ${anchorTranscript}
Detected emotion (hint): ${emotional.primary_emotion}, stress ${emotional.stress_level}/10.${moodLine(selfReportedMood0to10)}
Produce a single exploration opening message (see system instructions).`,
      },
    ],
    temperature: 0.55,
  });
  const raw = content.choices[0]?.message?.content?.trim();
  const text = raw ? sanitizeSpokenText(raw) : '';
  return (
    text ||
    "We hear what we’re carrying. Let’s stay with it gently — what feels heaviest in this for us right now?"
  );
}

/** One follow-up message after the exploration opening (Sharing demo uses a single step). */
export async function generateExplorationFollowUp(params: {
  step: 1 | 2;
  sessionSummary: string;
  lastUserMessage: string;
  emotional: EmotionalState;
  selfReportedMood0to10?: number;
}): Promise<string> {
  const { step, sessionSummary, lastUserMessage, emotional, selfReportedMood0to10 } = params;
  const stepHint =
    step === 1
      ? 'Single follow-up turn: weave emotion + sharpest thought in plain language; end with at most one question OR one gentle reframe — 2 short sentences max total.'
      : 'Single follow-up turn: gentle reappraisal (fact vs interpretation); one question max; 2 short sentences max.';

  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: MISTRAL_CHAT_MODEL,
    messages: [
      { role: 'system', content: EXPLORATION_FOLLOWUP_SYSTEM },
      {
        role: 'user',
        content: `${stepHint}
Exchange summary: ${sessionSummary || '—'}
Latest “we” message: ${lastUserMessage}
Anchor emotion: ${emotional.primary_emotion}.${moodLine(selfReportedMood0to10)}`,
      },
    ],
    temperature: 0.55,
  });
  const raw = content.choices[0]?.message?.content?.trim();
  const text = raw ? sanitizeSpokenText(raw) : '';
  return (
    text ||
    "What we said matters. What feels most true underneath it — the feeling or the story we’re telling ourselves?"
  );
}
