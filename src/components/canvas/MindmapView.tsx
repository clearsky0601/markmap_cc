import { useEffect, useRef, useState } from "react";
import type { Root } from "mdast";
import { Markmap } from "markmap-view";
import { useDocStore } from "../../store/docStore";
import { mdastToMarkmap } from "../../sync/mdastToMarkmap";
import {
  addChildLast,
  addSiblingAfter,
  editNodeText,
  findById,
  findPath,
  outdent,
  plainTextOf,
  resolvePath,
} from "../../sync/mutations";
import { deriveId } from "../../sync/nodeIds";
import { markdownFromMdast } from "../../sync/markdownFromMdast";
import {
  NodeEditOverlay,
  type CommitAction,
  type EditRect,
} from "./NodeEditOverlay";

interface EditingState {
  id: string;
  initial: string;
  rect: EditRect;
  caretAtEnd: boolean;
}

interface PendingFocus {
  path: number[];
  openEdit: boolean;
  caretAtEnd: boolean;
}

const TRANSITION_MS = 250;
const FOCUS_DELAY_MS = TRANSITION_MS + 30;

type StructuralAction = "sibling" | "child" | "outdent";

export function MindmapView() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mmRef = useRef<Markmap | null>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const selectedRef = useRef<string | null>(null);
  const editingRef = useRef<EditingState | null>(null);
  selectedRef.current = selected;
  editingRef.current = editing;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const findG = (id: string): SVGGElement | null =>
      svg.querySelector<SVGGElement>(
        `g.markmap-node[data-id="${CSS.escape(id)}"]`,
      );

    const textElementOf = (g: SVGGElement): HTMLElement | null => {
      const fo = g.querySelector("foreignObject");
      const inner = fo?.firstElementChild;
      return (inner instanceof HTMLElement ? inner : null) ?? null;
    };

    const rectOfG = (g: SVGGElement): EditRect => {
      const inner = textElementOf(g);
      const fo = g.querySelector("foreignObject");
      const target: Element = inner ?? fo ?? g;
      const r = target.getBoundingClientRect();
      const base: EditRect = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
      if (inner) {
        const cs = window.getComputedStyle(inner);
        base.fontFamily = cs.fontFamily;
        base.fontSize = cs.fontSize;
        base.lineHeight = cs.lineHeight;
        base.paddingLeft = cs.paddingLeft;
        base.paddingRight = cs.paddingRight;
        base.paddingTop = cs.paddingTop;
        base.paddingBottom = cs.paddingBottom;
      }
      return base;
    };

    const refreshMarks = () => {
      svg
        .querySelectorAll<SVGGElement>("g.markmap-node[data-selected]")
        .forEach((g) => g.removeAttribute("data-selected"));
      svg
        .querySelectorAll<SVGGElement>("g.markmap-node[data-editing]")
        .forEach((g) => g.removeAttribute("data-editing"));
      const selId = selectedRef.current;
      if (selId) findG(selId)?.setAttribute("data-selected", "true");
      const editId = editingRef.current?.id;
      if (editId) findG(editId)?.setAttribute("data-editing", "true");
    };

    const injectIds = () => {
      svg.querySelectorAll<SVGGElement>("g.markmap-node").forEach((g) => {
        const datum = (g as unknown as { __data__: unknown }).__data__ as
          | { payload?: { id?: string }; data?: { payload?: { id?: string } } }
          | undefined;
        const id = datum?.payload?.id ?? datum?.data?.payload?.id;
        if (id) g.setAttribute("data-id", id);
      });
      refreshMarks();
    };

    const openEditorOn = (id: string, atEnd: boolean) => {
      const target = findById(useDocStore.getState().mdast, id);
      if (!target) return;
      const g = findG(id);
      if (!g) return;
      setSelected(id);
      setEditing({
        id,
        initial: plainTextOf(target),
        rect: rectOfG(g),
        caretAtEnd: atEnd,
      });
    };

    const applyStructural = (
      source: Root,
      id: string,
      action: StructuralAction,
    ): { next: Root; path: number[] } | null => {
      if (action === "sibling") {
        const r = addSiblingAfter(source, id, "");
        return r ? { next: r.root, path: r.path } : null;
      }
      if (action === "child") {
        const r = addChildLast(source, id, "");
        return r ? { next: r.root, path: r.path } : null;
      }
      const r = outdent(source, id);
      return r ? { next: r.root, path: r.path } : null;
    };

    const structuralFromSelected = (id: string, action: StructuralAction) => {
      const { mdast, setMarkdown } = useDocStore.getState();
      const result = applyStructural(mdast, id, action);
      if (!result) return;
      const openEdit = action !== "outdent" ? true : false;
      pendingFocusRef.current = {
        path: result.path,
        openEdit,
        caretAtEnd: true,
      };
      setMarkdown(markdownFromMdast(result.next), "mindmap");
    };

    const mm = Markmap.create(svg, {
      autoFit: true,
      duration: TRANSITION_MS,
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
      const pending = pendingFocusRef.current;
      pendingFocusRef.current = null;
      void mm.setData(mdastToMarkmap(state.mdast)).then(() => {
        requestAnimationFrame(injectIds);
        if (!pending) return;
        window.setTimeout(() => {
          const node = resolvePath(state.mdast, pending.path);
          if (!node) return;
          const newId = deriveId(node);
          // If user actively deselected during the transition, respect that
          // (unless we explicitly want to open an editor on the new node).
          if (!pending.openEdit && selectedRef.current === null) {
            refreshMarks();
            return;
          }
          setSelected(newId);
          if (pending.openEdit) {
            openEditorOn(newId, pending.caretAtEnd);
          } else {
            refreshMarks();
          }
        }, FOCUS_DELAY_MS);
      });
    });

    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const g = t?.closest?.("g.markmap-node") as SVGGElement | null;
      if (g) {
        const id = g.getAttribute("data-id");
        if (id) setSelected(id);
      } else {
        setSelected(null);
      }
      e.stopPropagation();
    };
    svg.addEventListener("click", onClick, true);

    const onDblClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const g = t?.closest?.("g.markmap-node") as SVGGElement | null;
      if (!g) return;
      const id = g.getAttribute("data-id");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      openEditorOn(id, false);
    };
    svg.addEventListener("dblclick", onDblClick, true);

    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      if (editingRef.current) return;
      const id = selectedRef.current;
      if (!id) return;

      if (e.key === "Enter") {
        e.preventDefault();
        structuralFromSelected(id, "sibling");
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        structuralFromSelected(id, "child");
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        structuralFromSelected(id, "outdent");
      } else if (e.key === " ") {
        e.preventDefault();
        openEditorOn(id, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => {
      void mm.fit();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      svg.removeEventListener("click", onClick, true);
      svg.removeEventListener("dblclick", onDblClick, true);
      unsubscribe();
      mm.destroy();
      mmRef.current = null;
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg
      .querySelectorAll<SVGGElement>("g.markmap-node[data-selected]")
      .forEach((g) => g.removeAttribute("data-selected"));
    if (selected) {
      svg
        .querySelector<SVGGElement>(
          `g.markmap-node[data-id="${CSS.escape(selected)}"]`,
        )
        ?.setAttribute("data-selected", "true");
    }
  }, [selected]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg
      .querySelectorAll<SVGGElement>("g.markmap-node[data-editing]")
      .forEach((g) => g.removeAttribute("data-editing"));
    if (editing) {
      svg
        .querySelector<SVGGElement>(
          `g.markmap-node[data-id="${CSS.escape(editing.id)}"]`,
        )
        ?.setAttribute("data-editing", "true");
    }
  }, [editing]);

  const commit = (text: string, action: CommitAction) => {
    if (!editing) return;
    const { id } = editing;
    const { mdast, setMarkdown } = useDocStore.getState();

    let next: Root = editNodeText(mdast, id, text);
    let structural: { next: Root; path: number[] } | null = null;
    let openEdit = false;
    let caretAtEnd = true;

    if (action === "sibling" || action === "child" || action === "outdent") {
      structural = (() => {
        if (action === "sibling") {
          const r = addSiblingAfter(next, id, "");
          return r ? { next: r.root, path: r.path } : null;
        }
        if (action === "child") {
          const r = addChildLast(next, id, "");
          return r ? { next: r.root, path: r.path } : null;
        }
        const r = outdent(next, id);
        return r ? { next: r.root, path: r.path } : null;
      })();
      if (structural) {
        next = structural.next;
        openEdit = action !== "outdent";
        caretAtEnd = true;
      }
    }

    setEditing(null);

    if (next === mdast) return;

    const focusPath = structural ? structural.path : findPath(next, id);
    if (focusPath) {
      pendingFocusRef.current = {
        path: focusPath,
        openEdit,
        caretAtEnd,
      };
    }
    setMarkdown(markdownFromMdast(next), "mindmap");
  };

  const cancelEdit = () => setEditing(null);

  return (
    <div className="mm-host">
      <svg ref={svgRef} className="mm-svg" tabIndex={-1} />
      {editing ? (
        <NodeEditOverlay
          key={editing.id}
          rect={editing.rect}
          initial={editing.initial}
          caretAtEnd={editing.caretAtEnd}
          onCommit={commit}
          onCancel={cancelEdit}
        />
      ) : null}
    </div>
  );
}
