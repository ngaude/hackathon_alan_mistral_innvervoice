import { elevenlabsPostForm } from './elevenlabsClient.js';

export async function createElevenlabsClonedVoice(
  sampleBase64: string,
  filename: string,
  name = `InnerVoice-${new Date().toISOString().slice(0, 10)}`
): Promise<string> {
  const buf = Buffer.from(sampleBase64.replace(/\s/g, ''), 'base64');
  const lower = filename.toLowerCase();
  const type = lower.endsWith('.mp3')
    ? 'audio/mpeg'
    : lower.endsWith('.m4a') || lower.endsWith('.mp4')
      ? 'audio/mp4'
      : 'audio/wav';
  const blob = new Blob([buf], { type });

  const form = new FormData();
  form.append('name', name);
  form.append('files', blob, filename);

  const res = await elevenlabsPostForm<{ voice_id: string }>('/voices/add', form);
  if (!res.voice_id) throw new Error('ElevenLabs voice clone response missing voice_id');
  return res.voice_id;
}
