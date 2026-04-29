import { create } from "zustand";
import type { Root } from "mdast";
import { mdastFromMarkdown } from "../sync/mdastFromMarkdown";
import { ipc } from "../tauri/ipc";

export const SAMPLE_MARKDOWN = `# markmap_cc

## What it is
- A Mac mindmap editor
- Markdown is the **source of truth**
- XMind-style on-canvas editing

## Roadmap
- Phase A — scaffold ✓
- Phase B — md → mindmap pipeline ✓
- Phase C — file ops + recent
  - open / save .md files
  - autosave debounce
  - recent files persisted
- Phase D — real layout + outline mode
- Phase E — node editing on canvas
- Phase F — drag, delete, polish

## Notes
- Tauri 2 + React 19 + bun
- ID strategy: \`type:offset\`
- Bidirectional sync uses \`originRev\` to break loops
`;

export type DocOrigin = "init" | "editor" | "mindmap" | "file" | "undo";

const MAX_HISTORY = 50;

interface DocState {
  filePath: string | null;
  markdownText: string;
  mdast: Root;
  originRev: number;
  savedRev: number;
  mtimeMs: number | null;
  lastOrigin: DocOrigin;
  history: string[]; // undo stack — most recent entry at the end

  setMarkdown: (text: string, origin: DocOrigin) => void;
  undo: () => void;

  newDocument: () => void;
  loadFile: (path: string) => Promise<void>;
  saveCurrentFile: () => Promise<{ saved: boolean; path?: string }>;
  saveAs: (path: string) => Promise<void>;
}

export const useDocStore = create<DocState>((set, get) => ({
  filePath: null,
  markdownText: SAMPLE_MARKDOWN,
  mdast: mdastFromMarkdown(SAMPLE_MARKDOWN),
  originRev: 0,
  savedRev: 0,
  mtimeMs: null,
  lastOrigin: "init",
  history: [],

  setMarkdown: (text, origin) =>
    set((state) => ({
      markdownText: text,
      mdast: mdastFromMarkdown(text),
      originRev: state.originRev + 1,
      lastOrigin: origin,
      // Push current text before replacing (skip for undo to avoid double-entry)
      history:
        origin === "undo"
          ? state.history
          : [...state.history.slice(-(MAX_HISTORY - 1)), state.markdownText],
    })),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        markdownText: prev,
        mdast: mdastFromMarkdown(prev),
        originRev: state.originRev + 1,
        lastOrigin: "undo",
        history: state.history.slice(0, -1),
      };
    }),

  newDocument: () => {
    const text = "# Untitled\n\n- \n";
    set((state) => ({
      filePath: null,
      markdownText: text,
      mdast: mdastFromMarkdown(text),
      originRev: state.originRev + 1,
      savedRev: state.originRev + 1,
      mtimeMs: null,
      lastOrigin: "file",
      history: [], // fresh start — no undo across new doc
    }));
  },

  loadFile: async (path) => {
    const { content, mtime_ms } = await ipc.readFile(path);
    set((state) => {
      const nextRev = state.originRev + 1;
      return {
        filePath: path,
        markdownText: content,
        mdast: mdastFromMarkdown(content),
        originRev: nextRev,
        savedRev: nextRev,
        mtimeMs: mtime_ms,
        lastOrigin: "file",
        history: [], // fresh start after file load
      };
    });
  },

  saveCurrentFile: async () => {
    const { filePath, markdownText, originRev } = get();
    if (!filePath) return { saved: false };
    const { mtime_ms } = await ipc.writeFile(filePath, markdownText);
    set({ savedRev: originRev, mtimeMs: mtime_ms });
    return { saved: true, path: filePath };
  },

  saveAs: async (path) => {
    const { markdownText, originRev } = get();
    const { mtime_ms } = await ipc.writeFile(path, markdownText);
    set({
      filePath: path,
      savedRev: originRev,
      mtimeMs: mtime_ms,
    });
  },
}));

export const selectDirty = (s: DocState) =>
  s.filePath !== null && s.originRev !== s.savedRev;
