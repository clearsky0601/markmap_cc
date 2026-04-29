import { invoke } from "@tauri-apps/api/core";

export interface FileContent {
  path: string;
  content: string;
  mtime_ms: number;
}

export interface WriteResult {
  path: string;
  mtime_ms: number;
}

export type TreeEntry =
  | { kind: "folder"; name: string; path: string }
  | { kind: "file"; name: string; path: string };

export interface RecentFile {
  path: string;
  opened_at_ms: number;
}

export const ipc = {
  greet: (name: string) => invoke<string>("greet", { name }),

  readFile: (path: string) => invoke<FileContent>("read_file", { path }),

  writeFile: (path: string, content: string) =>
    invoke<WriteResult>("write_file", { path, content }),

  pickFile: () => invoke<string | null>("pick_file"),

  pickFolder: () => invoke<string | null>("pick_folder"),

  pickSavePath: (suggestedName?: string) =>
    invoke<string | null>("pick_save_path", { suggestedName }),

  listDir: (path: string) => invoke<TreeEntry[]>("list_dir", { path }),

  listRecent: () => invoke<RecentFile[]>("list_recent"),

  addRecent: (path: string) =>
    invoke<RecentFile[]>("add_recent", { path }),

  removeRecent: (path: string) =>
    invoke<RecentFile[]>("remove_recent", { path }),

  startWatch: (path: string) => invoke<void>("start_watch", { path }),

  stopWatch: (path: string) => invoke<void>("stop_watch", { path }),

  newWindow: () => invoke<void>("new_window"),

  askAi: (
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
  ) => invoke<string>("ask_ai", { baseUrl, apiKey, model, messages }),
};
