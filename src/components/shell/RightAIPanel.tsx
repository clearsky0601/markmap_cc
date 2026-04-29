import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../../store/docStore";
import { useUiStore } from "../../store/uiStore";
import { findById, plainTextOf } from "../../sync/mutations";
import { ipc } from "../../tauri/ipc";

// ── Config ────────────────────────────────────────────────────────────

const CONFIG_KEY = "markmap_cc_ai_config_v2";

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const PRESETS: { label: string; baseUrl: string; model: string; hint: string }[] = [
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com",
    model: "gpt-4o",
    hint: "platform.openai.com → API keys",
  },
  {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-6",
    hint: "console.anthropic.com → API keys",
  },
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    hint: "platform.deepseek.com → API keys",
  },
  {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai",
    model: "llama-3.3-70b-versatile",
    hint: "console.groq.com → API keys",
  },
  {
    label: "Ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
    hint: "No API key needed for local Ollama",
  },
];

function loadConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AIConfig;
  } catch {
    return null;
  }
}

function saveConfig(cfg: AIConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ── Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(currentMd: string, contextTexts: string[]): string {
  let prompt = `You are a mindmap editing assistant. The mindmap is stored as Markdown (headings + bullet lists).

Current document:
\`\`\`markdown
${currentMd}
\`\`\`

---

## Response format

**Answering questions / explaining** → reply in plain text, no code block.

**Small targeted edits** (add, rename, delete one or a few nodes) → patch block:
\`\`\`patch
FIND:
<exact text verbatim from document — copy character-for-character including indentation and "- ">
REPLACE:
<replacement text>
\`\`\`
Multiple patches in one block: separate with a \`---\` line.

**Large structural changes** (reorganize, rewrite, merge sections) → full document:
\`\`\`markdown
...complete updated content...
\`\`\`

---

## Markdown list nesting — CRITICAL

List hierarchy is determined **entirely by indentation** (2 spaces per level):

\`\`\`
- Top-level item          (0 spaces)
  - Child item            (2 spaces)
    - Grandchild item     (4 spaces)
\`\`\`

**Adding a CHILD to a list item:**

✗ WRONG — same indent → creates a SIBLING, not a child:
\`\`\`
- Phase A
- new item      ← sibling of Phase A
\`\`\`

✓ CORRECT — 2 more spaces → creates a CHILD:
\`\`\`
- Phase A
  - new item    ← child of Phase A
\`\`\`

When the parent already has children, append at the same indent as existing children:
\`\`\`
- Phase A
  - existing child
  - new child   ← same indent as "existing child"
\`\`\`

---

## Strict rules
1. **Change ONLY what was explicitly requested.** Preserve everything else exactly.
2. FIND text must match the document character-for-character (spaces, dashes, symbols).
3. Never add, remove, or reorder content beyond the request.
4. Never rewrite the whole document for a small single-node change — use a patch.`;

  if (contextTexts.length > 0) {
    prompt += `\n\n---\n\n## User-selected nodes (current focus)\n`;
    for (const t of contextTexts) prompt += `- ${t}\n`;
    prompt += `\nApply edits to these nodes first. For questions, answer in relation to them.`;
  }

  return prompt;
}

// ── Patch handling ─────────────────────────────────────────────────────

interface Patch {
  find: string;
  replace: string;
}

function parsePatches(text: string): Patch[] | null {
  const blockMatch = text.match(/```patch\n([\s\S]*?)```/);
  if (!blockMatch) return null;

  const block = blockMatch[1];
  const segments = block.split(/\n---\n/);
  const patches: Patch[] = [];

  for (const seg of segments) {
    // FIND: up to REPLACE:
    const findMatch = seg.match(/^FIND:\n([\s\S]*?)(?=\nREPLACE:\n)/m);
    // REPLACE: to end of segment
    const replaceMatch = seg.match(/REPLACE:\n([\s\S]*)$/m);
    if (findMatch && replaceMatch) {
      patches.push({
        find: findMatch[1],
        replace: replaceMatch[1].trimEnd(),
      });
    }
  }

  return patches.length > 0 ? patches : null;
}

function applyPatches(markdown: string, patches: Patch[]): string | null {
  let result = markdown;
  for (const p of patches) {
    if (!result.includes(p.find)) return null; // text not found
    result = result.replace(p.find, p.replace);
  }
  return result;
}

function extractFullMd(text: string): string | null {
  const m = text.match(/```(?:markdown)?\n([\s\S]*?)```/);
  return m ? m[1].trimEnd() : null;
}

// ── Components ─────────────────────────────────────────────────────────

interface ConfigPanelProps {
  initial: AIConfig;
  onSave: (cfg: AIConfig) => void;
}

function ConfigPanel({ initial, onSave }: ConfigPanelProps) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  };

  return (
    <div className="ai-config">
      <p className="ai-config__title">AI Provider Settings</p>

      <div className="ai-config__presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`ai-config__preset${baseUrl === p.baseUrl ? " is-on" : ""}`}
            onClick={() => applyPreset(p)}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="ai-config__label">Base URL</label>
      <input
        className="ai-config__input"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="https://api.openai.com"
        spellCheck={false}
      />

      <label className="ai-config__label">Model</label>
      <input
        className="ai-config__input"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="gpt-4o"
        spellCheck={false}
      />

      <label className="ai-config__label">API Key</label>
      <input
        className="ai-config__input"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-… (leave empty for local providers)"
        spellCheck={false}
      />

      <p className="ai-config__hint">
        Uses OpenAI-compatible <code>/chat/completions</code> endpoint.
        Key stored in browser localStorage only.
      </p>

      <button
        className="ai-config__save"
        disabled={!baseUrl.trim() || !model.trim()}
        onClick={() =>
          onSave({ baseUrl: baseUrl.trim(), apiKey, model: model.trim() })
        }
      >
        Save &amp; start chatting
      </button>
    </div>
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
  context?: string[]; // node texts captured at send time
}

interface MessageBubbleProps {
  msg: Message;
  onApplyFull: (md: string) => void;
  onApplyPatch: (patches: Patch[]) => void;
}

function MessageBubble({ msg, onApplyFull, onApplyPatch }: MessageBubbleProps) {
  const patches = msg.role === "assistant" ? parsePatches(msg.content) : null;
  const fullMd =
    msg.role === "assistant" && !patches ? extractFullMd(msg.content) : null;

  const parts = msg.content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`ai-msg ai-msg--${msg.role}`}>
      {/* Context quote embedded in user bubble — like IM "reply to" */}
      {msg.role === "user" && msg.context && msg.context.length > 0 && (
        <div className="ai-msg__quote">
          <span className="ai-msg__quote-icon">◈</span>
          <div className="ai-msg__quote-lines">
            {msg.context.slice(0, 3).map((t, i) => (
              <div key={i} className="ai-msg__quote-line">{t}</div>
            ))}
            {msg.context.length > 3 && (
              <div className="ai-msg__quote-more">+{msg.context.length - 3} more</div>
            )}
          </div>
        </div>
      )}
      <div className="ai-msg__bubble">
        {parts.map((part, i) => {
          const inner = part.match(/```(\w*)\n([\s\S]*?)```/);
          if (inner) {
            return (
              <pre key={i} className="ai-msg__code">
                <code>{inner[2]}</code>
              </pre>
            );
          }
          return part.trim() ? (
            <span key={i} className="ai-msg__text">
              {part}
            </span>
          ) : null;
        })}
      </div>

      {patches ? (
        <button className="ai-msg__apply" onClick={() => onApplyPatch(patches)}>
          Apply patch ({patches.length} change{patches.length > 1 ? "s" : ""})
        </button>
      ) : fullMd ? (
        <button className="ai-msg__apply" onClick={() => onApplyFull(fullMd)}>
          Apply to document
        </button>
      ) : null}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────

export function RightAIPanel() {
  const [config, setConfig] = useState<AIConfig | null>(loadConfig);
  const [showConfig, setShowConfig] = useState(!loadConfig());

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextDismissed, setContextDismissed] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setMarkdown = useDocStore((s) => s.setMarkdown);
  const mdast = useDocStore((s) => s.mdast);
  const selectedNodeIds = useUiStore((s) => s.selectedNodeIds);

  // Reset dismissed chip whenever the selection changes
  useEffect(() => { setContextDismissed(false); }, [selectedNodeIds]);

  const contextTexts = selectedNodeIds
    .map((id) => {
      const node = findById(mdast, id);
      return node ? plainTextOf(node) : null;
    })
    .filter((t): t is string => t !== null && t.trim().length > 0);

  const showContext = !contextDismissed && contextTexts.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSaveConfig = (cfg: AIConfig) => {
    saveConfig(cfg);
    setConfig(cfg);
    setShowConfig(false);
    setMessages([]);
    setError(null);
  };

  const handleApplyFull = (md: string) => {
    setMarkdown(md, "editor");
  };

  const handleApplyPatch = (patches: Patch[]) => {
    const current = useDocStore.getState().markdownText;
    const result = applyPatches(current, patches);
    if (result !== null) {
      setMarkdown(result, "editor");
    } else {
      setError(
        "Patch failed: one or more FIND strings were not found in the document. " +
          "Try rephrasing as a full rewrite.",
      );
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !config) return;
    setInput("");
    setError(null);

    // Snapshot context at send time, then dismiss the input-area chip
    const capturedContext = showContext ? [...contextTexts] : undefined;
    const userMsg: Message = { role: "user", content: text, context: capturedContext };
    const nextMessages: Message[] = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    if (capturedContext) setContextDismissed(true); // context moves into the bubble

    const currentMd = useDocStore.getState().markdownText;
    const systemContent = buildSystemPrompt(
      currentMd,
      showContext ? contextTexts : [],
    );

    const apiMessages = [
      { role: "system", content: systemContent },
      ...nextMessages,
    ];

    try {
      const reply = await ipc.askAi(
        config.baseUrl,
        config.apiKey,
        config.model,
        apiMessages,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(String(e));
      setMessages((prev) => prev.slice(0, -1));
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

  // Config view
  if (showConfig) {
    return (
      <aside className="ai-panel">
        <div className="ai-panel__heading">
          AI Settings
          {config && (
            <button
              className="ai-panel__clear-key"
              onClick={() => setShowConfig(false)}
              title="Back to chat"
            >
              ← back
            </button>
          )}
        </div>
        <div className="ai-chat" style={{ overflowY: "auto" }}>
          <ConfigPanel
            initial={config ?? { baseUrl: "", apiKey: "", model: "" }}
            onSave={handleSaveConfig}
          />
        </div>
      </aside>
    );
  }

  // Chat view
  return (
    <aside className="ai-panel">
      <div className="ai-panel__heading">
        AI
        <span className="ai-panel__model" title={config?.baseUrl}>
          {config?.model ?? ""}
        </span>
        <button
          className="ai-panel__clear-key"
          onClick={() => setShowConfig(true)}
          title="Configure provider"
        >
          ⚙
        </button>
      </div>

      <div className="ai-chat" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ai-chat__empty">
            Ask me to edit, expand, or summarize your mindmap.
            <br />
            <span className="ai-chat__hint">Enter to send · Shift+Enter for newline</span>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            onApplyFull={handleApplyFull}
            onApplyPatch={handleApplyPatch}
          />
        ))}

        {loading ? (
          <div className="ai-msg ai-msg--assistant">
            <div className="ai-msg__bubble ai-msg__bubble--typing">
              <span className="ai-typing" />
            </div>
          </div>
        ) : null}

        {error ? <div className="ai-error">{error}</div> : null}
      </div>

      <div className="ai-input-area">
        {showContext && (
          <div className="ai-quote">
            <div className="ai-quote__accent" />
            <div className="ai-quote__body">
              <div className="ai-quote__head">
                <span className="ai-quote__icon">◈</span>
                <span className="ai-quote__label">
                  {contextTexts.length === 1 ? "Node context" : `${contextTexts.length} nodes selected`}
                </span>
                <button
                  className="ai-quote__dismiss"
                  onClick={() => setContextDismissed(true)}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
              {contextTexts.slice(0, 5).map((text, i) => (
                <div key={i} className="ai-quote__line">{text}</div>
              ))}
              {contextTexts.length > 5 && (
                <div className="ai-quote__more">+{contextTexts.length - 5} more</div>
              )}
            </div>
          </div>
        )}
        <div className="ai-input-row">
          <textarea
            className="ai-input"
            placeholder={showContext ? "Ask about selected nodes…" : "Ask anything…"}
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
      </div>
    </aside>
  );
}
