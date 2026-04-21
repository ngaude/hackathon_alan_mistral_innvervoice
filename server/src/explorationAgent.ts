import { EXPLORATION_FOLLOWUP_SYSTEM, EXPLORATION_OPENING_SYSTEM } from './prompts.js';
import { getMistralChatModel } from './voiceParams.js';
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
    model: getMistralChatModel(),
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
    "Here, we're one presence reflecting together. We can move step by step, as we, with gentleness. Shall we continue this way?"
  );
}

/** Step 1 or 2 after opening: deepen along CBT columns (without naming the technique). */
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
      ? 'Step: clarify the emotion and the automatic thought that goes with it (one thread is enough). One main question.'
      : 'Step: gentle reappraisal — fact versus interpretation; a kinder angle. One main question.';

  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: getMistralChatModel(),
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
    "We can look at what we said and what feels factual. What seems most solid to us here?"
  );
}
