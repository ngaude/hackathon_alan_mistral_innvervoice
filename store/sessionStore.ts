import { create } from 'zustand';

import type {
  ConversationTurn,
  EmotionalState,
  EmotionTriangleWeights,
  InnervoiceScript,
  Phase,
  SessionContext,
  VoiceMode,
} from '../types/session';

interface FeedbackAxes {
  tension: number;
  clarity: number;
  energy: number;
  emotion?: EmotionTriangleWeights;
}

interface SessionState {
  phase: Phase;
  voiceMode: VoiceMode;
  voiceProfileBase64: string | null;
  /** Mistral voice from POST /audio/voices (reusable clone). */
  userMistralVoiceId: string | null;
  onboardingDone: boolean;
  emotionalState: EmotionalState | null;
  sessionContext: SessionContext;
  innervoiceScript: InnervoiceScript | null;
  consentInnervoice: boolean;
  anchorMood: number | null;
  feedbackBefore: FeedbackAxes | null;
  feedbackAfter: FeedbackAxes | null;
  turns: ConversationTurn[];
  crisisTriggered: boolean;
  isLoading: boolean;
  lastError: string | null;
  innervoicePlayingSegment: number | null;
  /** Short ANALYSIS phase reply (problem framing). */
  analysisAgentText: string;
  /** Session API backend (`lib/innervoiceApi`) — null si mode local. */
  remoteSessionId: string | null;
  voiceGateCompleted: boolean;
}

interface SessionActions {
  resetSession: () => void;
  setPhase: (p: Phase) => void;
  setVoiceMode: (m: VoiceMode) => void;
  setVoiceProfile: (b64: string | null) => void;
  setUserMistralVoiceId: (id: string | null) => void;
  setOnboardingDone: (v: boolean) => void;
  setEmotionalState: (e: EmotionalState | null) => void;
  patchSessionContext: (p: Partial<SessionContext>) => void;
  setInnervoiceScript: (s: InnervoiceScript | null) => void;
  setConsentInnervoice: (v: boolean) => void;
  setAnchorMood: (n: number | null) => void;
  setFeedbackBefore: (f: FeedbackAxes | null) => void;
  setFeedbackAfter: (f: FeedbackAxes | null) => void;
  addTurn: (t: Omit<ConversationTurn, 'id' | 'createdAt'>) => void;
  setCrisis: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setInnervoiceSegment: (idx: number | null) => void;
  setAnalysisAgentText: (t: string) => void;
  setRemoteSessionId: (id: string | null) => void;
  hydrateFromServer: (partial: Partial<SessionState>) => void;
  setVoiceGateCompleted: (v: boolean) => void;
}

const emptyContext = (): SessionContext => ({
  summary: '',
  themes: [],
  explorationTurns: 0,
});

const initial = (): SessionState => ({
  phase: 'ONBOARDING',
  voiceMode: 'AGENT',
  voiceProfileBase64: null,
  userMistralVoiceId: null,
  onboardingDone: false,
  emotionalState: null,
  sessionContext: emptyContext(),
  innervoiceScript: null,
  consentInnervoice: false,
  anchorMood: null,
  feedbackBefore: null,
  feedbackAfter: null,
  turns: [],
  crisisTriggered: false,
  isLoading: false,
  lastError: null,
  innervoicePlayingSegment: null,
  analysisAgentText: '',
  remoteSessionId: null,
  /** Backend : choix voix (réutiliser / refaire / neutre) validé. */
  voiceGateCompleted: false,
});

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  ...initial(),
  resetSession: () => set(initial()),
  setVoiceGateCompleted: (voiceGateCompleted) => set({ voiceGateCompleted }),
  setPhase: (phase) => set({ phase }),
  setVoiceMode: (voiceMode) => set({ voiceMode }),
  setVoiceProfile: (voiceProfileBase64) => set({ voiceProfileBase64 }),
  setUserMistralVoiceId: (userMistralVoiceId) => set({ userMistralVoiceId }),
  setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
  setEmotionalState: (emotionalState) => set({ emotionalState }),
  patchSessionContext: (p) =>
    set((s) => ({ sessionContext: { ...s.sessionContext, ...p } })),
  setInnervoiceScript: (innervoiceScript) => set({ innervoiceScript }),
  setConsentInnervoice: (consentInnervoice) => set({ consentInnervoice }),
  setAnchorMood: (anchorMood) => set({ anchorMood }),
  setFeedbackBefore: (feedbackBefore) => set({ feedbackBefore }),
  setFeedbackAfter: (feedbackAfter) => set({ feedbackAfter }),
  addTurn: (t) =>
    set((s) => ({
      turns: [
        ...s.turns,
        {
          ...t,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
        },
      ],
    })),
  setCrisis: (crisisTriggered) => set({ crisisTriggered }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (lastError) => set({ lastError }),
  setInnervoiceSegment: (innervoicePlayingSegment) => set({ innervoicePlayingSegment }),
  setAnalysisAgentText: (analysisAgentText) => set({ analysisAgentText }),
  setRemoteSessionId: (remoteSessionId) => set({ remoteSessionId }),
  hydrateFromServer: (partial) =>
    set((s) => ({
      ...s,
      ...partial,
      sessionContext: partial.sessionContext
        ? { ...s.sessionContext, ...partial.sessionContext }
        : s.sessionContext,
      turns: partial.turns ?? s.turns,
    })),
}));
