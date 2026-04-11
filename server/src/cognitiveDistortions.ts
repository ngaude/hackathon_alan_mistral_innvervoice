/** Twelve cognitive distortions — stable ids for JSON / classifier. */
export const COGNITIVE_DISTORTION_IDS = [
  'tout_ou_rien',
  'dramatisation',
  'disqualification_du_positif',
  'raisonnement_emotif',
  'etiquetage',
  'magnification_minimisation',
  'filtre_mental',
  'lecture_de_la_pensee',
  'generalisation_abusive',
  'personnalisation',
  'dois_devrais',
  'vision_tunnel',
] as const;

export type CognitiveDistortionId = (typeof COGNITIVE_DISTORTION_IDS)[number];

/** English labels for UI and LLM-readable summaries (ids stay stable). */
export const COGNITIVE_DISTORTION_LABELS: Record<CognitiveDistortionId, string> = {
  tout_ou_rien: 'All-or-nothing (black-and-white) thinking',
  dramatisation: 'Catastrophizing',
  disqualification_du_positif: 'Disqualifying the positive',
  raisonnement_emotif: 'Emotional reasoning',
  etiquetage: 'Labeling',
  magnification_minimisation: 'Magnification / minimization',
  filtre_mental: 'Mental filter',
  lecture_de_la_pensee: 'Mind reading',
  generalisation_abusive: 'Overgeneralization',
  personnalisation: 'Personalization',
  dois_devrais: 'Should statements',
  vision_tunnel: 'Tunnel vision',
};

/** @deprecated Use COGNITIVE_DISTORTION_LABELS */
export const COGNITIVE_DISTORTION_LABELS_FR = COGNITIVE_DISTORTION_LABELS;

export function normalizeDistortionId(raw: string): CognitiveDistortionId | null {
  const x = raw.trim().toLowerCase().replace(/-/g, '_');
  return COGNITIVE_DISTORTION_IDS.includes(x as CognitiveDistortionId) ? (x as CognitiveDistortionId) : null;
}
