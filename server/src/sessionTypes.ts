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
  /** Optional 0–10 mood slider synced from client. */
  anchorMoodLive?: number;
  /** Classifier distortion ids (canonical list). */
  cognitiveDistortions?: string[];
  /** Beck triangle hints (short paraphrases). */
  beckTriangle?: { self?: string; world?: string; future?: string };
  /** Short note for synthesis / closing. */
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

/** Scores 1–10 + optional triangle weights (newer sessions). */
export interface FeedbackAxes {
  tension: number;
  clarity: number;
  energy: number;
  emotion?: EmotionTriangleWeights;
}

export interface SessionSnapshot {
  phase: Phase;
  voiceMode: VoiceMode;
  voiceProfileBase64: string | null;
  userMistralVoiceId: string | null;
  emotionalState: EmotionalState | null;
  sessionContext: SessionContext;
  consentInnervoice: boolean;
  anchorMood: number | null;
  feedbackBefore: FeedbackAxes | null;
  feedbackAfter: FeedbackAxes | null;
  turns: ConversationTurn[];
  crisisTriggered: boolean;
  analysisAgentText: string;
  innervoiceScript: InnervoiceScript | null;
}
