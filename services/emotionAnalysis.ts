import { formatAnchorMoodNudgeForLLM } from '../constants/anchorMood';
import { EMOTION_ANALYSIS_SYSTEM } from '../constants/prompts';
import { getMistralChatModel } from '../lib/env';
import type { EmotionalState, PrimaryEmotion } from '../types/session';
import { mistralPostJson } from './mistralClient';

const EMOTIONS: PrimaryEmotion[] = [
  'anxiety',
  'sadness',
  'anger',
  'frustration',
  'shame',
  'exhaustion',
  'confusion',
  'neutral',
];

const LEGACY_EMOTION_FR: Record<string, PrimaryEmotion> = {
  anxiété: 'anxiety',
  tristesse: 'sadness',
  colère: 'anger',
  frustration: 'frustration',
  honte: 'shame',
  épuisement: 'exhaustion',
  confusion: 'confusion',
  neutre: 'neutral',
};

function normalizeEmotion(raw: string): PrimaryEmotion {
  const x = raw.toLowerCase().trim();
  if (LEGACY_EMOTION_FR[x]) return LEGACY_EMOTION_FR[x];
  const hit = EMOTIONS.find((e) => e === x);
  if (hit) return hit;
  return 'neutral';
}

const LEGACY_TONE: Partial<Record<string, EmotionalState['tone_suggestion']>> = {
  validant: 'validating',
  socratique: 'socratic',
  'directif-doux': 'gently-directive',
  contemplatif: 'contemplative',
};

function normalizeTone(raw: string | undefined): EmotionalState['tone_suggestion'] {
  if (!raw) return 'validating';
  const x = raw.toLowerCase().trim();
  if (LEGACY_TONE[x]) return LEGACY_TONE[x]!;
  if (
    x === 'validating' ||
    x === 'socratic' ||
    x === 'gently-directive' ||
    x === 'contemplative'
  ) {
    return x;
  }
  return 'validating';
}

interface RawEmotionPayload {
  stress_level?: number;
  primary_emotion?: string;
  likely_trigger?: string;
  tone_suggestion?: string;
}

export async function analyzeEmotion(
  transcript: string,
  opts?: { selfReportedMood0to10?: number }
): Promise<EmotionalState> {
  const userContent =
    opts?.selfReportedMood0to10 !== undefined
      ? `Slider context (complement to speech):\n${formatAnchorMoodNudgeForLLM(opts.selfReportedMood0to10)}\n\nTranscript:\n${transcript}`
      : transcript;
  const content = await mistralPostJson<{
    choices: { message: { content: string } }[];
  }>('/chat/completions', {
    model: getMistralChatModel(),
    messages: [
      { role: 'system', content: EMOTION_ANALYSIS_SYSTEM },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const rawText = content.choices[0]?.message?.content;
  if (!rawText) throw new Error('Empty emotion response');
  const parsed = JSON.parse(rawText) as RawEmotionPayload;
  const stress = Math.min(10, Math.max(0, Number(parsed.stress_level) || 5));

  return {
    stress_level: stress,
    primary_emotion: normalizeEmotion(String(parsed.primary_emotion ?? 'neutral')),
    likely_trigger: String(parsed.likely_trigger ?? '').slice(0, 120),
    tone_suggestion: normalizeTone(parsed.tone_suggestion),
  };
}
