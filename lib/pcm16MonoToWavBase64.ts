/**
 * Construit un fichier WAV (RIFF / PCM 16-bit little-endian mono) à partir d’octets PCM bruts.
 * Retourne le **base64 brut** (sans préfixe data-URL), comme attendu par Mistral `ref_audio`.
 *
 * Cas d’usage : chaîner un futur flux PCM (natif, WASM, etc.) sans dépendre de `expo-audio` / MediaRecorder.
 * `expo-audio` sur Android ne fournit pas de LINEARPCM comme sur iOS — d’où `react-native-audio-api` pour le WAV live.
 */
export function pcm16MonoToWavBase64(pcm: Uint8Array, sampleRate: number): string {
  if (pcm.byteLength % 2 !== 0) {
    throw new Error('pcm16MonoToWavBase64: taille PCM non paire (attendu 16-bit)');
  }
  const dataSize = pcm.byteLength;
  const bufferSize = 44 + dataSize;
  const buf = new ArrayBuffer(bufferSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) u8[off + i] = s.charCodeAt(i);
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  u8.set(pcm, 44);

  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]!);
  return btoa(binary);
}
