import { pcm16MonoToWavBase64 } from '../lib/pcm16MonoToWavBase64';
import { describeMistralAudioBase64 } from '../lib/refAudio';

describe('pcm16MonoToWavBase64', () => {
  it('produit un en-tête RIFF/WAVE détectable par Mistral', () => {
    const pcm = new Uint8Array(4);
    pcm[0] = 0;
    pcm[1] = 0;
    pcm[2] = 0xff;
    pcm[3] = 0x7f;
    const b64 = pcm16MonoToWavBase64(pcm, 16000);
    const fmt = describeMistralAudioBase64(b64);
    expect(fmt.kind).toBe('wav');
  });

  it('rejette une taille PCM impaire', () => {
    expect(() => pcm16MonoToWavBase64(new Uint8Array(3), 16000)).toThrow(/paire/);
  });
});
