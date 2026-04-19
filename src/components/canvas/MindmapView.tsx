import { useEffect, useRef } from "react";
import { Markmap } from "markmap-view";
import { useDocStore } from "../../store/docStore";
import { mdastToMarkmap } from "../../sync/mdastToMarkmap";

export function MindmapView() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const initial = mdastToMarkmap(useDocStore.getState().mdast);
    const mm = Markmap.create(
      svgRef.current,
      {
        autoFit: true,
        duration: 250,
        nodeMinHeight: 22,
        spacingHorizontal: 80,
        spacingVertical: 8,
        paddingX: 8,
        maxWidth: 320,
        initialExpandLevel: -1,
      },
      initial,
    );
    mmRef.current = mm;

    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (state.mdast === prev.mdast) return;
      const next = mdastToMarkmap(state.mdast);
      void mm.setData(next);
    });

    const onResize = () => {
      void mm.fit();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      unsubscribe();
      mm.destroy();
      mmRef.current = null;
    };
  }, []);

  return (
    <div className="mm-host">
      <svg ref={svgRef} className="mm-svg" />
    </div>
  );
}
