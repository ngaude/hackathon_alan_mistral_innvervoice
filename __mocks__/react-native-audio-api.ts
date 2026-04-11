/** Mock Jest — pas de module natif. */
export async function decodeAudioData(): Promise<never> {
  throw new Error('decodeAudioData: mock — utiliser un development build pour le décodage FFmpeg.');
}

export class AudioRecorder {
  enableFileOutput(): { status: 'success'; path: string } {
    return { status: 'success', path: '/mock/innervoice.wav' };
  }
  start(): { status: 'success'; path: string } {
    return { status: 'success', path: '/mock/innervoice.wav' };
  }
  stop(): { status: 'success'; path: string; size: number; duration: number } {
    return { status: 'success', path: '/mock/innervoice.wav', size: 1000, duration: 1 };
  }
}

export const AudioManager = {
  setAudioSessionOptions: (): void => undefined,
  setAudioSessionActivity: async (): Promise<boolean> => true,
  requestRecordingPermissions: async (): Promise<'Granted'> => 'Granted',
};

export enum FileFormat {
  Wav = 0,
  Caf = 1,
  M4A = 2,
  Flac = 3,
}

export enum FileDirectory {
  Document = 0,
  Cache = 1,
}

export const FilePreset = {
  Lossless: {
    sampleRate: 48000,
    bitRate: 320000,
    bitDepth: 0,
    flacCompressionLevel: 0,
    iosQuality: 3,
  },
};
