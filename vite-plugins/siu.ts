import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";
import type pg from "pg";
import { getPool, sendJson } from "./db";

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// POST /api/siu/decision — the 3 "Fraud Decision" buttons write a canonical
// decision string into siu_evidence_correlation_results.decision for that
// claim: "Approved" (Clear Claim), "Rejected" (Confirm Fraud), or
// "Return to Adjuster" (Inconclusive). That row only exists once
// EvidenceCorrelationAgent has run (the last Phase 2 step, right before the
// HITL gate opens), so 0 rows updated means the investigation hasn't reached
// that gate yet.
async function handleDecision(db: pg.Pool, req: IncomingMessage, res: ServerResponse) {
  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" });
    return;
  }

  const claimId = typeof body.claimId === "string" ? body.claimId.trim() : "";
  const decision = typeof body.decision === "string" ? body.decision.trim() : "";
  if (!claimId || !decision) {
    sendJson(res, 400, { error: "claimId and decision are required" });
    return;
  }

  try {
    const result = await db.query(
      `UPDATE siu_evidence_correlation_results SET decision = $1 WHERE claim_id = $2`,
      [decision, claimId]
    );
    if (result.rowCount === 0) {
      sendJson(res, 404, {
        error: "No evidence correlation results found for this claim yet — run the SIU AI analysis first.",
      });
      return;
    }

    // Write the SIU fraud decision to communication_history so it surfaces
    // in the Adjuster's Follow My Claims → Latest Actions section.
    const subject =
      decision === "Fraud Confirmed"
        ? "SIU Investigation: Fraud Confirmed"
        : "SIU Investigation: Claim Cleared";
    const summary =
      decision === "Fraud Confirmed"
        ? "The Special Investigation Unit has confirmed fraud on this claim. The Adjuster is recommended to Reject the claim."
        : "The Special Investigation Unit has cleared this claim — no fraud detected. The Adjuster is recommended to Accept the claim.";
    await db.query(
      `INSERT INTO communication_history (claim_number, subject, summary, handled_by, communication_date)
       VALUES ($1, $2, $3, $4, NOW())`,
      [claimId, subject, summary, "SIU"]
    ).catch(() => { /* non-fatal — don't block the decision if comm_history insert fails */ });

    sendJson(res, 200, { claimId, decision });
  } catch (err) {
    console.error("siu decision write error:", err);
    sendJson(res, 500, { error: "Failed to save the fraud decision" });
  }
}

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// POST /api/siu/timeline-event — the "Schedule Interview" (Send) and
// "Trigger External Verification" (Trigger Verification) actions write a
// siu_timeline_events row directly from the UI, since neither goes through
// the SIU orchestrator's LLM. Mirrors the shape FraudEscalationAgent /
// FraudResolutionAgent / CaseAssignmentAgent / EvidenceCorrelationAgent
// already write via log_siu_timeline_event.
async function handleTimelineEvent(db: pg.Pool, req: IncomingMessage, res: ServerResponse) {
  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" });
    return;
  }

  const claimId = typeof body.claimId === "string" ? body.claimId.trim() : "";
  const siuCaseId = typeof body.siuCaseId === "string" ? body.siuCaseId.trim() : null;
  const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "Completed";
  if (!claimId || !eventType) {
    sendJson(res, 400, { error: "claimId and eventType are required" });
    return;
  }

  try {
    const eventId = `EVT-${randomDigits(6)}`;
    await db.query(
      `INSERT INTO siu_timeline_events (event_id, siu_case_id, claim_id, event_type, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventId, siuCaseId, claimId, eventType, status, new Date().toISOString()]
    );
    sendJson(res, 200, { eventId, claimId, siuCaseId, eventType, status });
  } catch (err) {
    console.error("siu timeline event write error:", err);
    sendJson(res, 500, { error: "Failed to log the timeline event" });
  }
}

// POST /api/siu/request-additional-proof — mirrors Adjuster's own
// handleRequestAdditionalProof (vite-plugins/adjuster.ts) so the same
// communication_history row shape surfaces in the policyholder's AND
// adjuster's "Follow My Claims" Latest Actions box, just with handled_by
// set to "SIU" instead of "Adjuster" so the actor is attributed correctly.
async function handleRequestAdditionalProof(db: pg.Pool, req: IncomingMessage, res: ServerResponse) {
  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" });
    return;
  }

  const claimId = typeof body.claimId === "string" ? body.claimId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!claimId || !message) {
    sendJson(res, 400, { error: "claimId and message are required" });
    return;
  }

  try {
    const claimR = await db.query(
      `SELECT id, policyholder_name FROM claims WHERE claim_number = $1`,
      [claimId]
    );
    if (claimR.rows.length === 0) {
      sendJson(res, 404, { error: `Claim ${claimId} not found` });
      return;
    }
    const claimRow = claimR.rows[0] as Record<string, unknown>;

    const communicationId = `COMM-PROOF-${claimId}-${Date.now()}`;
    await db.query(
      `INSERT INTO communication_history (
         communication_id, claim_row_id, claim_number, policyholder_name,
         communication_type, direction, subject, summary,
         handled_by, resolution_status, follow_up_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        communicationId,
        claimRow.id,
        claimId,
        claimRow.policyholder_name,
        "Portal",
        "Outbound",
        "Additional Documentation Requested",
        message,
        "SIU",
        "Pending",
        true,
      ]
    );

    sendJson(res, 200, { sent: true, communicationId });
  } catch (err) {
    console.error("siu request-additional-proof write error:", err);
    sendJson(res, 500, { error: "Failed to send the additional proof request" });
  }
}

const INTERVIEW_MODES = new Set(["Video Call", "Phone Call"]);

// POST /api/siu/schedule-interview — same communication_history pattern as
// handleRequestAdditionalProof above, for the "Schedule Interview" action.
async function handleScheduleInterview(db: pg.Pool, req: IncomingMessage, res: ServerResponse) {
  let body: Record<string, unknown>;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" });
    return;
  }

  const claimId = typeof body.claimId === "string" ? body.claimId.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const dateLabel = typeof body.dateLabel === "string" ? body.dateLabel.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!claimId) {
    sendJson(res, 400, { error: "claimId is required" });
    return;
  }
  if (!INTERVIEW_MODES.has(mode)) {
    sendJson(res, 400, { error: "mode must be 'Video Call' or 'Phone Call'" });
    return;
  }
  if (!dateLabel || !time) {
    sendJson(res, 400, { error: "A date and time slot must be selected" });
    return;
  }

  try {
    const claimR = await db.query(
      `SELECT id, policyholder_name FROM claims WHERE claim_number = $1`,
      [claimId]
    );
    if (claimR.rows.length === 0) {
      sendJson(res, 404, { error: `Claim ${claimId} not found` });
      return;
    }
    const claimRow = claimR.rows[0] as Record<string, unknown>;

    const summary = `Interview scheduled via ${mode} on ${dateLabel} at ${time}.${notes ? ` Notes: ${notes}` : ""}`;
    const communicationId = `COMM-INTERVIEW-${claimId}-${Date.now()}`;
    await db.query(
      `INSERT INTO communication_history (
         communication_id, claim_row_id, claim_number, policyholder_name,
         communication_type, direction, subject, summary,
         handled_by, resolution_status, follow_up_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        communicationId,
        claimRow.id,
        claimId,
        claimRow.policyholder_name,
        "Portal",
        "Outbound",
        "Interview Scheduled",
        summary,
        "SIU",
        "Scheduled",
        true,
      ]
    );

    sendJson(res, 200, { sent: true, communicationId });
  } catch (err) {
    console.error("siu schedule-interview write error:", err);
    sendJson(res, 500, { error: "Failed to schedule the interview" });
  }
}

// GET /api/siu/cases[?claimId=...] — the SIU Investigation Workbench queue,
// or (with claimId) a single case refetch — used by the case detail page to
// re-pull Case Header / Fraud Risk Summary fields right after "Run AI
// Analysis" or a Fraud Decision finishes, so the UI reflects what the
// orchestrator just wrote instead of the stale snapshot from when the case
// was first opened.
//
// siu_claim_master is the source of truth for "which claims are in SIU"
// (written by FraudEscalationAgent's forward_to_siu). It only carries
// claim_id/stage/status/loss_type/fraud_flag though, so we join out to the
// other SIU/shared tables for everything the workbench card and detail
// header actually display: the case id + investigator (siu_case_master),
// the policyholder name (claims), the latest fraud score
// (fraud_risk_snapshots, one snapshot per recompute — take the newest), who
// referred the claim to SIU — raw siu_escalation_records.escalated_by, shown
// verbatim as "Referral Source" — the recorded human fraud decision if any
// (siu_evidence_correlation_results.decision), every fraud typology flag
// FraudPatternAgent has written for this claim (fraud_risk_flags_output —
// "Key Fraud Indicators" on the detail page), and the per-agent "Summary"
// metrics: EntityRelationshipAgent's risk score (fraud_network_graph.risk_score),
// NetworkAnalysisAgent's ring_detected (siu_network_analysis_results),
// BehavioralAnalyticsAgent's anomaly_score / tone_shift_detected /
// timing_anomaly_detected (siu_behavioral_analysis, joined via
// siu_case_master.siu_case_id since that table has no claim_id column),
// EvidenceCorrelationAgent's corroboration_score + overall_finding
// (siu_evidence_correlation_results), SIUClosureAgent's
// stage/progress_percent (siu_progress_tracker) for "Progress Tracking",
// and every siu_timeline_events row for "Timeline View" — the frontend maps
// each row's event_type onto one of the 6 fixed timeline stages and colors
// that stage green; stages with no matching row stay grey/pending.
export function siuApi(): Plugin {
  return {
    name: "siu-api",
    configureServer(server) {
      server.middlewares.use("/api/siu/decision", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST required" });
          return;
        }
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        await handleDecision(db, req, res);
      });

      server.middlewares.use("/api/siu/timeline-event", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST required" });
          return;
        }
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        await handleTimelineEvent(db, req, res);
      });

      server.middlewares.use("/api/siu/request-additional-proof", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST required" });
          return;
        }
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        await handleRequestAdditionalProof(db, req, res);
      });

      server.middlewares.use("/api/siu/schedule-interview", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST required" });
          return;
        }
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        await handleScheduleInterview(db, req, res);
      });

      server.middlewares.use("/api/siu/cases", async (req, res) => {
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }

        const reqUrl = new URL(req.url ?? "", "http://localhost");
        const claimId = reqUrl.searchParams.get("claimId");

        try {
          const result = await db.query(
            `
            SELECT
              scm.claim_id,
              scm.fraud_flag,
              scm.loss_type,
              scm.status        AS claim_status,
              scm.stage,
              scm.created_at,
              sc.siu_case_id,
              sc.assigned_investigator,
              sc.status          AS case_status,
              c.policyholder_name,
              frs.fraud_score,
              ser.escalated_by,
              sec.decision,
              sec.corroboration_score,
              sec.overall_finding,
              frfo.flags         AS fraud_risk_flags,
              fng.risk_score     AS entity_risk_score,
              snar.ring_detected,
              snar.ring_risk_score,
              sba.anomaly_score,
              sba.tone_shift_detected,
              sba.timing_anomaly_detected,
              spt.stage          AS progress_stage,
              spt.progress_percent,
              ste.events         AS timeline_events,
              adr.final_settlement_amount,
              adr.settlement_amount
            FROM siu_claim_master scm
            LEFT JOIN siu_case_master sc ON sc.claim_id = scm.claim_id
            LEFT JOIN claims c ON c.claim_number = scm.claim_id
            LEFT JOIN LATERAL (
              SELECT fraud_score FROM fraud_risk_snapshots
              WHERE claim_id = scm.claim_id
              ORDER BY id DESC LIMIT 1
            ) frs ON true
            LEFT JOIN LATERAL (
              SELECT escalated_by FROM siu_escalation_records
              WHERE claim_id = scm.claim_id
              ORDER BY id DESC LIMIT 1
            ) ser ON true
            LEFT JOIN siu_evidence_correlation_results sec ON sec.claim_id = scm.claim_id
            LEFT JOIN LATERAL (
              SELECT json_agg(
                json_build_object('riskFlag', risk_flag, 'severity', severity, 'reason', reason)
                ORDER BY id DESC
              ) AS flags
              FROM fraud_risk_flags_output
              WHERE claim_id = scm.claim_id
            ) frfo ON true
            LEFT JOIN LATERAL (
              SELECT risk_score FROM fraud_network_graph
              WHERE claim_id = scm.claim_id AND risk_score IS NOT NULL
              ORDER BY id DESC LIMIT 1
            ) fng ON true
            LEFT JOIN LATERAL (
              SELECT ring_detected, ring_risk_score FROM siu_network_analysis_results
              WHERE claim_id = scm.claim_id
              ORDER BY id DESC LIMIT 1
            ) snar ON true
            LEFT JOIN LATERAL (
              SELECT anomaly_score, tone_shift_detected, timing_anomaly_detected
              FROM siu_behavioral_analysis
              WHERE siu_case_id = sc.siu_case_id
              ORDER BY id DESC LIMIT 1
            ) sba ON true
            LEFT JOIN LATERAL (
              SELECT stage, progress_percent FROM siu_progress_tracker
              WHERE claim_id = scm.claim_id
              ORDER BY id DESC LIMIT 1
            ) spt ON true
            LEFT JOIN LATERAL (
              SELECT final_settlement_amount, settlement_amount
              FROM ai_decision_recommendations
              WHERE claim_id = scm.claim_id
              ORDER BY id DESC LIMIT 1
            ) adr ON true
            LEFT JOIN LATERAL (
              SELECT json_agg(
                json_build_object('eventType', event_type, 'status', status, 'timestamp', timestamp)
                ORDER BY id ASC
              ) AS events
              FROM siu_timeline_events
              WHERE claim_id = scm.claim_id
            ) ste ON true
            ${claimId ? "WHERE scm.claim_id = $1" : ""}
            ORDER BY scm.created_at DESC
            `,
            claimId ? [claimId] : []
          );

          const cases = result.rows.map((r) => {
            const row = r as Record<string, unknown>;

            // Claim Amount — the adjuster-approved final settlement
            // (ai_decision_recommendations.final_settlement_amount), falling
            // back to the AI-recommended settlement_amount if the adjuster
            // hasn't saved a final figure yet.
            const claimAmountRaw = row.final_settlement_amount ?? row.settlement_amount;
            const claimAmount = claimAmountRaw === null || claimAmountRaw === undefined ? null : Number(claimAmountRaw);

            return {
              siuId: row.siu_case_id ? String(row.siu_case_id) : `PENDING-${row.claim_id}`,
              claimId: String(row.claim_id),
              fraud: row.fraud_score === null || row.fraud_score === undefined ? 0 : Number(row.fraud_score),
              policyholder: row.policyholder_name ? String(row.policyholder_name) : "Unknown",
              investigator: row.assigned_investigator ? String(row.assigned_investigator) : "Unassigned",
              status: row.case_status ? String(row.case_status) : row.claim_status ? String(row.claim_status) : "Open",
              lossType: row.loss_type ? String(row.loss_type) : "—",
              referral: row.escalated_by ? String(row.escalated_by) : "—",
              decision: row.decision ? String(row.decision) : null,
              claimAmount,
              fraudRiskFlags: Array.isArray(row.fraud_risk_flags) ? row.fraud_risk_flags : [],
              fraudSummary: {
                entityRiskScore: row.entity_risk_score === null || row.entity_risk_score === undefined ? null : Number(row.entity_risk_score),
                ringDetected: row.ring_detected === null || row.ring_detected === undefined ? null : Boolean(row.ring_detected),
                ringRiskScore: row.ring_risk_score === null || row.ring_risk_score === undefined ? null : Number(row.ring_risk_score),
                anomalyScore: row.anomaly_score === null || row.anomaly_score === undefined ? null : Number(row.anomaly_score),
                toneShiftDetected: row.tone_shift_detected === null || row.tone_shift_detected === undefined ? null : Boolean(row.tone_shift_detected),
                timingAnomalyDetected: row.timing_anomaly_detected === null || row.timing_anomaly_detected === undefined ? null : Boolean(row.timing_anomaly_detected),
                corroborationScore: row.corroboration_score === null || row.corroboration_score === undefined ? null : Number(row.corroboration_score),
                overallFinding: row.overall_finding ? String(row.overall_finding) : null,
              },
              progress: {
                stage: row.progress_stage ? String(row.progress_stage) : null,
                percent: row.progress_percent === null || row.progress_percent === undefined ? null : Number(row.progress_percent),
              },
              timelineEvents: Array.isArray(row.timeline_events) ? row.timeline_events : [],
              caseOpenedAt: row.created_at ? String(row.created_at) : null,
              fraudFlag: row.fraud_flag === null || row.fraud_flag === undefined ? 0 : Number(row.fraud_flag),
            };
          });

          sendJson(res, 200, { cases });
        } catch (err) {
          console.error("siu cases lookup error:", err);
          sendJson(res, 500, { error: "Failed to load SIU cases" });
        }
      });
    },
  };
}
