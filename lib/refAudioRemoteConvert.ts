import { getRefAudioConvertSecret, getRefAudioConvertUrl } from './env';
import { describeMistralAudioBase64, normalizeRefAudioBase64 } from './refAudio';

/**
 * Conversion **sans module natif** : envoie le base64 (souvent M4A/MP4 issu d’`expo-av` sur Android)
 * vers une URL que vous hébergez ; la réponse doit contenir un WAV en base64.
 *
 * Utile pour **Expo Go**, où `react-native-audio-api` / FFmpeg ne sont pas disponibles.
 *
 * Contrat attendu :
 * - `POST` JSON `{ "audioBase64": "<brut>", "mimeType": "audio/mp4" }`
 * - En-tête optionnel `Authorization: Bearer <secret>` si `EXPO_PUBLIC_REF_AUDIO_CONVERT_SECRET` est défini.
 * - Réponse `200` JSON `{ "wavBase64": "<brut>" }` (ou `base64` à la place de `wavBase64`).
 */
export async function tryConvertM4aBase64ToWavViaHttp(audioBase64: string): Promise<string | null> {
  const url = getRefAudioConvertUrl();
  if (!url) return null;

  const secret = getRefAudioConvertSecret();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret
          ? { Authorization: `Bearer ${secret}`, 'X-Innervoice-Secret': secret }
          : {}),
      },
      body: JSON.stringify({
        audioBase64: normalizeRefAudioBase64(audioBase64),
        mimeType: 'audio/mp4',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { wavBase64?: string; base64?: string };
    const raw = data.wavBase64 ?? data.base64;
    if (!raw || typeof raw !== 'string') return null;
    const out = normalizeRefAudioBase64(raw);
    const fmt = describeMistralAudioBase64(out);
    return fmt.kind === 'wav' ? out : null;
  } catch {
    return null;
  }
}
