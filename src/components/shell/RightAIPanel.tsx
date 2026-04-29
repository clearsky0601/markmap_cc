import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../../store/docStore";
import { ipc } from "../../tauri/ipc";

const API_KEY_STORAGE = "markmap_cc_api_key";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Extract the first ```markdown ... ``` block from a string
function extractMarkdown(text: string): string | null {
  const m = text.match(/```(?:markdown)?\n([\s\S]*?)```/);
  return m ? m[1].trimEnd() : null;
}

function MessageBubble({
  msg,
  onApply,
}: {
  msg: Message;
  onApply: (md: string) => void;
}) {
  const md = msg.role === "assistant" ? extractMarkdown(msg.content) : null;

  // Split content so we can render code blocks distinctly
  const parts = msg.content.split(/(```(?:markdown)?\n[\s\S]*?```)/g);

  return (
    <div className={`ai-msg ai-msg--${msg.role}`}>
      <div className="ai-msg__bubble">
        {parts.map((part, i) => {
          const inner = part.match(/```(?:markdown)?\n([\s\S]*?)```/);
          if (inner) {
            return (
              <pre key={i} className="ai-msg__code">
                <code>{inner[1]}</code>
              </pre>
            );
          }
          return part ? (
            <span key={i} className="ai-msg__text">
              {part}
            </span>
          ) : null;
        })}
      </div>
      {md ? (
        <button className="ai-msg__apply" onClick={() => onApply(md)}>
          Apply to document
        </button>
      ) : null}
    </div>
  );
}

export function RightAIPanel() {
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(API_KEY_STORAGE) ?? "",
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setMarkdown = useDocStore((s) => s.setMarkdown);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(scrollToBottom, [messages, loading]);

  const saveKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    localStorage.setItem(API_KEY_STORAGE, k);
    setApiKey(k);
    setKeyDraft("");
  };

  const clearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey("");
    setMessages([]);
    setError(null);
  };

  const applyMarkdown = (md: string) => {
    setMarkdown(md, "editor");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !apiKey) return;
    setInput("");
    setError(null);

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setLoading(true);

    const currentMd = useDocStore.getState().markdownText;
    const system = `You are an AI assistant helping the user edit a mindmap stored as Markdown.

Current document:
\`\`\`markdown
${currentMd}
\`\`\`

When the user asks you to modify the mindmap, respond with the complete updated Markdown in a \`\`\`markdown code block. When answering questions or explaining things, respond normally without a code block. Keep answers concise.`;

    try {
      const reply = await ipc.askAi(apiKey, system, newMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ── No API key: show setup screen ──────────────────────────────────
  if (!apiKey) {
    return (
      <aside className="ai-panel">
        <div className="ai-panel__heading">AI Assistant</div>
        <div className="ai-setup">
          <p className="ai-setup__desc">
            Enter your Anthropic API key to enable AI-powered mindmap editing.
          </p>
          <input
            className="ai-setup__input"
            type="password"
            placeholder="sk-ant-…"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveKey();
            }}
            autoFocus
          />
          <button
            className="ai-setup__btn"
            onClick={saveKey}
            disabled={!keyDraft.trim()}
          >
            Save key
          </button>
          <p className="ai-setup__hint">
            Key is stored in browser localStorage, never sent anywhere except
            Anthropic's API.
          </p>
        </div>
      </aside>
    );
  }

  // ── Chat interface ─────────────────────────────────────────────────
  return (
    <aside className="ai-panel">
      <div className="ai-panel__heading">
        AI
        <button className="ai-panel__clear-key" onClick={clearKey} title="Remove API key">
          ✕ key
        </button>
      </div>

      <div className="ai-chat" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ai-chat__empty">
            Ask me to edit, expand, or summarize your mindmap.
            <br />
            <span className="ai-chat__hint">
              Shift+Enter for newline · Enter to send
            </span>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onApply={applyMarkdown} />
        ))}

        {loading ? (
          <div className="ai-msg ai-msg--assistant">
            <div className="ai-msg__bubble ai-msg__bubble--typing">
              <span className="ai-typing" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="ai-error">{error}</div>
        ) : null}
      </div>

      <div className="ai-input-row">
        <textarea
          className="ai-input"
          placeholder="Ask anything…"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          className="ai-send"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          title="Send (Enter)"
        >
          ↑
        </button>
      </div>
    </aside>
  );
}
