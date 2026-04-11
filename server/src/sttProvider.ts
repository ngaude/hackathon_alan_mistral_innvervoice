/**
 * STT provider router — delegates to Mistral or ElevenLabs based on VOICE_PROVIDER env.
 */
import { getVoiceProvider } from './env.js';
import { transcribeAudioBase64 as mistralTranscribe } from './mistralTranscribe.js';
import { transcribeAudioBase64 as elevenlabsTranscribe } from './elevenlabsTranscribe.js';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

export async function transcribeAudioBase64(
  audioBase64: string,
  filename?: string,
  language?: string
): Promise<TranscriptionResult> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabsTranscribe(audioBase64, filename, language)
    : mistralTranscribe(audioBase64, filename, language);
}
