import { useEffect, useRef, useState } from "react";
import { Bot, User, Loader2, Send, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { streamOrchestratorChat, getConversation, resetConversation } from "@/lib/vendor-orchestrator";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  sessionId: string;
  initialMessage: string;
  title?: string;
  onReset?: () => void;
  /**
   * When set, this message is sent to the orchestrator automatically — even if
   * the chat already has prior history. Used by the Approve button to resume
   * the workflow without requiring the user to type anything.
   */
  pendingMessage?: string;
}

export default function VendorOrchestratorChat({ sessionId, initialMessage, title = "Vendor Manager Orchestrator", onReset, pendingMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const pendingRef = useRef<string | undefined>(undefined);

  // Keep messagesRef in sync so effects that fire asynchronously see current messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-start with the initial message on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Restore prior conversation from sessionStorage if one exists
    const prior = getConversation(sessionId);
    if (prior.length > 0) {
      const restoredMsgs = prior.map((t) => ({ role: t.role as "user" | "assistant", content: t.content }));
      messagesRef.current = restoredMsgs;
      setMessages(restoredMsgs);
      // If pendingMessage was already set at mount time, send it now on top of restored history
      if (pendingMessage) {
        pendingRef.current = pendingMessage;
        sendMessage(pendingMessage, restoredMsgs);
      }
      return;
    }

    // Fresh session — send pendingMessage if provided, else the initial trigger
    const firstMsg = pendingMessage || initialMessage;
    if (pendingMessage) pendingRef.current = pendingMessage;
    sendMessage(firstMsg, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the parent updates pendingMessage AFTER the chat is already mounted
  // (e.g. Approve button clicked while the chat panel is visible), send it
  // automatically without requiring user input.
  useEffect(() => {
    if (!pendingMessage || pendingMessage === pendingRef.current || busy || !startedRef.current) return;
    pendingRef.current = pendingMessage;
    sendMessage(pendingMessage, messagesRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  async function sendMessage(text: string, currentMessages: Message[]) {
    if (!text.trim() || busy) return;

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    const updated = [...currentMessages, userMsg, assistantMsg];
    setMessages(updated);
    setBusy(true);

    const history = getConversation(sessionId);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamOrchestratorChat(text, {
        history,
        signal: ctrl.signal,
        onText: (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        },
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            copy[copy.length - 1] = {
              ...last,
              content: last.content || "⚠ Could not reach the vendor orchestrator. Make sure it is running on port 9120.",
              streaming: false,
            };
          }
          return copy;
        });
      }
    } finally {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      });
      setBusy(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage(text, messages);
  }

  function handleReset() {
    abortRef.current?.abort();
    resetConversation(sessionId);
    setMessages([]);
    startedRef.current = false;
    onReset?.();
    // Re-trigger auto-start
    setTimeout(() => {
      startedRef.current = false;
      sendMessage(initialMessage, []);
    }, 100);
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-violet-700 to-indigo-700">
        <div className="flex items-center gap-2.5">
          <Bot className="h-4 w-4 text-white" />
          <span className="text-white font-extrabold text-sm">{title}</span>
          {busy && <Loader2 className="h-3.5 w-3.5 text-white/70 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-white/70 hover:text-white transition-colors"
            title="Restart workflow"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-white/70 hover:text-white transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[320px] max-h-[520px] bg-slate-50/40">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-slate-400 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Starting workflow…
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center mt-0.5">
                    <Bot className="h-4 w-4 text-violet-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="whitespace-pre-wrap break-words">
                      {m.content || " "}
                      {m.streaming && <span className="inline-block w-1.5 h-3.5 bg-violet-500 animate-pulse ml-0.5 rounded-sm align-middle" />}
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && (
                  <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-slate-200 flex items-center justify-center mt-0.5">
                    <User className="h-4 w-4 text-slate-600" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 bg-white flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              placeholder={busy ? "Orchestrator is running…" : "Type your reply…"}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button
              onClick={handleSend}
              disabled={busy || !input.trim()}
              className="flex-shrink-0 h-9 w-9 rounded-lg bg-violet-600 flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
