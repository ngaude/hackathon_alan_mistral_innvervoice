import { randomUUID } from 'node:crypto';

import { classifyCognitiveSession } from './classifySession.js';
import { COGNITIVE_DISTORTION_LABELS } from './cognitiveDistortions.js';
import type { CognitiveDistortionId } from './cognitiveDistortions.js';
import { generateAgentReply } from './agentReply.js';
import { analyzeEmotion } from './emotionAnalysis.js';
import { generateExplorationFollowUp, generateExplorationOpening } from './explorationAgent.js';
import { generateInnervoiceScript } from './innervoiceGeneration.js';
import { generateInnervoiceNudgeText } from './innervoiceNudge.js';
import {
  synthesizeInnervoiceUserTts,
  synthesizeWithAgentVoice,
} from './speechProvider.js';
import {
  approximateTriangleFromLegacy,
  deriveLegacyScoresFromTriangle,
  normalizeWeights,
} from './emotionTriangleModel.js';
import { isPerfLogEnabled } from './env.js';
import { logInfo } from './log.js';
import { crisisUserMessage, detectCrisis } from './safety.js';
import { buildSummaryFromTurns } from './summaryFromTurns.js';
import type { ConversationTurn, FeedbackAxes, InnervoiceScript, Phase, SessionSnapshot, VoiceMode } from './sessionTypes.js';

function perfMs(event: string, step: string, start: number): void {
  if (!isPerfLogEnabled()) return;
  logInfo('perf', { event, step, ms: Math.round(performance.now() - start) });
}

export interface AudioPart {
  label: string;
  base64: string;
  mimeType: 'audio/mpeg';
  /** Texte lu (sous-titres / timeline). */
  spokenText?: string;
  kind?: 'user' | 'agent' | 'innervoice';
}

const MAX_EXPLORATION_USER_TURNS = 3;

export type ClientEvent =
  | { type: 'ANCHOR_SUBMIT'; mood: number; transcript: string }
  | { type: 'EXPLORATION_MESSAGE'; text: string; mood0to10?: number }
  | { type: 'ANALYSIS_MESSAGE'; text: string; mood0to10?: number }
  | { type: 'START_INNERVOICE'; consent?: boolean }
  | { type: 'COMPLETE_INNERVOICE' }
  | {
      type: 'FEEDBACK_SUBMIT';
      wRepli?: number;
      wDispersion?: number;
      wTension?: number;
      tension?: number;
      clarity?: number;
      energy?: number;
    };

function newTurn(
  role: ConversationTurn['role'],
  text: string,
  phase: Phase,
  voiceMode: VoiceMode
): ConversationTurn {
  return {
    id: randomUUID(),
    createdAt: Date.now(),
    role,
    text,
    phase,
    voiceMode,
  };
}

function emptyContext(): SessionSnapshot['sessionContext'] {
  return { summary: '', themes: [], explorationTurns: 0 };
}

function buildClosingContextLine(state: SessionSnapshot): string {
  const summary = buildSummaryFromTurns(state.turns);
  const parts: string[] = [summary];
  const raw = state.sessionContext.cognitiveDistortions;
  if (raw?.length) {
    const labels = raw
      .map((id) => COGNITIVE_DISTORTION_LABELS[id as CognitiveDistortionId] ?? id)
      .join(', ');
    parts.push(`Distortions noted (hints): ${labels}.`);
  }
  if (state.sessionContext.sessionNote) {
    parts.push(`Note: ${state.sessionContext.sessionNote}`);
  }
  return parts.join('\n');
}

export function createInitialSession(
  voiceProfileBase64: string | null,
  userMistralVoiceId: string | null
): SessionSnapshot {
  return {
    phase: 'ANCHORING',
    voiceMode: 'AGENT',
    voiceProfileBase64,
    userMistralVoiceId,
    emotionalState: null,
    sessionContext: emptyContext(),
    consentInnervoice: false,
    anchorMood: null,
    feedbackBefore: null,
    feedbackAfter: null,
    turns: [],
    crisisTriggered: false,
    analysisAgentText: '',
    innervoiceScript: null,
  };
}

export async function applyEvent(
  state: SessionSnapshot,
  event: ClientEvent
): Promise<{
  state: SessionSnapshot;
  audio: AudioPart[];
  crisisMessage?: string;
}> {
  if (state.crisisTriggered) {
    throw new Error('Session paused after crisis');
  }

  if (event.type === 'ANCHOR_SUBMIT') {
    return handleAnchor(state, event.mood, event.transcript.trim());
  }
  if (event.type === 'EXPLORATION_MESSAGE') {
    return handleExplorationMessage(state, event.text.trim(), event.mood0to10);
  }
  if (event.type === 'ANALYSIS_MESSAGE') {
    return handleAnalysisMessage(state, event.text.trim(), event.mood0to10);
  }
  if (event.type === 'START_INNERVOICE') {
    return handleStartInnervoice(state, event.consent ?? true);
  }
  if (event.type === 'COMPLETE_INNERVOICE') {
    return handleCompleteInnervoice(state);
  }
  if (event.type === 'FEEDBACK_SUBMIT') {
    return handleFeedback(state, event);
  }
  throw new Error('Unknown event');
}

async function handleAnchor(
  state: SessionSnapshot,
  moodRaw: number,
  transcript: string
): Promise<{ state: SessionSnapshot; audio: AudioPart[]; crisisMessage?: string }> {
  if (state.phase !== 'ANCHORING') {
    throw new Error('Invalid phase for ANCHOR_SUBMIT');
  }
  if (!transcript) throw new Error('Empty transcript');

  if (detectCrisis(transcript)) {
    return {
      state: {
        ...state,
        crisisTriggered: true,
        turns: [...state.turns, newTurn('user', transcript, 'ANCHORING', state.voiceMode)],
      },
      audio: [],
      crisisMessage: crisisUserMessage(),
    };
  }

  const mood = Math.min(10, Math.max(0, Math.round(moodRaw)));
  const tAnchor = performance.now();
  let t = tAnchor;
  const emotional = await analyzeEmotion(transcript, { selfReportedMood0to10: mood });
  perfMs('ANCHOR_SUBMIT', 'analyzeEmotion_llm', t);
  t = performance.now();
  const userTurn = newTurn('user', transcript, 'ANCHORING', state.voiceMode);
  let turns = [...state.turns, userTurn];
  const feedbackBefore = {
    tension: Math.max(1, Math.min(10, mood)),
    clarity: 5,
    energy: 5,
  };
  const sessionContext = {
    ...state.sessionContext,
    summary: transcript,
    explorationTurns: 0,
    anchorMoodLive: mood,
    cognitiveDistortions: undefined,
    beckTriangle: undefined,
    sessionNote: undefined,
  };

  const explorationOpen = await generateExplorationOpening({
    anchorTranscript: transcript,
    emotional,
    selfReportedMood0to10: mood,
  });
  perfMs('ANCHOR_SUBMIT', 'exploration_opening_llm', t);
  t = performance.now();

  const openTurn = newTurn('agent', explorationOpen, 'EXPLORATION', 'AGENT');
  turns = [...turns, openTurn];

  const audio: AudioPart[] = [];
  const openB64 = await synthesizeWithAgentVoice(explorationOpen);
  perfMs('ANCHOR_SUBMIT', 'tts_exploration_open', t);
  perfMs('ANCHOR_SUBMIT', 'server_processing_total', tAnchor);
  audio.push({
    label: 'Exploration',
    base64: openB64,
    mimeType: 'audio/mpeg',
    spokenText: explorationOpen,
    kind: 'agent',
  });

  return {
    state: {
      ...state,
      phase: 'EXPLORATION',
      voiceMode: 'AGENT',
      emotionalState: emotional,
      sessionContext,
      anchorMood: mood,
      feedbackBefore,
      analysisAgentText: '',
      turns,
    },
    audio,
  };
}

async function handleExplorationMessage(
  state: SessionSnapshot,
  text: string,
  moodRaw?: number
): Promise<{ state: SessionSnapshot; audio: AudioPart[]; crisisMessage?: string }> {
  if (state.phase !== 'EXPLORATION') {
    throw new Error('Invalid phase for EXPLORATION_MESSAGE');
  }
  if (!text) throw new Error('Empty message');
  if (!state.emotionalState) throw new Error('Missing emotional state');

  if (detectCrisis(text)) {
    return {
      state: {
        ...state,
        crisisTriggered: true,
        turns: [...state.turns, newTurn('user', text, 'EXPLORATION', state.voiceMode)],
      },
      audio: [],
      crisisMessage: crisisUserMessage(),
    };
  }

  const moodNudge =
    moodRaw !== undefined
      ? Math.min(10, Math.max(0, Math.round(moodRaw)))
      : state.sessionContext.anchorMoodLive ?? state.anchorMood ?? undefined;

  const userTurn = newTurn('user', text, 'EXPLORATION', 'AGENT');
  let turns = [...state.turns, userTurn];
  const n = (state.sessionContext.explorationTurns ?? 0) + 1;

  const sessionCtxBase = {
    ...state.sessionContext,
    explorationTurns: n,
    ...(moodNudge !== undefined ? { anchorMoodLive: moodNudge } : {}),
  };

  const summary = buildSummaryFromTurns(turns);

  if (n < MAX_EXPLORATION_USER_TURNS) {
    const t0 = performance.now();
    const reply = await generateExplorationFollowUp({
      step: n === 1 ? 1 : 2,
      sessionSummary: summary,
      lastUserMessage: text,
      emotional: state.emotionalState,
      selfReportedMood0to10: moodNudge,
    });
    perfMs('EXPLORATION_MESSAGE', 'exploration_followup_llm', t0);
    const agentTurn = newTurn('agent', reply, 'EXPLORATION', 'AGENT');
    turns = [...turns, agentTurn];
    const agentB64 = await synthesizeWithAgentVoice(reply);
    return {
      state: {
        ...state,
        sessionContext: { ...sessionCtxBase, summary },
        turns: [...turns],
      },
      audio: [
        {
          label: 'Exploration',
          base64: agentB64,
          mimeType: 'audio/mpeg',
          spokenText: reply,
          kind: 'agent',
        },
      ],
    };
  }

  const tClass = performance.now();
  const classified = await classifyCognitiveSession(summary);
  perfMs('EXPLORATION_MESSAGE', 'classify_distortions_llm', tClass);

  const cognitiveDistortions = classified.distortions.map((x) => String(x));
  const beckTriangle = classified.beck_triangle;
  const sessionNote = classified.session_note;

  const primaryDistortion = (classified.distortions[0] ?? null) as CognitiveDistortionId | null;

  const tNudge = performance.now();
  const nudgeText = await generateInnervoiceNudgeText({
    summaryHint: summary,
    primaryDistortion,
  });
  perfMs('EXPLORATION_MESSAGE', 'nudge_innervoice_llm', tNudge);

  const nudgeTurn = newTurn('agent', nudgeText, 'ANALYSIS', 'INNERVOICE');
  turns = [...turns, nudgeTurn];

  const nudgeB64 = await synthesizeInnervoiceUserTts(nudgeText, {
    userMistralVoiceId: state.userMistralVoiceId,
    voiceProfileBase64: state.voiceProfileBase64,
  });

  const distortionLine = classified.distortions
    .map((id) => COGNITIVE_DISTORTION_LABELS[id] ?? id)
    .join(', ');

  const tAnalysis = performance.now();
  const analysisAgentText = await generateAgentReply({
    phase: 'ANALYSIS',
    userMessage: text,
    sessionSummary: `${summary}\nCues noted (plain language): ${distortionLine || 'no clear bias stood out'}.${sessionNote ? ` Note: ${sessionNote}` : ''}`,
    brief: true,
    selfReportedMood0to10: moodNudge,
  });
  perfMs('EXPLORATION_MESSAGE', 'generateAgentReply_analysis', tAnalysis);

  const agentTurn = newTurn('agent', analysisAgentText, 'ANALYSIS', 'AGENT');
  turns = [...turns, agentTurn];

  const agentB64 = await synthesizeWithAgentVoice(analysisAgentText);

  return {
    state: {
      ...state,
      phase: 'ANALYSIS',
      voiceMode: 'AGENT',
      sessionContext: {
        ...sessionCtxBase,
        summary,
        cognitiveDistortions,
        beckTriangle,
        sessionNote,
      },
      analysisAgentText,
      turns,
    },
    audio: [
      {
        label: 'Nudge InnerVoice',
        base64: nudgeB64,
        mimeType: 'audio/mpeg',
        spokenText: nudgeText,
        kind: 'innervoice',
      },
      {
        label: 'Agent (analysis)',
        base64: agentB64,
        mimeType: 'audio/mpeg',
        spokenText: analysisAgentText,
        kind: 'agent',
      },
    ],
  };
}

async function handleAnalysisMessage(
  state: SessionSnapshot,
  text: string,
  moodRaw?: number
): Promise<{ state: SessionSnapshot; audio: AudioPart[] }> {
  if (state.phase !== 'ANALYSIS') {
    throw new Error('Invalid phase for ANALYSIS_MESSAGE');
  }
  if (!text) throw new Error('Empty message');

  if (detectCrisis(text)) {
    throw new Error('Crisis wording flagged — handle on the client');
  }

  const moodNudge =
    moodRaw !== undefined
      ? Math.min(10, Math.max(0, Math.round(moodRaw)))
      : state.sessionContext.anchorMoodLive ?? state.anchorMood ?? undefined;

  const userTurn = newTurn('user', text, 'ANALYSIS', state.voiceMode);
  const turns = [...state.turns, userTurn];
  const summary = buildSummaryFromTurns(turns);
  const reply = await generateAgentReply({
    phase: 'ANALYSIS',
    userMessage: text,
    sessionSummary: summary,
    brief: false,
    selfReportedMood0to10: moodNudge,
  });
  const agentTurn = newTurn('agent', reply, 'ANALYSIS', 'AGENT');
  const agentB64 = await synthesizeWithAgentVoice(reply);

  const nextCtx =
    moodRaw !== undefined
      ? { ...state.sessionContext, anchorMoodLive: moodNudge }
      : state.sessionContext;

  return {
    state: {
      ...state,
      sessionContext: nextCtx,
      turns: [...turns, agentTurn],
      analysisAgentText: state.analysisAgentText || reply,
    },
    audio: [
      {
        label: 'Agent',
        base64: agentB64,
        mimeType: 'audio/mpeg',
        spokenText: reply,
        kind: 'agent',
      },
    ],
  };
}

async function handleStartInnervoice(
  state: SessionSnapshot,
  _consent?: boolean
): Promise<{ state: SessionSnapshot; audio: AudioPart[] }> {
  if (state.phase !== 'ANALYSIS') {
    throw new Error('Invalid phase for START_INNERVOICE');
  }
  if (!state.emotionalState) throw new Error('Missing emotional state');

  const ctx = { ...state.sessionContext, summary: state.sessionContext.summary || buildSummaryFromTurns(state.turns) };
  const script = await generateInnervoiceScript(ctx, state.emotionalState);

  const segments: { key: keyof InnervoiceScript; label: string }[] = [
    { key: 'validation', label: 'Validation' },
    { key: 'reframing', label: 'Reframing' },
    { key: 'intention', label: 'Intention' },
  ];

  const audio: AudioPart[] = [];

  for (const seg of segments) {
    const txt = script[seg.key];
    const b64 = await synthesizeInnervoiceUserTts(txt, {
      userMistralVoiceId: state.userMistralVoiceId,
      voiceProfileBase64: state.voiceProfileBase64,
    });
    audio.push({
      label: seg.label,
      base64: b64,
      mimeType: 'audio/mpeg',
      spokenText: txt,
      kind: 'innervoice',
    });
  }

  const promptText =
    'Take a moment: use the same screen as before for your mood, then confirm when you are ready.';
  const promptB64 = await synthesizeWithAgentVoice(promptText);
  audio.push({
    label: 'Transition',
    base64: promptB64,
    mimeType: 'audio/mpeg',
    spokenText: promptText,
    kind: 'agent',
  });

  return {
    state: {
      ...state,
      phase: 'INNERVOICE',
      voiceMode: 'AGENT',
      consentInnervoice: true,
      innervoiceScript: script,
    },
    audio,
  };
}

async function handleCompleteInnervoice(
  state: SessionSnapshot
): Promise<{ state: SessionSnapshot; audio: AudioPart[] }> {
  if (state.phase !== 'INNERVOICE') {
    throw new Error('Invalid phase for COMPLETE_INNERVOICE');
  }
  return {
    state: { ...state, phase: 'FEEDBACK' },
    audio: [],
  };
}

function feedbackAfterFromSubmit(event: {
  wRepli?: number;
  wDispersion?: number;
  wTension?: number;
  tension?: number;
  clarity?: number;
  energy?: number;
}): FeedbackAxes {
  const hasTri =
    typeof event.wRepli === 'number' &&
    typeof event.wDispersion === 'number' &&
    typeof event.wTension === 'number';
  if (hasTri) {
    const emotion = normalizeWeights({
      wRepli: event.wRepli!,
      wDispersion: event.wDispersion!,
      wTension: event.wTension!,
    });
    return { ...deriveLegacyScoresFromTriangle(emotion), emotion };
  }
  const t = event.tension ?? 5;
  const c = event.clarity ?? 5;
  const e = event.energy ?? 5;
  const tension = Math.min(10, Math.max(1, Math.round(t)));
  const clarity = Math.min(10, Math.max(1, Math.round(c)));
  const energy = Math.min(10, Math.max(1, Math.round(e)));
  return {
    tension,
    clarity,
    energy,
    emotion: approximateTriangleFromLegacy(tension, clarity, energy),
  };
}

async function handleFeedback(
  state: SessionSnapshot,
  event: Extract<ClientEvent, { type: 'FEEDBACK_SUBMIT' }>
): Promise<{ state: SessionSnapshot; audio: AudioPart[] }> {
  if (state.phase !== 'FEEDBACK') {
    throw new Error('Invalid phase for FEEDBACK_SUBMIT');
  }

  const feedbackAfter = feedbackAfterFromSubmit(event);

  const summary = buildClosingContextLine(state);
  const closing = await generateAgentReply({
    phase: 'CLOSING',
    userMessage: 'End the session with one kind synthesis sentence.',
    sessionSummary: summary,
  });
  const closingB64 = await synthesizeWithAgentVoice(closing);
  const agentTurn = newTurn('agent', closing, 'CLOSING', 'AGENT');

  return {
    state: {
      ...state,
      phase: 'CLOSING',
      feedbackAfter,
      turns: [...state.turns, agentTurn],
    },
    audio: [
      {
        label: 'Closing',
        base64: closingB64,
        mimeType: 'audio/mpeg',
        spokenText: closing,
        kind: 'agent',
      },
    ],
  };
}
