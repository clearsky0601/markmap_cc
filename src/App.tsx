import { MarkdownEditor } from "./editor/MarkdownEditor";
import { MindmapView } from "./components/canvas/MindmapView";
import { TopToolbar } from "./components/shell/TopToolbar";
import { LeftFileTree } from "./components/shell/LeftFileTree";
import { useAutosave } from "./hooks/useAutosave";
import "./App.css";

function App() {
  useAutosave();
  return (
    <div className="shell">
      <TopToolbar />
      <div className="shell__body">
        <LeftFileTree />
        <main className="shell__main">
          <section className="shell__pane shell__pane--editor">
            <MarkdownEditor />
          </section>
          <section className="shell__pane shell__pane--canvas">
            <MindmapView />
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
