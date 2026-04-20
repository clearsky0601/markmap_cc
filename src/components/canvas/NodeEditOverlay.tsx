import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CommitAction = "none" | "sibling" | "child" | "outdent";

export interface EditRect {
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
}

interface Props {
  rect: EditRect;
  initial: string;
  caretAtEnd: boolean;
  onCommit: (text: string, action: CommitAction) => void;
  onCancel: () => void;
}

export function NodeEditOverlay({
  rect,
  initial,
  caretAtEnd,
  onCommit,
  onCancel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const composing = useRef(false);
  const committed = useRef(false);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (caretAtEnd) {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    } else {
      el.select();
    }
  }, [caretAtEnd]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const commit = (action: CommitAction) => {
    if (committed.current) return;
    committed.current = true;
    onCommit(value, action);
  };

  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return createPortal(
    <textarea
      ref={ref}
      className="node-edit"
      value={value}
      rows={1}
      spellCheck={false}
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 60),
        minHeight: rect.height,
        fontFamily: rect.fontFamily,
        fontSize: rect.fontSize,
        lineHeight: rect.lineHeight,
        paddingLeft: rect.paddingLeft,
        paddingRight: rect.paddingRight,
        paddingTop: rect.paddingTop,
        paddingBottom: rect.paddingBottom,
      }}
      onChange={(e) => setValue(e.target.value)}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onKeyDown={(e) => {
        if (composing.current) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit("none");
        } else if (e.key === "Tab" && !e.shiftKey) {
          e.preventDefault();
          commit("child");
        } else if (e.key === "Tab" && e.shiftKey) {
          e.preventDefault();
          commit("outdent");
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
        // Shift+Enter falls through → textarea inserts newline natively
      }}
      onBlur={() => commit("none")}
    />,
    document.body,
  );
}
