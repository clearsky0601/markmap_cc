import { create } from "zustand";
import { ipc, type RecentFile } from "../tauri/ipc";

interface FilesState {
  recent: RecentFile[];
  loading: boolean;
  error: string | null;

  refreshRecent: () => Promise<void>;
  recordOpened: (path: string) => Promise<void>;
  forget: (path: string) => Promise<void>;
}

export const useFilesStore = create<FilesState>((set) => ({
  recent: [],
  loading: false,
  error: null,

  refreshRecent: async () => {
    set({ loading: true, error: null });
    try {
      const recent = await ipc.listRecent();
      set({ recent, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  recordOpened: async (path) => {
    try {
      const recent = await ipc.addRecent(path);
      set({ recent });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  forget: async (path) => {
    try {
      const recent = await ipc.removeRecent(path);
      set({ recent });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
