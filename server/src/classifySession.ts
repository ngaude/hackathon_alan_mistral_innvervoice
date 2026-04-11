import {
  COGNITIVE_DISTORTION_IDS,
  type CognitiveDistortionId,
  normalizeDistortionId,
} from './cognitiveDistortions.js';
import { MISTRAL_CHAT_MODEL } from './voiceParams.js';
import { mistralPostJson } from './mistralClient.js';

export interface BeckTriangleHint {
  self?: string;
  world?: string;
  future?: string;
}

export interface DistortionClassification {
  distortions: CognitiveDistortionId[];
  beck_triangle: BeckTriangleHint;
  /** Short neutral phrase for synthesis (not a diagnosis). */
  session_note?: string;
}

interface RawPayload {
  distortions?: string[];
  beck_triangle?: { self?: string; world?: string; future?: string };
  session_note?: string;
}

const CLASSIFIER_SYSTEM = `You are an assistant trained to spot wording that may match interpretation biases (CBT-style), from a transcribed voice journal.
You do not make a clinical diagnosis. You classify possible formulations, not a person.

Reply with ONLY valid JSON in exactly this shape:
{
  "distortions": [ ... ],
  "beck_triangle": { "self": "...", "world": "...", "future": "..." },
  "session_note": "..."
}

Rules for "distortions": array of 0 to 4 strings from EXACTLY this list (ids):
${COGNITIVE_DISTORTION_IDS.map((id) => `"${id}"`).join(', ')}

Choose only what is plausible from the text; zero is fine.
For "beck_triangle": optional keys self, world, future — each a short paraphrase (max 18 words) of possible negative views of self, world, or future IF suggested by the text; otherwise empty string or omit key.
"session_note": one short factual phrase in English for a user-facing summary (no forced “you”, no judgment).`;

export async function classifyCognitiveSession(transcript: string): Promise<DistortionClassification> {
  const trimmed = transcript.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return { distortions: [], beck_triangle: {} };
  }

  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: MISTRAL_CHAT_MODEL,
    messages: [
      { role: 'system', content: CLASSIFIER_SYSTEM },
      { role: 'user', content: `Text to analyze:\n${trimmed.slice(0, 8000)}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const rawText = content.choices[0]?.message?.content;
  if (!rawText) {
    return { distortions: [], beck_triangle: {} };
  }

  let parsed: RawPayload;
  try {
    parsed = JSON.parse(rawText) as RawPayload;
  } catch {
    return { distortions: [], beck_triangle: {} };
  }

  const seen = new Set<CognitiveDistortionId>();
  for (const x of parsed.distortions ?? []) {
    const id = normalizeDistortionId(String(x));
    if (id && !seen.has(id)) seen.add(id);
  }

  const beck = parsed.beck_triangle ?? {};
  const beck_triangle: BeckTriangleHint = {
    self: typeof beck.self === 'string' ? beck.self.slice(0, 200) : undefined,
    world: typeof beck.world === 'string' ? beck.world.slice(0, 200) : undefined,
    future: typeof beck.future === 'string' ? beck.future.slice(0, 200) : undefined,
  };

  return {
    distortions: [...seen],
    beck_triangle,
    session_note: typeof parsed.session_note === 'string' ? parsed.session_note.slice(0, 400) : undefined,
  };
}
