import { useEffect } from "react";
import type { Root, Heading } from "mdast";
import { useDocStore } from "../store/docStore";
import { useFilesStore } from "../store/filesStore";
import { ipc } from "../tauri/ipc";

function docTitle(mdast: Root): string {
  const h1 = mdast.children.find(
    (n): n is Heading => n.type === "heading" && n.depth === 1,
  );
  if (!h1) return "untitled";
  const text = h1.children
    .map((c) => ("value" in c ? (c as { value: string }).value : ""))
    .join("")
    .trim();
  // Sanitise for use as a filename
  return text.replace(/[/\\:*?"<>|]/g, "-").slice(0, 60) || "untitled";
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Don't intercept Cmd+Z inside text inputs — let the browser handle it
      const tgt = e.target as HTMLElement | null;
      const inInput =
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable);

      switch (e.key.toLowerCase()) {
        case "o": {
          e.preventDefault();
          const { loadFile } = useDocStore.getState();
          const { recordOpened } = useFilesStore.getState();
          const path = await ipc.pickFile();
          if (path) {
            await loadFile(path);
            await recordOpened(path);
          }
          break;
        }

        case "s": {
          e.preventDefault();
          const { filePath, mdast, saveCurrentFile, saveAs } = useDocStore.getState();
          const { recordOpened } = useFilesStore.getState();
          // Use H1 heading as default filename suggestion
          const suggestion = filePath
            ? (filePath.split("/").pop() ?? "untitled.md")
            : `${docTitle(mdast)}.md`;
          if (e.shiftKey) {
            // Cmd+Shift+S → Save As
            const path = await ipc.pickSavePath(suggestion);
            if (path) {
              await saveAs(path);
              await recordOpened(path);
            }
          } else {
            // Cmd+S → Save (pick path if unsaved)
            if (filePath) {
              await saveCurrentFile();
            } else {
              const path = await ipc.pickSavePath(suggestion);
              if (path) {
                await saveAs(path);
                await recordOpened(path);
              }
            }
          }
          break;
        }

        case "n": {
          if (e.shiftKey) break; // reserve Cmd+Shift+N
          e.preventDefault();
          useDocStore.getState().newDocument();
          break;
        }

        case "z": {
          if (inInput) break; // native browser undo inside text fields
          e.preventDefault();
          useDocStore.getState().undo();
          break;
        }

        case "t": {
          e.preventDefault();
          // Open a new independent window
          await ipc.newWindow().catch(console.error);
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
