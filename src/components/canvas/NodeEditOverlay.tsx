import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  rect: { left: number; top: number; width: number; height: number };
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function NodeEditOverlay({ rect, initial, onCommit, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const committed = useRef(false);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return createPortal(
    <input
      ref={inputRef}
      className="node-edit"
      value={value}
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 80),
        height: rect.height,
      }}
      onChange={(e) => setValue(e.target.value)}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !composing.current) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
    />,
    document.body,
  );
}
