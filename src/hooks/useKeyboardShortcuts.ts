import { useEffect } from "react";
import { useDocStore } from "../store/docStore";
import { useFilesStore } from "../store/filesStore";
import { ipc } from "../tauri/ipc";

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
        case "s": {
          e.preventDefault();
          const { filePath, saveCurrentFile, saveAs } = useDocStore.getState();
          const { recordOpened } = useFilesStore.getState();
          if (e.shiftKey) {
            // Cmd+Shift+S → Save As
            const suggestion =
              filePath ? (filePath.split("/").pop() ?? "untitled.md") : "untitled.md";
            const path = await ipc.pickSavePath(suggestion);
            if (path) {
              await saveAs(path);
              await recordOpened(path);
            }
          } else {
            // Cmd+S → Save
            if (filePath) {
              await saveCurrentFile();
            } else {
              const path = await ipc.pickSavePath("untitled.md");
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
