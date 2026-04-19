import { useCallback } from "react";
import { useDocStore, selectDirty } from "../../store/docStore";
import { useFilesStore } from "../../store/filesStore";
import { ipc } from "../../tauri/ipc";

export function TopToolbar() {
  const filePath = useDocStore((s) => s.filePath);
  const dirty = useDocStore(selectDirty);
  const newDocument = useDocStore((s) => s.newDocument);
  const loadFile = useDocStore((s) => s.loadFile);
  const saveCurrentFile = useDocStore((s) => s.saveCurrentFile);
  const saveAs = useDocStore((s) => s.saveAs);
  const recordOpened = useFilesStore((s) => s.recordOpened);

  const onOpen = useCallback(async () => {
    const path = await ipc.pickFile();
    if (!path) return;
    try {
      await loadFile(path);
      await recordOpened(path);
    } catch (e) {
      console.error("[open]", e);
    }
  }, [loadFile, recordOpened]);

  const onSave = useCallback(async () => {
    if (!filePath) {
      const suggestion = "untitled.md";
      const path = await ipc.pickSavePath(suggestion);
      if (!path) return;
      await saveAs(path);
      await recordOpened(path);
    } else {
      await saveCurrentFile();
    }
  }, [filePath, saveAs, saveCurrentFile, recordOpened]);

  const onSaveAs = useCallback(async () => {
    const suggestion = filePath ? filePath.split("/").pop() ?? "untitled.md" : "untitled.md";
    const path = await ipc.pickSavePath(suggestion);
    if (!path) return;
    await saveAs(path);
    await recordOpened(path);
  }, [filePath, saveAs, recordOpened]);

  const fileLabel = filePath
    ? filePath.split("/").pop() ?? filePath
    : "(unsaved)";

  return (
    <header className="toolbar">
      <span className="toolbar__title">markmap_cc</span>
      <span className="toolbar__sep" />
      <button className="toolbar__btn" onClick={newDocument} title="New (⌘N)">
        New
      </button>
      <button className="toolbar__btn" onClick={onOpen} title="Open… (⌘O)">
        Open
      </button>
      <button className="toolbar__btn" onClick={onSave} title="Save (⌘S)">
        Save
      </button>
      <button className="toolbar__btn" onClick={onSaveAs} title="Save As (⇧⌘S)">
        Save As…
      </button>
      <span className="toolbar__sep" />
      <span className="toolbar__file" title={filePath ?? ""}>
        {fileLabel}
        {dirty ? <span className="toolbar__dirty" aria-label="unsaved">●</span> : null}
      </span>
      <span className="toolbar__spacer" />
      <span className="toolbar__tag">Phase C · file ops</span>
    </header>
  );
}
