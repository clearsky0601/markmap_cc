import { create } from "zustand";

export type ViewMode = "source" | "mindmap" | "outline";
export type Theme = "system" | "light" | "dark";

interface UiState {
  mode: ViewMode;
  leftOpen: boolean;
  rightOpen: boolean;
  theme: Theme;
  selectedNodeIds: string[];

  setMode: (mode: ViewMode) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setTheme: (theme: Theme) => void;
  setSelectedNodeIds: (ids: string[]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mode: "mindmap",
  leftOpen: true,
  rightOpen: false,
  theme: "system",
  selectedNodeIds: [],

  setMode: (mode) => set({ mode }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setTheme: (theme) => set({ theme }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
}));
