import { useEffect } from "react";
import { useDocStore } from "../../store/docStore";
import { useFilesStore } from "../../store/filesStore";

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function shortDir(p: string): string {
  const parts = p.split("/");
  parts.pop();
  return parts.slice(-2).join("/");
}

export function LeftFileTree() {
  const recent = useFilesStore((s) => s.recent);
  const refreshRecent = useFilesStore((s) => s.refreshRecent);
  const forget = useFilesStore((s) => s.forget);
  const loadFile = useDocStore((s) => s.loadFile);
  const recordOpened = useFilesStore((s) => s.recordOpened);
  const currentPath = useDocStore((s) => s.filePath);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  return (
    <aside className="sidebar">
      <div className="sidebar__section">
        <div className="sidebar__heading">Recent</div>
        {recent.length === 0 ? (
          <div className="sidebar__empty">No recent files yet.</div>
        ) : (
          <ul className="sidebar__list">
            {recent.map((r) => {
              const isCurrent = r.path === currentPath;
              return (
                <li
                  key={r.path}
                  className={`sidebar__item${isCurrent ? " is-current" : ""}`}
                >
                  <button
                    className="sidebar__item-btn"
                    onClick={async () => {
                      await loadFile(r.path);
                      await recordOpened(r.path);
                    }}
                    title={r.path}
                  >
                    <div className="sidebar__item-name">{basename(r.path)}</div>
                    <div className="sidebar__item-dir">{shortDir(r.path)}</div>
                  </button>
                  <button
                    className="sidebar__item-x"
                    onClick={() => void forget(r.path)}
                    title="Forget this file"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
