import { useCallback } from "react";
import { useDocStore, selectDirty } from "../../store/docStore";
import { useFilesStore } from "../../store/filesStore";
import { useUiStore, type ViewMode } from "../../store/uiStore";
import { ipc } from "../../tauri/ipc";

const MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: "source", label: "Source", title: "Markdown source" },
  { id: "mindmap", label: "Mindmap", title: "Mindmap canvas" },
  { id: "outline", label: "Outline", title: "Outline bullets" },
];

export function TopToolbar() {
  const filePath = useDocStore((s) => s.filePath);
  const dirty = useDocStore(selectDirty);
  const newDocument = useDocStore((s) => s.newDocument);
  const loadFile = useDocStore((s) => s.loadFile);
  const saveCurrentFile = useDocStore((s) => s.saveCurrentFile);
  const saveAs = useDocStore((s) => s.saveAs);
  const recordOpened = useFilesStore((s) => s.recordOpened);

  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);
  const toggleLeft = useUiStore((s) => s.toggleLeft);
  const toggleRight = useUiStore((s) => s.toggleRight);

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
      <button
        className={`toolbar__icon${leftOpen ? " is-on" : ""}`}
        onClick={toggleLeft}
        title="Toggle file list"
        aria-label="Toggle file list"
      >
        ☰
      </button>
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
      <div className="toolbar__seg" role="tablist" aria-label="View mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`toolbar__seg-btn${mode === m.id ? " is-on" : ""}`}
            onClick={() => setMode(m.id)}
            title={m.title}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="toolbar__sep" />
      <span className="toolbar__file" title={filePath ?? ""}>
        {fileLabel}
        {dirty ? <span className="toolbar__dirty" aria-label="unsaved">●</span> : null}
      </span>
      <span className="toolbar__spacer" />
      <span className="toolbar__tag">Phase D · layout</span>
      <button
        className={`toolbar__icon${rightOpen ? " is-on" : ""}`}
        onClick={toggleRight}
        title="Toggle AI panel"
        aria-label="Toggle AI panel"
      >
        ◧
      </button>
    </header>
  );
}
