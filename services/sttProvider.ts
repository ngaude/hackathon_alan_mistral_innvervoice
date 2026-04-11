/**
 * Client-side STT provider router — delegates to Mistral or ElevenLabs based on VOICE_PROVIDER.
 */
import { getVoiceProvider } from '../lib/env';
import { transcribeAudioFromUri as mistralTranscribe } from './mistralTranscribe';
import { transcribeAudioFromUri as elevenlabsTranscribe } from './elevenlabsTranscribe';

interface TranscriptionResult {
  text: string;
  language?: string | null;
}

export async function transcribeAudioFromUri(
  fileUri: string,
  language?: string
): Promise<TranscriptionResult> {
  const p = getVoiceProvider();
  return p === 'elevenlabs'
    ? elevenlabsTranscribe(fileUri, language)
    : mistralTranscribe(fileUri, language);
}
