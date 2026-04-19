import { MarkdownEditor } from "../../editor/MarkdownEditor";
import { useUiStore } from "../../store/uiStore";
import { MindmapView } from "./MindmapView";
import { OutlineView } from "./OutlineView";

export function MainCanvas() {
  const mode = useUiStore((s) => s.mode);

  if (mode === "source") return <MarkdownEditor />;
  if (mode === "outline") return <OutlineView />;
  return <MindmapView />;
}
