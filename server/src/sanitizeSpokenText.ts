/** @see ../../lib/sanitizeSpokenText.ts — copie serveur (package séparé). */
export function sanitizeSpokenText(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\*\*[^*]+\*\*/g, ' ');
  s = s.replace(/\*[^*]+\*/g, ' ');
  s = s.replace(/\*+/g, '');
  s = s.replace(/\bNudge\s+ressenti\s*:\s*\d+\s*[–-]\s*/gi, '');
  s = s.replace(/\bNudge\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bIndication\s+vivante\s+du\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bContexte\s+curseur\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\bAuto-positionnement\s+ressenti\b[^.!?]*[.!?]?/gi, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}
