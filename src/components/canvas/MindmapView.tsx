import { useEffect, useRef, useState } from "react";
import { Markmap } from "markmap-view";
import { useDocStore } from "../../store/docStore";
import { mdastToMarkmap } from "../../sync/mdastToMarkmap";
import { editNodeText, findById, plainTextOf } from "../../sync/mutations";
import { markdownFromMdast } from "../../sync/markdownFromMdast";
import { NodeEditOverlay } from "./NodeEditOverlay";

interface EditingState {
  id: string;
  initial: string;
  rect: { left: number; top: number; width: number; height: number };
}

export function MindmapView() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mmRef = useRef<Markmap | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    const injectIds = () => {
      svg.querySelectorAll<SVGGElement>("g.markmap-node").forEach((g) => {
        const datum = (g as unknown as { __data__: unknown }).__data__ as
          | { payload?: { id?: string }; data?: { payload?: { id?: string } } }
          | undefined;
        const id = datum?.payload?.id ?? datum?.data?.payload?.id;
        if (id) g.setAttribute("data-id", id);
      });
    };

    const mm = Markmap.create(svg, {
      autoFit: true,
      duration: 250,
      nodeMinHeight: 22,
      spacingHorizontal: 80,
      spacingVertical: 8,
      paddingX: 8,
      maxWidth: 320,
      initialExpandLevel: -1,
    });
    mmRef.current = mm;

    const initial = mdastToMarkmap(useDocStore.getState().mdast);
    void mm.setData(initial).then(() => requestAnimationFrame(injectIds));

    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (state.mdast === prev.mdast) return;
      void mm
        .setData(mdastToMarkmap(state.mdast))
        .then(() => requestAnimationFrame(injectIds));
    });

    const onDblClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const g = t?.closest?.("g.markmap-node") as SVGGElement | null;
      if (!g) return;
      const id = g.getAttribute("data-id");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      const target = findById(useDocStore.getState().mdast, id);
      if (!target) return;
      const rect = g.getBoundingClientRect();
      setEditing({
        id,
        initial: plainTextOf(target),
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    };
    svg.addEventListener("dblclick", onDblClick, true);

    const onResize = () => {
      void mm.fit();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      svg.removeEventListener("dblclick", onDblClick, true);
      unsubscribe();
      mm.destroy();
      mmRef.current = null;
    };
  }, []);

  const commit = (text: string) => {
    if (!editing) return;
    const { id } = editing;
    setEditing(null);
    const { mdast, setMarkdown } = useDocStore.getState();
    const next = editNodeText(mdast, id, text);
    if (next === mdast) return;
    const md = markdownFromMdast(next);
    setMarkdown(md, "mindmap");
  };

  return (
    <div className="mm-host">
      <svg ref={svgRef} className="mm-svg" />
      {editing ? (
        <NodeEditOverlay
          rect={editing.rect}
          initial={editing.initial}
          onCommit={commit}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
