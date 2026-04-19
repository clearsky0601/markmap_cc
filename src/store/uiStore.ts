import { create } from "zustand";

export type ViewMode = "source" | "mindmap" | "outline";

interface UiState {
  mode: ViewMode;
  leftOpen: boolean;
  rightOpen: boolean;

  setMode: (mode: ViewMode) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mode: "mindmap",
  leftOpen: true,
  rightOpen: false,

  setMode: (mode) => set({ mode }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
}));
