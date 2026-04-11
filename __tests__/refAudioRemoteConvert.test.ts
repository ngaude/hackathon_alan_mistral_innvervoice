import { pcm16MonoToWavBase64 } from '../lib/pcm16MonoToWavBase64';

const mockGetRefAudioConvertUrl = jest.fn<string | undefined, []>();
const mockGetRefAudioConvertSecret = jest.fn<string | undefined, []>();

jest.mock('../lib/env', () => ({
  getRefAudioConvertUrl: () => mockGetRefAudioConvertUrl(),
  getRefAudioConvertSecret: () => mockGetRefAudioConvertSecret(),
}));

import { tryConvertM4aBase64ToWavViaHttp } from '../lib/refAudioRemoteConvert';

describe('tryConvertM4aBase64ToWavViaHttp', () => {
  const origFetch = global.fetch;

  afterEach(() => {
    global.fetch = origFetch;
    jest.clearAllMocks();
  });

  it('retourne null si aucune URL', async () => {
    mockGetRefAudioConvertUrl.mockReturnValue(undefined);
    await expect(tryConvertM4aBase64ToWavViaHttp('abcd')).resolves.toBeNull();
    expect(global.fetch).toBe(origFetch);
  });

  it('retourne le WAV si le serveur renvoie un wavBase64 détectable', async () => {
    mockGetRefAudioConvertUrl.mockReturnValue('https://example.com/convert');
    mockGetRefAudioConvertSecret.mockReturnValue(undefined);

    const validWav = pcm16MonoToWavBase64(new Uint8Array([0, 0, 0xff, 0x7f]), 16000);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wavBase64: validWav }),
    });

    await expect(tryConvertM4aBase64ToWavViaHttp('fakeM4A')).resolves.toBe(validWav);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/convert',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('envoie Authorization si secret configuré', async () => {
    mockGetRefAudioConvertUrl.mockReturnValue('https://example.com/convert');
    mockGetRefAudioConvertSecret.mockReturnValue('secret');

    const validWav = pcm16MonoToWavBase64(new Uint8Array([0, 0]), 16000);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wavBase64: validWav }),
    });

    await tryConvertM4aBase64ToWavViaHttp('x');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/convert',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      })
    );
  });
});
