import { useEffect, useRef, useState } from "react";
import type { Root } from "mdast";
import { Markmap } from "markmap-view";
import { useDocStore } from "../../store/docStore";
import { useUiStore } from "../../store/uiStore";
import { mmSvgRef } from "./mmSvgRef";
import { mdastToMarkmap } from "../../sync/mdastToMarkmap";
import {
  addChildLast,
  addSiblingAfter,
  deleteNode,
  editNodeText,
  findById,
  findPath,
  moveNodeAsChild,
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

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TRANSITION_MS = 250;
const FOCUS_DELAY_MS = TRANSITION_MS + 30;

type StructuralAction = "sibling" | "child" | "outdent";

export function MindmapView() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    mmSvgRef.current = svgRef.current;
    return () => { mmSvgRef.current = null; };
  });

  const mmRef = useRef<Markmap | null>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const suppressNextClickRef = useRef(false);
  const boxSelectStartRef = useRef<{ x: number; y: number } | null>(null);

  // `selected` = primary node for keyboard ops; `multiSelected` = all highlighted nodes
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [boxRect, setBoxRect] = useState<BoxRect | null>(null);

  const selectedRef = useRef<string | null>(null);
  const multiSelectedRef = useRef<string[]>([]);
  const editingRef = useRef<EditingState | null>(null);
  selectedRef.current = selected;
  multiSelectedRef.current = multiSelected;
  editingRef.current = editing;

  // Publish multi-selection to store so AI panel can read it
  const setSelectedNodeIds = useUiStore((s) => s.setSelectedNodeIds);
  useEffect(() => {
    setSelectedNodeIds(multiSelected);
  }, [multiSelected, setSelectedNodeIds]);

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
      for (const id of multiSelectedRef.current) {
        findG(id)?.setAttribute("data-selected", "true");
      }
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
      setMultiSelected([id]);
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
      pendingFocusRef.current = {
        path: result.path,
        openEdit: action !== "outdent",
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
          if (!pending.openEdit && selectedRef.current === null) {
            refreshMarks();
            return;
          }
          setSelected(newId);
          setMultiSelected([newId]);
          if (pending.openEdit) {
            openEditorOn(newId, pending.caretAtEnd);
          } else {
            refreshMarks();
          }
        }, FOCUS_DELAY_MS);
      });
    });

    // ── Drag-to-reorder ──────────────────────────────────────────────────
    interface DragState {
      sourceId: string;
      startX: number;
      startY: number;
      active: boolean;
      ghost: HTMLDivElement | null;
      currentTargetId: string | null;
    }
    let drag: DragState | null = null;

    const clearDropTarget = (targetId: string) => {
      svg
        .querySelector<SVGGElement>(
          `g.markmap-node[data-id="${CSS.escape(targetId)}"]`,
        )
        ?.removeAttribute("data-droptarget");
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || editingRef.current) return;
      const t = e.target as Element | null;
      const g = t?.closest?.("g.markmap-node") as SVGGElement | null;
      if (g) {
        // Node click → potential drag-to-reorder
        const id = g.getAttribute("data-id");
        if (!id) return;
        drag = {
          sourceId: id,
          startX: e.clientX,
          startY: e.clientY,
          active: false,
          ghost: null,
          currentTargetId: null,
        };
      } else {
        // Background click → box selection.
        // stopPropagation prevents d3-zoom (markmap pan) from seeing this mousedown.
        e.stopPropagation();
        e.preventDefault();
        boxSelectStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    svg.addEventListener("mousedown", onMouseDown, true);

    const onMouseMove = (e: MouseEvent) => {
      if (drag) {
        // Drag-to-reorder
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.active && dx * dx + dy * dy < 36) return;

        if (!drag.active) {
          drag.active = true;
          const ghost = document.createElement("div");
          ghost.className = "drag-ghost";
          const sourceNode = findById(useDocStore.getState().mdast, drag.sourceId);
          ghost.textContent = sourceNode ? plainTextOf(sourceNode) || "…" : "…";
          document.body.appendChild(ghost);
          drag.ghost = ghost;
        }

        if (drag.ghost) {
          drag.ghost.style.left = `${e.clientX + 14}px`;
          drag.ghost.style.top = `${e.clientY - 10}px`;
        }

        if (drag.ghost) drag.ghost.style.display = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
        if (drag.ghost) drag.ghost.style.display = "";

        const targetG = el?.closest?.("g.markmap-node") as SVGGElement | null;
        const targetId = targetG?.getAttribute("data-id") ?? null;
        const newTarget = targetId && targetId !== drag.sourceId ? targetId : null;

        if (newTarget !== drag.currentTargetId) {
          if (drag.currentTargetId) clearDropTarget(drag.currentTargetId);
          if (newTarget) {
            svg
              .querySelector<SVGGElement>(
                `g.markmap-node[data-id="${CSS.escape(newTarget)}"]`,
              )
              ?.setAttribute("data-droptarget", "true");
          }
          drag.currentTargetId = newTarget;
        }
      } else if (boxSelectStartRef.current) {
        // Box selection — draw rect immediately (1 px threshold avoids single-pixel jitter)
        const s = boxSelectStartRef.current;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          setBoxRect({
            x: Math.min(s.x, e.clientX),
            y: Math.min(s.y, e.clientY),
            w: Math.abs(dx),
            h: Math.abs(dy),
          });
        }
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    const onMouseUp = (e: MouseEvent) => {
      if (drag) {
        const d = drag;
        drag = null;
        d.ghost?.remove();
        if (d.currentTargetId) clearDropTarget(d.currentTargetId);

        if (!d.active || !d.currentTargetId) return;
        suppressNextClickRef.current = true;
        setTimeout(() => { suppressNextClickRef.current = false; }, 0);

        const { mdast, setMarkdown } = useDocStore.getState();
        const result = moveNodeAsChild(mdast, d.sourceId, d.currentTargetId);
        if (!result) return;
        pendingFocusRef.current = {
          path: result.path,
          openEdit: false,
          caretAtEnd: false,
        };
        setMarkdown(markdownFromMdast(result.root), "mindmap");
      } else if (boxSelectStartRef.current) {
        const s = boxSelectStartRef.current;
        boxSelectStartRef.current = null;
        setBoxRect(null);

        const box = {
          left: Math.min(s.x, e.clientX),
          top: Math.min(s.y, e.clientY),
          right: Math.max(s.x, e.clientX),
          bottom: Math.max(s.y, e.clientY),
        };

        // Ignore tiny accidental drags (< 4px in both axes)
        if (box.right - box.left < 4 && box.bottom - box.top < 4) return;

        const hitIds: string[] = [];
        svg.querySelectorAll<SVGGElement>("g.markmap-node[data-id]").forEach((g) => {
          const r = g.getBoundingClientRect();
          if (r.right > box.left && r.left < box.right &&
              r.bottom > box.top && r.top < box.bottom) {
            const id = g.getAttribute("data-id");
            if (id) hitIds.push(id);
          }
        });

        if (hitIds.length > 0) {
          suppressNextClickRef.current = true;
          setTimeout(() => { suppressNextClickRef.current = false; }, 0);
          setSelected(null);
          setMultiSelected(hitIds);
        }
      }
    };
    window.addEventListener("mouseup", onMouseUp);
    // ─────────────────────────────────────────────────────────────────────

    const onClick = (e: MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        e.stopPropagation();
        return;
      }
      const t = e.target as Element | null;
      const g = t?.closest?.("g.markmap-node") as SVGGElement | null;
      const cmdHeld = e.metaKey || e.ctrlKey;

      if (g) {
        const id = g.getAttribute("data-id");
        if (id) {
          if (cmdHeld) {
            // Cmd+Click: toggle node in multi-selection
            setMultiSelected((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            );
            setSelected(id); // keep for keyboard ops
          } else {
            setSelected(id);
            setMultiSelected([id]);
          }
        }
      } else if (!cmdHeld) {
        // Plain click on empty canvas clears selection; Cmd+click on empty does nothing
        setSelected(null);
        setMultiSelected([]);
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
        setMultiSelected([]);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const { mdast, setMarkdown } = useDocStore.getState();
        const result = deleteNode(mdast, id);
        if (!result) return;
        setSelected(null);
        setMultiSelected([]);
        if (result.selectPath) {
          pendingFocusRef.current = {
            path: result.selectPath,
            openEdit: false,
            caretAtEnd: false,
          };
        }
        setMarkdown(markdownFromMdast(result.root), "mindmap");
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const onResize = () => { void mm.fit(); };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      svg.removeEventListener("mousedown", onMouseDown, true);
      svg.removeEventListener("click", onClick, true);
      svg.removeEventListener("dblclick", onDblClick, true);
      unsubscribe();
      mm.destroy();
      mmRef.current = null;
    };
  }, []);

  // Apply data-selected marks whenever multiSelected changes
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg
      .querySelectorAll<SVGGElement>("g.markmap-node[data-selected]")
      .forEach((g) => g.removeAttribute("data-selected"));
    for (const id of multiSelected) {
      svg
        .querySelector<SVGGElement>(
          `g.markmap-node[data-id="${CSS.escape(id)}"]`,
        )
        ?.setAttribute("data-selected", "true");
    }
  }, [multiSelected]);

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
      pendingFocusRef.current = { path: focusPath, openEdit, caretAtEnd };
    }
    setMarkdown(markdownFromMdast(next), "mindmap");
  };

  const cancelEdit = () => setEditing(null);

  return (
    <div className={`mm-host${boxRect ? " is-box-selecting" : ""}`}>
      <svg ref={svgRef} className="mm-svg" tabIndex={-1} />
      {boxRect ? (
        <div
          className="box-select"
          style={{
            left: boxRect.x,
            top: boxRect.y,
            width: boxRect.w,
            height: boxRect.h,
          }}
        />
      ) : null}
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
