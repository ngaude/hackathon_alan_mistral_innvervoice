export type Phase =
  | 'ONBOARDING'
  | 'SHARING'
  | 'ANALYSIS'
  | 'INNERVOICE'
  | 'FEEDBACK'
  | 'CLOSING';

export type VoiceMode = 'AGENT' | 'INNERVOICE';

export type PrimaryEmotion =
  | 'anxiety'
  | 'sadness'
  | 'anger'
  | 'frustration'
  | 'shame'
  | 'exhaustion'
  | 'confusion'
  | 'neutral';

export interface EmotionalState {
  stress_level: number;
  primary_emotion: PrimaryEmotion;
  likely_trigger: string;
  tone_suggestion: 'validating' | 'socratic' | 'gently-directive' | 'contemplative';
}

export interface SessionContext {
  summary: string;
  themes: string[];
  /** User messages in exploration after the opening agent message. */
  explorationTurns: number;
  /**
   * Live mood 0–10 (slider): complements STT; adjustable anytime.
   * 0 = low / sad, 5 = balanced calm, 10 = high activation.
   */
  anchorMoodLive?: number;
  cognitiveDistortions?: string[];
  beckTriangle?: { self?: string; world?: string; future?: string };
  sessionNote?: string;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'agent';
  text: string;
  phase: Phase;
  voiceMode: VoiceMode;
  createdAt: number;
}

export interface InnervoiceScript {
  validation: string;
  reframing: string;
  intention: string;
}

export interface EmotionTriangleWeights {
  wRepli: number;
  wDispersion: number;
  wTension: number;
}

/** State returned by the `server/` backend (store hydration). */
export interface SessionSnapshot {
  phase: Phase;
  voiceMode: VoiceMode;
  voiceProfileBase64: string | null;
  userMistralVoiceId: string | null;
  emotionalState: EmotionalState | null;
  sessionContext: SessionContext;
  consentInnervoice: boolean;
  anchorMood: number | null;
  feedbackBefore: {
    tension: number;
    clarity: number;
    energy: number;
    emotion?: EmotionTriangleWeights;
  } | null;
  feedbackAfter: {
    tension: number;
    clarity: number;
    energy: number;
    emotion?: EmotionTriangleWeights;
  } | null;
  turns: ConversationTurn[];
  crisisTriggered: boolean;
  analysisAgentText: string;
  innervoiceScript: InnervoiceScript | null;
}
