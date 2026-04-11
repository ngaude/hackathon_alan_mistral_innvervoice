import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { usePlaybackUiStore } from '../store/playbackUiStore';

interface PlayMp3Options {
  /** 0–1, défaut 1 */
  volume?: number;
}

type Active = {
  gen: number;
  player: AudioPlayer;
  subscription: { remove: () => void } | null;
  finish: () => void;
};

let active: Active | null = null;
let generation = 0;

function trackBegin() {
  usePlaybackUiStore.getState().beginPlayback();
}

function trackEnd() {
  usePlaybackUiStore.getState().endPlayback();
}

export async function skipCurrentPlayback(): Promise<void> {
  const h = active;
  if (!h) return;
  generation += 1;
  active = null;
  trackEnd();
  try {
    h.subscription?.remove();
  } catch {
    /* ignore */
  }
  try {
    h.player.pause();
  } catch {
    /* ignore */
  }
  try {
    h.player.remove();
  } catch {
    /* ignore */
  }
  h.finish();
}

export async function playMp3Base64(base64: string, opts?: PlayMp3Options): Promise<void> {
  await skipCurrentPlayback();
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('cacheDirectory indisponible');
  const path = `${dir}tts-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const player = createAudioPlayer({ uri: path }, { updateInterval: 100 });
  const vol = opts?.volume ?? 1;
  player.volume = vol;

  const myGen = ++generation;
  trackBegin();

  const subRef: { current: { remove: () => void } | null } = { current: null };
  try {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (active?.gen === myGen) {
          active = null;
          trackEnd();
        }
        resolve();
      };
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) done();
      }) as { remove: () => void };
      active = { gen: myGen, player, subscription: subRef.current, finish: done };
      player.play();
    });
  } finally {
    try {
      subRef.current?.remove();
    } catch {
      /* ignore */
    }
    try {
      player.remove();
    } catch {
      /* ignore */
    }
  }
}

export async function playMp3FromUrl(
  url: string,
  requestHeaders?: Record<string, string>,
  opts?: PlayMp3Options
): Promise<void> {
  await skipCurrentPlayback();
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('cacheDirectory indisponible');
  const path = `${dir}replay-${Date.now()}.mp3`;
  const res = await FileSystem.downloadAsync(url, path, { headers: requestHeaders });
  const uri = res.uri;
  const player = createAudioPlayer({ uri }, { updateInterval: 100 });
  const vol = opts?.volume ?? 1;
  player.volume = vol;

  const myGen = ++generation;
  trackBegin();

  const subRef: { current: { remove: () => void } | null } = { current: null };
  try {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (active?.gen === myGen) {
          active = null;
          trackEnd();
        }
        resolve();
      };
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) done();
      }) as { remove: () => void };
      active = { gen: myGen, player, subscription: subRef.current, finish: done };
      player.play();
    });
  } finally {
    try {
      subRef.current?.remove();
    } catch {
      /* ignore */
    }
    try {
      player.remove();
    } catch {
      /* ignore */
    }
  }
}
