import { describeMistralAudioBase64, normalizeRefAudioBase64 } from '../lib/refAudio';

describe('normalizeRefAudioBase64', () => {
  it('strips data URL prefix', () => {
    const raw = 'AAAbbb';
    expect(normalizeRefAudioBase64(`data:audio/m4a;base64,${raw}`)).toBe(raw);
  });

  it('returns trimmed raw base64', () => {
    expect(normalizeRefAudioBase64('  abc def  ')).toBe('abcdef');
  });
});

describe('describeMistralAudioBase64', () => {
  it('detects WAV (RIFF/WAVE)', () => {
    const hdr = Buffer.alloc(12);
    hdr.write('RIFF', 0);
    hdr.writeUInt32LE(0, 4);
    hdr.write('WAVE', 8);
    const b64 = hdr.toString('base64');
    expect(describeMistralAudioBase64(b64).kind).toBe('wav');
  });

  it('detects MP4/M4A (ftyp)', () => {
    const hdr = Buffer.alloc(12);
    hdr.writeUInt32BE(28, 0);
    hdr.write('ftyp', 4);
    hdr.write('mp42', 8);
    const b64 = hdr.toString('base64');
    expect(describeMistralAudioBase64(b64).kind).toBe('mp4_m4a');
  });
});
