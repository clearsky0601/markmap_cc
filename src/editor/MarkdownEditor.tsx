import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { useDocStore } from "../store/docStore";

const SYNC_USER_EVENT = "sync.fromStore";

export function MarkdownEditor() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastAppliedRev = useRef<number>(-1);

  useEffect(() => {
    if (!hostRef.current) return;

    const initialDoc = useDocStore.getState().markdownText;
    lastAppliedRev.current = useDocStore.getState().originRev;

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const isOurSync = update.transactions.some(
        (tr) => tr.annotation(Transaction.userEvent) === SYNC_USER_EVENT,
      );
      if (isOurSync) return;
      const text = update.state.doc.toString();
      const { setMarkdown, originRev } = useDocStore.getState();
      lastAppliedRev.current = originRev + 1;
      setMarkdown(text, "editor");
    });

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px" },
            ".cm-scroller": {
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              lineHeight: "1.55",
            },
            ".cm-content": { padding: "12px 16px" },
          }),
          EditorView.lineWrapping,
          updateListener,
        ],
      }),
    });
    viewRef.current = view;

    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (state.originRev === prev.originRev) return;
      if (state.lastOrigin === "editor") return;
      if (state.originRev === lastAppliedRev.current) return;

      const current = view.state.doc.toString();
      if (current === state.markdownText) return;

      lastAppliedRev.current = state.originRev;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: state.markdownText },
        annotations: Transaction.userEvent.of(SYNC_USER_EVENT),
      });
    });

    return () => {
      unsubscribe();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="cm-host" />;
}
