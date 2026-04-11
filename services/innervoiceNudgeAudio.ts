import { mistralApiError } from '../lib/mistralDebug';
import { INNERVOICE_NUDGE_TEXT } from '../constants/innervoiceNudge';
import { playMp3Base64 } from './audioPlayer';
import { synthesizeInnervoiceUserTts } from './mistralSpeech';

/** Plays first-person nudge with user voice (clone / `voice_id`), or Jane neutral preset if no print / TTS 403. */
export async function playInnervoiceNudgeAudio(params: {
  userMistralVoiceId: string | null;
  voiceProfileBase64: string | null;
}): Promise<void> {
  const { userMistralVoiceId, voiceProfileBase64 } = params;
  try {
    const b64 = await synthesizeInnervoiceUserTts(INNERVOICE_NUDGE_TEXT, {
      userMistralVoiceId,
      voiceProfileBase64,
    });
    await playMp3Base64(b64);
  } catch (e) {
    mistralApiError('playInnervoiceNudgeAudio', {
      error: e instanceof Error ? e.message : String(e),
      hadVoiceId: Boolean(userMistralVoiceId),
      hadVoiceProfile: Boolean(voiceProfileBase64),
    });
    throw e;
  }
}
