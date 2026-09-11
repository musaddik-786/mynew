// ─────────────────────────────────────────────────────────────────────────────
// Client helpers for the Vendor Manager Orchestrator (port 9120).
//
// Two trigger paths:
//   1. New vendor  — called from VendorOnboarding after submitApplication();
//                    passes vendor details so orchestrator starts Phase 0.
//   2. Existing vendor — called from VendorDashboard with a claim ID only;
//                    orchestrator calls get_vendors(), finds a match, skips
//                    Phase 0 and starts from Phase 1.
//
// Both paths share the same /chat SSE endpoint and the same history store.
// ─────────────────────────────────────────────────────────────────────────────

import { VENDOR_ORCHESTRATOR_URL } from "@/config/agents";

export interface ChatStreamOptions {
  history?: Array<{ role: string; content: string }>;
  onText?: (chunk: string) => void;
  onToolEvent?: (tool: string, state: "Starting" | "Done") => void;
  signal?: AbortSignal;
}

const TOOL_EVENT_RE = /\[Tool:\s*([^\]]+)\]\s*(Starting|Done)/g;

// ─── Per-session conversation history ────────────────────────────────────────
// Key is either claimId (existing-vendor path) or applicationId (new-vendor path).

type ChatTurn = { role: string; content: string };
const HISTORY_KEY_PREFIX = "vendor-orch-history:";
const MAX_STORED_TURNS = 20;

function historyKey(id: string): string {
  return `${HISTORY_KEY_PREFIX}${id}`;
}

export function getConversation(id: string): ChatTurn[] {
  try {
    const raw = sessionStorage.getItem(historyKey(id));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversation(id: string, turns: ChatTurn[]) {
  try {
    sessionStorage.setItem(historyKey(id), JSON.stringify(turns.slice(-MAX_STORED_TURNS)));
  } catch {
    // sessionStorage unavailable/full
  }
}

export function resetConversation(id: string) {
  try {
    sessionStorage.removeItem(historyKey(id));
  } catch {
    // ignore
  }
}

// ─── SSE streaming ────────────────────────────────────────────────────────────

export async function streamOrchestratorChat(
  message: string,
  opts: ChatStreamOptions = {}
): Promise<string> {
  const resp = await fetch(`${VENDOR_ORCHESTRATOR_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: opts.history ?? [] }),
    signal: opts.signal,
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`Vendor orchestrator error (HTTP ${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleChunk = (chunk: string) => {
    if (opts.onToolEvent) {
      TOOL_EVENT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TOOL_EVENT_RE.exec(chunk)) !== null) {
        opts.onToolEvent(m[1].trim(), m[2] as "Starting" | "Done");
      }
    }
    full += chunk;
    opts.onText?.(chunk);
  };

  const processLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const chunk = (line.startsWith("data: ") ? line.slice(6) : line.slice(5)).replace(/\r$/, "");
    if (!chunk || chunk === "[DONE]") return;
    handleChunk(chunk);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  if (buffer) processLine(buffer);
  return full;
}

// ─── Shared chat-for-session helper ──────────────────────────────────────────

async function chatForSession(
  sessionId: string,
  message: string,
  opts: ChatStreamOptions = {}
): Promise<string> {
  const history = opts.history ?? getConversation(sessionId);
  let accumulated = "";
  try {
    const full = await streamOrchestratorChat(message, {
      ...opts,
      history,
      onText: (chunk) => {
        accumulated += chunk;
        opts.onText?.(chunk);
      },
    });
    const reply = full || accumulated;
    if (reply) {
      saveConversation(sessionId, [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: reply },
      ]);
    }
    return reply;
  } catch (err) {
    if (accumulated) {
      saveConversation(sessionId, [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: accumulated },
      ]);
    }
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Existing-vendor path: user enters a claim ID on the Vendor Dashboard.
// Orchestrator calls get_vendors() → finds match → skips Phase 0 → Phase 1+.
export function runVendorWorkflow(claimId: string, opts?: ChatStreamOptions) {
  resetConversation(claimId);
  return chatForSession(
    claimId,
    `Run the vendor manager workflow for claim ${claimId}`,
    opts
  );
}

// New-vendor path: called from VendorOnboarding after the application is
// submitted. Passes the application ID so the orchestrator can poll its status
// and then continue once a human approves it on the Onboarding page.
export function runVendorWorkflowForNewApplication(
  applicationId: number,
  vendorName: string,
  specialty: string,
  location: string,
  opts?: ChatStreamOptions
) {
  const sessionId = `app-${applicationId}`;
  resetConversation(sessionId);
  return chatForSession(
    sessionId,
    `A new vendor application has been submitted. Application ID: ${applicationId}, vendor name: "${vendorName}", specialty: "${specialty}", location: "${location}". Please resume the vendor workflow once this application is approved on the Onboarding page.`,
    opts
  );
}

// Continue after Phase 0 halt — user has approved the application on the
// Onboarding page and comes back to the chat to resume.
export function continueVendorWorkflow(sessionId: string, opts?: ChatStreamOptions) {
  return chatForSession(
    sessionId,
    `Continue the vendor manager workflow`,
    opts
  );
}
