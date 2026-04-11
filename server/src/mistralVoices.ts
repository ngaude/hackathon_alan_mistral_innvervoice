import { mistralPostJson } from './mistralClient.js';

export async function createMistralClonedVoice(
  sampleBase64: string,
  filename: string,
  name = `InnerVoice-${new Date().toISOString().slice(0, 10)}`
): Promise<string> {
  const res = await mistralPostJson<{ id: string }>('/audio/voices', {
    name,
    sample_audio: sampleBase64,
    sample_filename: filename,
    languages: ['fr'],
  });
  if (!res.id) throw new Error('Voice response missing id');
  return res.id;
}
