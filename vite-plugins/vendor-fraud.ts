import type { Plugin } from "vite";
import { getPool, sendJson } from "./db";

// GET /api/siu/vendor-red-flags — "Active Red Flag Alerts" tab on the
// Vendor Fraud Check page. Sourced from vendor_red_flags, written by
// FraudPatternAgent's detect_fraud_patterns for Medium/High/Critical
// severity patterns.
//
// GET /api/siu/vendor-network-signals — "Network Relationship Signals" tab.
// Sourced from vendor_network_signals, written by NetworkAnalysisAgent's
// detect_fraud_rings.
//
// Both are SIU-wide views (no claim/vendor filter on this page today), so
// each route returns every row, newest first.
export function vendorFraudApi(): Plugin {
  return {
    name: "vendor-fraud-api",
    configureServer(server) {
      server.middlewares.use("/api/siu/vendor-red-flags", async (req, res) => {
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        try {
          const result = await db.query(`
            SELECT id, vendor_id, claim_id, alert_type, severity, title, explanation,
                   triggering_logic, related_claim_ids, is_reviewed, is_escalated,
                   reviewed_by, reviewed_at, escalated_at, created_at
            FROM vendor_red_flags
            ORDER BY created_at DESC, id DESC
          `);

          const redFlags = result.rows.map((r) => {
            const row = r as Record<string, unknown>;
            let relatedCount = 0;
            if (row.related_claim_ids) {
              try {
                const parsed = JSON.parse(String(row.related_claim_ids));
                relatedCount = Array.isArray(parsed) ? parsed.length : 0;
              } catch {
                relatedCount = 0;
              }
            }
            return {
              id: Number(row.id),
              vendorId: row.vendor_id ? String(row.vendor_id) : "N/A",
              claimId: row.claim_id ? String(row.claim_id) : null,
              title: row.title ? String(row.title) : String(row.alert_type ?? "Untitled Alert"),
              desc: row.explanation ? String(row.explanation) : "",
              date: row.created_at ? String(row.created_at) : null,
              alertType: row.alert_type ? String(row.alert_type) : "unknown",
              related: relatedCount,
              logic: row.triggering_logic ? String(row.triggering_logic) : "",
              severity: row.severity ? String(row.severity) : "Medium",
              reviewed: Boolean(row.is_reviewed),
              escalated: Boolean(row.is_escalated),
              reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
            };
          });

          sendJson(res, 200, { redFlags });
        } catch (err) {
          console.error("vendor red flags lookup error:", err);
          sendJson(res, 500, { error: "Failed to load vendor red flags" });
        }
      });

      server.middlewares.use("/api/siu/vendor-network-signals", async (req, res) => {
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }
        try {
          const result = await db.query(`
            SELECT id, vendor_id, signal_type, related_entity, related_entity_type,
                   occurrence_count, first_occurrence, last_occurrence, risk_narrative,
                   severity, created_at
            FROM vendor_network_signals
            ORDER BY created_at DESC, id DESC
          `);

          const networkSignals = result.rows.map((r) => {
            const row = r as Record<string, unknown>;
            return {
              id: Number(row.id),
              vendorId: row.vendor_id ? String(row.vendor_id) : "N/A",
              title: row.signal_type ? String(row.signal_type) : "Network Signal",
              severity: row.severity ? String(row.severity) : "Medium",
              entity: row.related_entity ? String(row.related_entity) : "—",
              entityType: row.related_entity_type ? String(row.related_entity_type) : "—",
              occurrences: row.occurrence_count === null || row.occurrence_count === undefined ? 0 : Number(row.occurrence_count),
              note: row.risk_narrative ? String(row.risk_narrative) : "",
            };
          });

          sendJson(res, 200, { networkSignals });
        } catch (err) {
          console.error("vendor network signals lookup error:", err);
          sendJson(res, 500, { error: "Failed to load vendor network signals" });
        }
      });
    },
  };
}
