import { create } from "zustand";
import type { Root } from "mdast";
import { mdastFromMarkdown } from "../sync/mdastFromMarkdown";

export const SAMPLE_MARKDOWN = `# markmap_cc

## What it is
- A Mac mindmap editor
- Markdown is the **source of truth**
- XMind-style on-canvas editing

## Roadmap
- Phase A — scaffold ✓
- Phase B — md → mindmap pipeline
  - parse remark
  - build markmap INode
  - render via markmap-view
- Phase C — file ops + recent
- Phase D — real layout + outline mode
- Phase E — node editing on canvas
- Phase F — drag, delete, polish

## Notes
- Tauri 2 + React 19 + bun
- ID strategy: \`type:offset\`
- Bidirectional sync uses \`originRev\` to break loops
`;

export type DocOrigin = "init" | "editor" | "mindmap" | "file";

interface DocState {
  markdownText: string;
  mdast: Root;
  originRev: number;
  lastOrigin: DocOrigin;

  setMarkdown: (text: string, origin: DocOrigin) => void;
}

export const useDocStore = create<DocState>((set) => ({
  markdownText: SAMPLE_MARKDOWN,
  mdast: mdastFromMarkdown(SAMPLE_MARKDOWN),
  originRev: 0,
  lastOrigin: "init",

  setMarkdown: (text, origin) =>
    set((state) => ({
      markdownText: text,
      mdast: mdastFromMarkdown(text),
      originRev: state.originRev + 1,
      lastOrigin: origin,
    })),
}));
