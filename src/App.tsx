import { MainCanvas } from "./components/canvas/MainCanvas";
import { TopToolbar } from "./components/shell/TopToolbar";
import { LeftFileTree } from "./components/shell/LeftFileTree";
import { RightAIPanel } from "./components/shell/RightAIPanel";
import { useAutosave } from "./hooks/useAutosave";
import { useUiStore } from "./store/uiStore";
import "./App.css";

function App() {
  useAutosave();
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);
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
