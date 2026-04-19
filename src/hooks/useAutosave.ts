import { useEffect, useRef } from "react";
import { useDocStore } from "../store/docStore";

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function useAutosave() {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const cancel = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (state.originRev === prev.originRev) return;
      if (!state.filePath) return;
      if (state.originRev === state.savedRev) return;
      if (state.lastOrigin === "file") return;

      cancel();
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        try {
          await useDocStore.getState().saveCurrentFile();
        } catch (e) {
          console.error("[autosave]", e);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      cancel();
      unsubscribe();
    };
  }, []);
}
