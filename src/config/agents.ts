// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all agent / orchestrator / MCP service base URLs.
//
// To change a port, change it HERE (or via the matching VITE_* env var) — every
// component imports these constants instead of hard-coding a URL.
// ─────────────────────────────────────────────────────────────────────────────

import type { PersonaId } from "@/lib/personas";

const env = import.meta.env as Record<string, string | undefined>;

// MCP tool servers — the policyholder and adjuster personas talk to different
// MCP backends, so there is one base URL per persona.
export const POLICYHOLDER_MCP_URL =
  env.VITE_POLICYHOLDER_MCP_URL ?? "http://10.4.173.132:7720";   //"http://10.4.173.132:7720";
// export const ADJUSTER_MCP_URL =
//   env.VITE_ADJUSTER_MCP_URL ?? "http://localhost:6190";
export const ADJUSTER_MCP_URL =
  env.VITE_ADJUSTER_MCP_URL ?? "http://10.4.173.135:5800";   //"http://10.4.173.135:5800"

// Resolve the MCP base for the active persona. Components shared across personas
// should call this with the current persona id (from usePersona()).
export function mcpUrlForPersona(personaId: PersonaId): string {
  return personaId === "adjuster" ? ADJUSTER_MCP_URL : POLICYHOLDER_MCP_URL;
}

// FNOL intake orchestrator / agent (Smart Loss Reporting flow)
export const FNOL_ORCHESTRATOR_URL =
  env.VITE_FNOL_ORCHESTRATOR_URL ?? "http://10.4.173.133:7730";   //"http://10.4.173.133:7730";
export const FNOL_AGENT_URL = env.VITE_FNOL_AGENT_URL ?? "http://10.4.173.133:7730"; //"http://10.4.173.133:7730";

// Adjuster orchestrator — full Claim Intake → Settlement journey (15 agents + HITL gates)
export const ADJUSTER_ORCHESTRATOR_URL =
  env.VITE_ADJUSTER_ORCHESTRATOR_URL ?? "http://10.4.173.134:8920";  //"http://10.4.173.134:8920"

// HITL approval gate endpoints (GET .../approvals/pending, POST .../approvals/{id}/decide).
// As of 2026-07-16 these are hosted locally in AdjusterAgents' own MCP server
// (port 5800, same process as the 15 agent tools) — no longer OrchestratorAgent
// (port 9200). Deliberately a separate constant from ADJUSTER_MCP_URL above
// (which defaults to a different, currently-incorrect port) rather than reusing it.
export const ADJUSTER_ORCHESTRATION_MCP_URL =
  env.VITE_ADJUSTER_ORCHESTRATION_MCP_URL ?? "http://10.4.173.135:5800/api/v1/orchestration"; //"http://10.4.173.135:5800/api/v1/orchestration";

// SIU orchestrator — Fraud Intake → Fraud Investigation → Fraud Resolution
// journey (12 agents + 1 HITL gate after EvidenceCorrelationAgent).
export const SIU_ORCHESTRATOR_URL =
  env.VITE_SIU_ORCHESTRATOR_URL ?? "http://10.4.173.137:9020"; // "http://10.4.173.137:9020"

// HITL approval gate endpoints for the SIU persona (GET .../approvals/pending,
// POST .../approvals/{id}/decide) — hosted on the SIU MCP server itself
// (port 9000, same process as the 12 agent tools), same pattern as
// ADJUSTER_ORCHESTRATION_MCP_URL above.
export const SIU_ORCHESTRATION_MCP_URL =
  env.VITE_SIU_ORCHESTRATION_MCP_URL ?? "http://10.4.173.140:9000/api/v1/orchestration";  //"http://10.4.173.136:9000/api/v1/orchestration";

// Vendor Manager orchestrator — full vendor lifecycle (10 agents, Phase 0–9)
export const VENDOR_ORCHESTRATOR_URL =
  env.VITE_VENDOR_ORCHESTRATOR_URL ?? "http://10.4.173.139:9120";    //"http://10.4.173.139:9120"

// HITL approval gate endpoints for the Vendor persona — hosted on the Vendor
// MCP server (port 9100, same process as the 10 agent tools).
export const VENDOR_ORCHESTRATION_MCP_URL =
  env.VITE_VENDOR_ORCHESTRATION_MCP_URL ?? "http://10.4.173.138:9100/api/v1/orchestration";  //"http://10.4.173.138:9100/api/v1/orchestration"
