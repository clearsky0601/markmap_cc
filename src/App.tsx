import { MarkdownEditor } from "./editor/MarkdownEditor";
import { MindmapView } from "./components/canvas/MindmapView";
import "./App.css";

function App() {
  return (
    <div className="phase-b">
      <header className="phase-b__bar">
        <span className="phase-b__title">markmap_cc</span>
        <span className="phase-b__tag">Phase B · md → mindmap (dev split)</span>
      </header>
      <main className="phase-b__split">
        <section className="phase-b__pane phase-b__pane--editor">
          <MarkdownEditor />
        </section>
        <section className="phase-b__pane phase-b__pane--canvas">
          <MindmapView />
        </section>
      </main>
    </div>
  );
}

export default App;
