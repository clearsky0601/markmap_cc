import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { MainCanvas } from "./components/canvas/MainCanvas";
import { TopToolbar } from "./components/shell/TopToolbar";
import { LeftFileTree } from "./components/shell/LeftFileTree";
import { RightAIPanel } from "./components/shell/RightAIPanel";
import { useAutosave } from "./hooks/useAutosave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useDocStore } from "./store/docStore";
import { useUiStore, type Theme } from "./store/uiStore";
import { ipc } from "./tauri/ipc";
import "./App.css";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme !== "system") root.setAttribute("data-theme", theme);
}

function App() {
  useAutosave();
  useKeyboardShortcuts();
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);
  const filePath = useDocStore((s) => s.filePath);
  const theme = useUiStore((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);

  // Start/stop file watcher when the open file changes
  useEffect(() => {
    if (!filePath) return;
    void ipc.startWatch(filePath).catch(console.error);
    return () => {
      void ipc.stopWatch(filePath).catch(console.error);
    };
  }, [filePath]);

  // Listen for external file changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ path: string; mtime_ms: number }>("file-changed", async (e) => {
      // Short delay so our own save's IPC response can update mtimeMs first
      await new Promise<void>((r) => setTimeout(r, 250));
      const state = useDocStore.getState();
      if (e.payload.path !== state.filePath) return;
      if (e.payload.mtime_ms === state.mtimeMs) return; // our own save

      const dirty = state.originRev !== state.savedRev;
      if (dirty) {
        const reload = window.confirm(
          "This file was changed outside the app.\nReload and discard your changes?",
        );
        if (!reload) return;
      }
      await state.loadFile(e.payload.path);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, []);
  const layout = `${leftOpen ? "L" : ""}${rightOpen ? "R" : ""}` || "M";

  return (
    <div className="shell">
      <TopToolbar />
      <div className="shell__body" data-layout={layout}>
        {leftOpen ? <LeftFileTree /> : null}
        <main className="shell__main">
          <MainCanvas />
        </main>
        {rightOpen ? <RightAIPanel /> : null}
      </div>
    </div>
  );
}

export default App;
