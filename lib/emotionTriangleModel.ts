/** Sommets : Repli, Dispersion, Tension — aligné sur le triangle côté session. */

export interface EmotionTriangleWeights {
  wRepli: number;
  wDispersion: number;
  wTension: number;
}

const EMOTION_TRIANGLE_CENTER: EmotionTriangleWeights = {
  wRepli: 1 / 3,
  wDispersion: 1 / 3,
  wTension: 1 / 3,
};

function normalizeWeights(w: EmotionTriangleWeights): EmotionTriangleWeights {
  const a = Math.max(0, w.wRepli);
  const b = Math.max(0, w.wDispersion);
  const c = Math.max(0, w.wTension);
  const s = a + b + c;
  if (s <= 1e-9) return { ...EMOTION_TRIANGLE_CENTER };
  return { wRepli: a / s, wDispersion: b / s, wTension: c / s };
}

/** Remplissage optionnel `emotion` pour vieux snapshots qui n’ont que tension/clarity/energy. */
export function approximateTriangleFromLegacy(tension: number, clarity: number, energy: number): EmotionTriangleWeights {
  const third = 1 / 3;
  const wTension = third + (tension - 5) / 9;
  const wDispersion = third - (clarity - 5) / 9;
  const wRepli = third - (energy - 5) / 9;
  return normalizeWeights({ wRepli, wDispersion, wTension });
}
