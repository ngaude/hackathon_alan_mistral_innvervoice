import { create } from 'zustand';

/** Compteur de lectures audio actives (TTS / file) pour afficher le bouton « Passer ». */
interface PlaybackUiState {
  activeCount: number;
  beginPlayback: () => void;
  endPlayback: () => void;
}

export const usePlaybackUiStore = create<PlaybackUiState>((set, get) => ({
  activeCount: 0,
  beginPlayback: () => set({ activeCount: get().activeCount + 1 }),
  endPlayback: () => set({ activeCount: Math.max(0, get().activeCount - 1) }),
}));
