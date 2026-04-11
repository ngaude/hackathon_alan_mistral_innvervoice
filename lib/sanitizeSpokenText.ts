/**
 * Retire les segments *comme ceci* ou **markdown** souvent produits par le LLM comme méta ou « nudge »,
 * pour que la parole reste fluide et immersive.
 */
export function sanitizeSpokenText(raw: string): string {
  let s = raw.trim();
  // Blocs *...* ou **...** (non greedy), y compris plusieurs sur une ligne
  s = s.replace(/\*\*[^*]+\*\*/g, ' ');
  s = s.replace(/\*[^*]+\*/g, ' ');
  // Restes d'astérisques isolés
  s = s.replace(/\*+/g, '');
  // Fuites de consignes internes parfois recopiées par le modèle
  s = s.replace(/\bNudge\s+ressenti\s*:\s*\d+\s*[–-]\s*/gi, '');
  s = s.replace(/\bNudge\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bIndication\s+vivante\s+du\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bContexte\s+curseur\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bAuto-positionnement\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}
