import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";
import { getPool, sendJson } from "./db";

// All Vendor Manager persona endpoints, mounted under /api/vendor. Queries
// the same Azure Postgres tables the VendorManagerAgents Python backend
// uses (vendor_master_input, vendor_performance_score_output,
// sla_tracker_output, cost_variance_output, vendor_rating_input,
// vendor_applications, vendor_jobs_input, escalation_log_output,
// vendor_cost_input) directly — this frontend does not call the Python
// FastAPI/MCP agents, matching the existing pattern in claims.ts/adjuster.ts.

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function daysSince(dateStr: unknown): number | null {
  if (!dateStr) return null;
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function licenseStatus(expiry: unknown): string {
  if (!expiry) return "Unknown";
  const d = new Date(String(expiry));
  if (Number.isNaN(d.getTime())) return "Unknown";
  const daysLeft = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return "Expired";
  if (daysLeft <= 60) return "Expiring Soon";
  return "Active";
}

function riskBand(escalationCount: number, variance: number | null, slaCompliance: number | null) {
  const absVariance = variance === null ? null : Math.abs(variance);
  if (escalationCount >= 2) return { risk: "High", reason: `${escalationCount} open escalations` };
  if (absVariance !== null && absVariance > 20) {
    return { risk: "High", reason: `Cost variance ${variance! > 0 ? "+" : ""}${variance!.toFixed(1)}%` };
  }
  if (slaCompliance !== null && slaCompliance < 75) {
    return { risk: "High", reason: `SLA compliance ${slaCompliance}%` };
  }
  if (escalationCount === 1) return { risk: "Medium", reason: "1 open escalation" };
  if (absVariance !== null && absVariance > 10) {
    return { risk: "Medium", reason: `Cost variance ${variance! > 0 ? "+" : ""}${variance!.toFixed(1)}%` };
  }
  if (slaCompliance !== null && slaCompliance < 85) {
    return { risk: "Medium", reason: `SLA compliance ${slaCompliance}%` };
  }
  return { risk: "Low", reason: "No anomaly detected" };
}

export function vendorApi(): Plugin {
  return {
    name: "vendor-api",
    configureServer(server) {
      server.middlewares.use("/api/vendor", async (req: IncomingMessage, res: ServerResponse) => {
        const db = getPool();
        if (!db) {
          sendJson(res, 500, { error: "Database is not configured" });
          return;
        }

        const url = new URL(req.url ?? "/", "http://localhost");
        const route = url.pathname.replace(/\/+$/, "") || "/";

        try {
          // ── Dashboard / Performance shared overview ──────────────────
          if (route === "/overview") {
            const result = await db.query(`
              SELECT
                vm.vendor_id AS "vendorId",
                vm.name,
                vm.specialty,
                vm.location,
                vm.status,
                COALESCE(vp.vis, vm.vis_score) AS vis,
                st.sla_compliance AS "slaCompliance",
                st.avg_completion_time AS "avgCompletionTime",
                cv.variance,
                r.rating
              FROM vendor_master_input vm
              LEFT JOIN vendor_performance_score_output vp ON vp.vendor_id = vm.vendor_id
              LEFT JOIN sla_tracker_output st ON st.vendor_id = vm.vendor_id
              LEFT JOIN cost_variance_output cv ON cv.vendor_id = vm.vendor_id
              LEFT JOIN (
                SELECT vendor_id, AVG(rating) AS rating FROM vendor_rating_input GROUP BY vendor_id
              ) r ON r.vendor_id = vm.vendor_id
              ORDER BY vis DESC NULLS LAST, vm.name
            `);
            sendJson(res, 200, { vendors: result.rows });
            return;
          }

          // ── Cost vs Estimate Variance (Dashboard + Cost Analytics) ───
          if (route === "/cost-variance") {
            const result = await db.query(`
              SELECT cv.vendor_id AS "vendorId", vm.name AS vendor,
                     cv.avg_estimate AS "avgEst", cv.avg_actual AS "avgActual", cv.variance
              FROM cost_variance_output cv
              JOIN vendor_master_input vm ON vm.vendor_id = cv.vendor_id
              WHERE cv.variance IS NOT NULL
              ORDER BY cv.variance DESC
            `);
            sendJson(res, 200, { costVariances: result.rows });
            return;
          }

          // ── Deactivated / Ineligible Vendors ──────────────────────────
          if (route === "/deactivated") {
            const result = await db.query(`
              SELECT vendor_id AS id, name, deactivation_mode AS mode, deactivation_reason AS reason
              FROM vendor_master_input
              WHERE status <> 'Active' OR assignment_eligible <> 'Yes'
              ORDER BY deactivated_at DESC NULLS LAST, name
            `);
            const deactivated = result.rows.map((r) => ({
              id: r.id,
              name: r.name,
              immediate: r.mode === "Deactivated Immediately",
              reason: r.reason ?? null,
            }));
            sendJson(res, 200, { deactivated });
            return;
          }

          // ── Recent Vendor Activity (jobs + escalations, unioned) ─────
          if (route === "/activity") {
            const result = await db.query(`
              SELECT * FROM (
                SELECT vj.claim_id AS "claimId", vm.name AS vendor,
                       vj.assigned_date AS date, COALESCE(vj.status, 'Assigned') AS status,
                       js.escalation_flag AS "escalationFlag", js.priority::TEXT AS "escalationPriority"
                FROM vendor_jobs_input vj
                JOIN vendor_master_input vm ON vm.vendor_id = vj.vendor_id
                LEFT JOIN job_status_update_output js ON js.claim_id = vj.claim_id
                UNION ALL
                SELECT el.claim_id AS "claimId", vm.name AS vendor,
                       el.date AS date, 'Escalated' AS status,
                       'true' AS "escalationFlag", el.severity::TEXT AS "escalationPriority"
                FROM escalation_log_output el
                JOIN vendor_master_input vm ON vm.vendor_id = el.vendor_id
              ) activity
              ORDER BY date DESC NULLS LAST
              LIMIT 20
            `);
            sendJson(res, 200, { activity: result.rows });
            return;
          }

          // ── Dispatch: work orders ─────────────────────────────────────
          // work_orders has no vendor_id column — it tracks expert assignments,
          // not vendor assignments. Filter only by claim_number (claimId param).
          if (route === "/work-orders") {
            const claimId = url.searchParams.get("claimId");
            const params: string[] = [];
            const where = claimId ? (params.push(claimId), `WHERE wo.claim_number = $1`) : "";
            const result = await db.query(`
              SELECT wo.id AS "workOrderId", wo.work_order_id AS "workOrderRef",
                     wo.claim_number AS "claimId",
                     wo.expert_id AS "expertId", wo.expert_name AS "expertName",
                     wo.expert_type AS "expertType",
                     wo.scheduled_date AS "scheduledDate", wo.scheduled_time AS "scheduledTime",
                     wo.priority, wo.status, wo.estimated_cost AS "estimatedCost",
                     wo.assigned_by AS "assignedBy", wo.notes_to_expert AS "notes",
                     wo.created_at AS "createdAt"
              FROM work_orders wo
              ${where}
              ORDER BY wo.created_at DESC NULLS LAST
            `, params);
            sendJson(res, 200, { workOrders: result.rows });
            return;
          }

          // ── Dispatch: dispatch logs audit trail ───────────────────────
          // dispatch_logs.work_order_id is the TEXT work order ref (WO-xxxxxx),
          // while the UI passes the integer PK from work_orders.id.
          // Look up the text ref first, then query dispatch_logs.
          if (route === "/dispatch-logs") {
            const workOrderPk = url.searchParams.get("workOrderId");
            let dispatchLogsResult;
            if (workOrderPk) {
              const refRow = await db.query(
                `SELECT work_order_id FROM work_orders WHERE id = $1`,
                [workOrderPk]
              );
              const workOrderRef = refRow.rows[0]?.work_order_id ?? null;
              dispatchLogsResult = workOrderRef
                ? await db.query(`
                    SELECT dl.id, dl.work_order_id AS "workOrderRef", dl.action AS status,
                           dl.action_by AS "changedBy", dl.details AS notes,
                           dl.timestamp AS "changedAt"
                    FROM dispatch_logs dl
                    WHERE dl.work_order_id = $1
                    ORDER BY dl.timestamp DESC NULLS LAST
                    LIMIT 50
                  `, [workOrderRef])
                : { rows: [] };
            } else {
              dispatchLogsResult = await db.query(`
                SELECT dl.id, dl.work_order_id AS "workOrderRef", dl.action AS status,
                       dl.action_by AS "changedBy", dl.details AS notes,
                       dl.timestamp AS "changedAt"
                FROM dispatch_logs dl
                ORDER BY dl.timestamp DESC NULLS LAST
                LIMIT 50
              `);
            }
            sendJson(res, 200, { dispatchLogs: dispatchLogsResult.rows });
            return;
          }

          // ── Expert estimates submitted by field expert post-dispatch ──────────
          if (route === "/expert-estimates") {
            const claimNumber = url.searchParams.get("claimNumber");
            const result = await db.query(`
              SELECT ee.id, ee.claim_number AS "claimNumber", ee.work_order_id AS "workOrderId",
                     ee.expert_id AS "expertId", ee.expert_name AS "expertName",
                     ee.expert_type AS "expertType",
                     ee.repair_net_payable AS "repairNetPayable",
                     ee.replacement_net_payable AS "replacementNetPayable",
                     ee.notes, ee.submitted_at AS "submittedAt"
              FROM expert_estimates ee
              ${claimNumber ? "WHERE ee.claim_number = $1" : ""}
              ORDER BY ee.submitted_at DESC NULLS LAST
              LIMIT 50
            `, claimNumber ? [claimNumber] : []);
            sendJson(res, 200, { expertEstimates: result.rows });
            return;
          }

          // ── ETA Prediction: predicted ETAs ────────────────────────────
          if (route === "/eta-predictions") {
            const vendorId = url.searchParams.get("vendorId");
            const claimId = url.searchParams.get("claimId");
            const conditions: string[] = [];
            const params: string[] = [];
            if (vendorId) { params.push(vendorId); conditions.push(`ep.vendor_id = $${params.length}`); }
            if (claimId) { params.push(claimId); conditions.push(`ep.claim_id = $${params.length}`); }
            const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
            const result = await db.query(`
              SELECT ep.claim_id AS "claimId", ep.vendor_id AS "vendorId",
                     COALESCE(vm.name, ep.vendor_id) AS vendor,
                     ep.predicted_eta_days AS "predictedEtaDays",
                     ep.confidence, ep.factors, ep.predicted_at AS "createdAt"
              FROM eta_predictions ep
              LEFT JOIN vendor_master_input vm ON vm.vendor_id = ep.vendor_id
              ${where}
              ORDER BY ep.predicted_at DESC NULLS LAST
            `, params);
            sendJson(res, 200, { etaPredictions: result.rows });
            return;
          }

          // ── Vendor Directory ──────────────────────────────────────────
          if (route === "/directory") {
            const result = await db.query(`
              SELECT vm.vendor_id AS id, vm.name, vm.specialty, vm.location,
                     vm.license_expiry_date AS "licenseExpiry", vm.license_number AS "licenseNumber",
                     vm.status, vm.assignment_eligible AS "assignmentEligible",
                     vm.qualification_score AS "qualificationScore", r.rating
              FROM vendor_master_input vm
              LEFT JOIN (
                SELECT vendor_id, AVG(rating) AS rating FROM vendor_rating_input GROUP BY vendor_id
              ) r ON r.vendor_id = vm.vendor_id
              ORDER BY vm.name
            `);
            const vendors = result.rows.map((r) => ({
              ...r,
              assignmentEligible: r.assignmentEligible === "Yes",
              rating: r.rating === null ? null : Number(r.rating),
              qualificationScore: r.qualificationScore !== null ? Number(r.qualificationScore) : null,
            }));
            sendJson(res, 200, { vendors });
            return;
          }

          // ── Deactivate a vendor ────────────────────────────────────────
          if (route === "/deactivate") {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "POST required" });
              return;
            }
            const body = await readBody(req);
            const vendorId = String(body.vendorId ?? "");
            const mode = String(body.mode ?? "");
            const reasons = Array.isArray(body.reasons) ? (body.reasons as string[]) : [];
            if (!vendorId || !mode || reasons.length === 0) {
              sendJson(res, 400, { error: "vendorId, mode, and at least one reason are required" });
              return;
            }
            await db.query(
              `UPDATE vendor_master_input
               SET status = 'Inactive', assignment_eligible = 'No',
                   deactivation_reason = $1, deactivation_mode = $2, deactivated_at = $3
               WHERE vendor_id = $4`,
              [reasons.join(", "), mode, new Date().toISOString(), vendorId]
            );
            sendJson(res, 200, { vendorId, status: "Inactive" });
            return;
          }

          // ── Vendor Onboarding: applications ────────────────────────────
          if (route === "/applications") {
            if (req.method === "POST") {
              const body = await readBody(req);
              const result = await db.query(
                `INSERT INTO vendor_applications
                   (name, specialty, location, zip_code, license_number, license_expiry_date,
                    contact_email, contact_phone, status, submitted_date)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',$9)
                 RETURNING id`,
                [
                  body.name ?? null,
                  body.specialty ?? null,
                  body.location ?? null,
                  body.zipCode ?? null,
                  body.licenseNumber ?? null,
                  body.licenseExpiryDate ?? null,
                  body.contactEmail ?? null,
                  body.contactPhone ?? null,
                  body.submittedDate ?? new Date().toISOString().slice(0, 10),
                ]
              );
              sendJson(res, 200, { id: result.rows[0].id, status: "Pending" });
              return;
            }
            const statusParam = url.searchParams.get("status");
            const statuses = statusParam ? statusParam.split(",").map((s) => s.trim()) : null;
            const result = await db.query(
              statuses
                ? `SELECT id, name, specialty, location, license_number AS license,
                          license_expiry_date AS expires, submitted_date AS submitted,
                          status, rejection_reason AS "rejectionReason"
                   FROM vendor_applications WHERE status = ANY($1) ORDER BY id DESC`
                : `SELECT id, name, specialty, location, license_number AS license,
                          license_expiry_date AS expires, submitted_date AS submitted,
                          status, rejection_reason AS "rejectionReason"
                   FROM vendor_applications ORDER BY id DESC`,
              statuses ? [statuses] : []
            );
            sendJson(res, 200, { applications: result.rows });
            return;
          }

          const approveMatch = route.match(/^\/applications\/(\d+)\/approve$/);
          if (approveMatch) {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "POST required" });
              return;
            }
            const applicationId = Number(approveMatch[1]);
            const client = await db.connect();
            try {
              await client.query("BEGIN");
              const appResult = await client.query(
                "SELECT * FROM vendor_applications WHERE id = $1",
                [applicationId]
              );
              const app = appResult.rows[0];
              if (!app) {
                await client.query("ROLLBACK");
                sendJson(res, 400, { error: `Vendor application ${applicationId} not found` });
                return;
              }
              if (app.status !== "Pending") {
                await client.query("ROLLBACK");
                sendJson(res, 400, { error: `Vendor application ${applicationId} is not Pending (status=${app.status})` });
                return;
              }
              await client.query("UPDATE vendor_applications SET status = 'Approved' WHERE id = $1", [applicationId]);
              const locationParts = String(app.location ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
              const city = locationParts[0] ?? "";
              const state = locationParts[1] ?? locationParts[0] ?? "";
              const vendorInsert = await client.query(
                `INSERT INTO vendors (name, specialty, license_number, license_valid, rating,
                                       completed_jobs, avg_turnaround_days, avg_cost, city, state,
                                       zip_code, phone, verified)
                 VALUES ($1,$2,$3,TRUE,4.0,0,5,1000.0,$4,$5,$6,$7,TRUE)
                 RETURNING id`,
                [app.name, app.specialty, app.license_number, city, state, app.zip_code ?? '', app.contact_phone ?? '']
              );
              const newVendorDbId = vendorInsert.rows[0].id;
              const vendorId = `VEN-${String(newVendorDbId).padStart(3, "0")}`;
              await client.query(
                `INSERT INTO vendor_master_input
                   (vendor_id, name, specialty, location, status, assignment_eligible,
                    license_number, license_expiry_date, vis_score)
                 VALUES ($1,$2,$3,$4,'Active','Yes',$5,$6,70)`,
                [vendorId, app.name, app.specialty, app.location, app.license_number, app.license_expiry_date]
              );
              await client.query("COMMIT");
              sendJson(res, 200, { applicationId, status: "Approved", vendorId });
            } catch (err) {
              await client.query("ROLLBACK");
              throw err;
            } finally {
              client.release();
            }
            return;
          }

          const rejectMatch = route.match(/^\/applications\/(\d+)\/reject$/);
          if (rejectMatch) {
            if (req.method !== "POST") {
              sendJson(res, 405, { error: "POST required" });
              return;
            }
            const applicationId = Number(rejectMatch[1]);
            const body = await readBody(req);
            const reason = String(body.reason ?? "").trim();
            if (!reason) {
              sendJson(res, 400, { error: "reason is required" });
              return;
            }
            const result = await db.query(
              `UPDATE vendor_applications SET status = 'Rejected', rejection_reason = $1
               WHERE id = $2 AND status = 'Pending'
               RETURNING id`,
              [reason, applicationId]
            );
            if (result.rows.length === 0) {
              sendJson(res, 400, { error: `Vendor application ${applicationId} not found or not Pending` });
              return;
            }
            sendJson(res, 200, { applicationId, status: "Rejected", rejectionReason: reason });
            return;
          }

          // ── VIS Breakdown (3 real sub-factors only) ────────────────────
          const visBreakdownMatch = route.match(/^\/vis-breakdown\/([^/]+)$/);
          if (visBreakdownMatch) {
            const vendorId = decodeURIComponent(visBreakdownMatch[1]);
            const result = await db.query(
              `SELECT sla_score AS "slaScore", cost_efficiency AS "costEfficiency", quality, vis
               FROM vendor_performance_score_output WHERE vendor_id = $1`,
              [vendorId]
            );
            sendJson(res, 200, { breakdown: result.rows[0] ?? null });
            return;
          }

          // ── Assignment Monitor: assignment details ────────────────────
          if (route === "/assignments") {
            const result = await db.query(`
              SELECT va.id AS "assignmentId",
                     va.claim_id AS "claimId",
                     va.vendor_id AS "vendorId",
                     COALESCE(vm.name, va.vendor_id) AS vendor,
                     COALESCE(vm.specialty, '—') AS specialty,
                     va.assignment_status AS "assignmentStatus",
                     va.vendor_type AS "vendorType",
                     va.sla_status AS "assignmentSlaStatus"
              FROM vendor_assignment va
              LEFT JOIN vendor_master_input vm ON vm.vendor_id = va.vendor_id
              ORDER BY va.id DESC
            `);
            sendJson(res, 200, { assignments: result.rows });
            return;
          }

          if (route === "/experts") {
            const result = await db.query(`
              SELECT expert_id AS "expertId", name, company, expert_type AS "expertType",
                     email, phone
              FROM experts
              WHERE active = true
              ORDER BY name ASC
            `);
            sendJson(res, 200, { experts: result.rows });
            return;
          }

          // ── Assignment Monitor: workload distribution ─────────────────
          if (route === "/workload") {
            const result = await db.query(`
              SELECT vm.vendor_id AS id, vm.name, vm.capacity_status AS "capacityStatus",
                     COALESCE(j.jobs, 0) AS jobs
              FROM vendor_master_input vm
              LEFT JOIN (
                SELECT vendor_id, COUNT(*) AS jobs FROM vendor_jobs_input WHERE active = 'Yes' GROUP BY vendor_id
              ) j ON j.vendor_id = vm.vendor_id
              ORDER BY jobs DESC, vm.name
            `);
            const workload = result.rows.map((r) => {
              const jobs = Number(r.jobs);
              const level = r.capacityStatus || (jobs >= 4 ? "Busy" : jobs >= 1 ? "Moderate" : "Available");
              return { name: r.name, jobs, level };
            });
            sendJson(res, 200, { workload });
            return;
          }

          // ── Risk & Compliance: risk flags ──────────────────────────────
          if (route === "/risk-flags") {
            const result = await db.query(`
              SELECT vm.vendor_id AS "vendorId", vm.name, vm.specialty, vm.status,
                     COALESCE(esc.cnt, 0) AS "escalationCount", cv.variance,
                     st.sla_compliance AS "slaCompliance"
              FROM vendor_master_input vm
              LEFT JOIN (
                SELECT vendor_id, COUNT(*) AS cnt FROM escalation_log_output GROUP BY vendor_id
              ) esc ON esc.vendor_id = vm.vendor_id
              LEFT JOIN cost_variance_output cv ON cv.vendor_id = vm.vendor_id
              LEFT JOIN sla_tracker_output st ON st.vendor_id = vm.vendor_id
              ORDER BY vm.name
            `);
            const riskFlags = result.rows.map((r) => {
              const { risk, reason } = riskBand(
                Number(r.escalationCount),
                r.variance === null ? null : Number(r.variance),
                r.slaCompliance === null ? null : Number(r.slaCompliance)
              );
              return {
                vendorId: r.vendorId,
                name: r.name,
                specialty: r.specialty,
                risk,
                reason,
                status: r.status,
              };
            });
            sendJson(res, 200, { riskFlags });
            return;
          }

          // ── Risk & Compliance: AI Signals / Compliance Insights ────────
          if (route === "/compliance-insights") {
            const [anomalies, highCost, relationships, licenses] = await Promise.all([
              db.query(`
                SELECT vm.name AS vendor, cv.variance AS pct
                FROM cost_variance_output cv
                JOIN vendor_master_input vm ON vm.vendor_id = cv.vendor_id
                WHERE cv.variance > 10
                ORDER BY cv.variance DESC LIMIT 10
              `),
              db.query(`
                SELECT vm.name AS vendor, cv.avg_estimate AS estimate
                FROM cost_variance_output cv
                JOIN vendor_master_input vm ON vm.vendor_id = cv.vendor_id
                WHERE cv.avg_estimate IS NOT NULL
                ORDER BY cv.avg_estimate DESC LIMIT 10
              `),
              db.query(`
                SELECT vm.name AS vendor, COALESCE(vp.vis, vm.vis_score) AS vis
                FROM vendor_master_input vm
                LEFT JOIN vendor_performance_score_output vp ON vp.vendor_id = vm.vendor_id
                WHERE COALESCE(vp.vis, vm.vis_score) < 70
                ORDER BY vis ASC LIMIT 10
              `),
              db.query(`
                SELECT name AS vendor, license_expiry_date AS expiry
                FROM vendor_master_input
                WHERE license_expiry_date IS NOT NULL
              `),
            ]);
            const licenseValidation = licenses.rows
              .map((r) => ({ vendor: r.vendor, status: licenseStatus(r.expiry) }))
              .filter((r) => r.status !== "Active");
            sendJson(res, 200, {
              costAnomalies: anomalies.rows,
              repeatedHighCost: highCost.rows,
              relationshipPatterns: relationships.rows,
              licenseValidation,
            });
            return;
          }

          // ── Risk & Compliance: Suspicious Billing Patterns ─────────────
          if (route === "/billing-patterns") {
            const result = await db.query(`
              SELECT vm.name AS vendor, cv.variance, cv.avg_estimate AS "avgEst", cv.avg_actual AS "avgActual"
              FROM cost_variance_output cv
              JOIN vendor_master_input vm ON vm.vendor_id = cv.vendor_id
              WHERE cv.variance IS NOT NULL
              ORDER BY cv.variance DESC
            `);
            const billingPatterns = result.rows.map((r) => ({
              ...r,
              suspicious: Number(r.variance) > 20,
            }));
            sendJson(res, 200, { billingPatterns });
            return;
          }

          // ── Cost Analytics: benchmarking by specialty ──────────────────
          if (route === "/cost-benchmarking") {
            const [groupResult, vendorResult] = await Promise.all([
              db.query(`
                SELECT specialty, AVG(benchmark_avg_repair_cost) AS avg
                FROM cost_variance_output
                WHERE specialty IS NOT NULL AND benchmark_avg_repair_cost IS NOT NULL
                GROUP BY specialty
              `),
              db.query(`
                SELECT vm.name, cv.specialty, cv.avg_actual AS cost, cv.direction
                FROM cost_variance_output cv
                JOIN vendor_master_input vm ON vm.vendor_id = cv.vendor_id
                WHERE cv.specialty IS NOT NULL AND cv.avg_actual IS NOT NULL
              `),
            ]);
            const benchmarkGroups = groupResult.rows.map((g) => ({
              specialty: g.specialty,
              avg: Number(g.avg),
              vendors: vendorResult.rows
                .filter((v) => v.specialty === g.specialty)
                .map((v) => ({ name: v.name, cost: Number(v.cost), direction: v.direction })),
            }));
            sendJson(res, 200, { benchmarkGroups });
            return;
          }

          // ── Cost Analytics: detailed cost records ──────────────────────
          if (route === "/cost-records") {
            const result = await db.query(`
              SELECT vm.name AS vendor, vc.claim_id AS "claimId",
                     vc.estimated_cost AS estimated, vc.actual_cost AS actual
              FROM vendor_cost_input vc
              JOIN vendor_master_input vm ON vm.vendor_id = vc.vendor_id
              ORDER BY vc.id DESC
            `);
            const records = result.rows.map((r) => ({
              ...r,
              status: r.actual === null ? "Pending" : "Completed",
            }));
            sendJson(res, 200, { records });
            return;
          }

          // ── SLA Tracker: metrics by vendor ──────────────────────────────
          if (route === "/sla-metrics") {
            const result = await db.query(`
              SELECT vm.name, vm.specialty, st.avg_response_time AS response,
                     st.avg_completion_time AS completion, st.sla_compliance AS compliance
              FROM sla_tracker_output st
              JOIN vendor_master_input vm ON vm.vendor_id = st.vendor_id
              ORDER BY st.sla_compliance DESC
            `);
            sendJson(res, 200, { metrics: result.rows });
            return;
          }

          // ── SLA Tracker: escalation triggers / open overdue jobs ──────
          if (route === "/open-jobs") {
            const result = await db.query(`
              SELECT vj.claim_id AS "claimId", vm.name AS vendor, vj.assigned_date AS assigned
              FROM vendor_jobs_input vj
              JOIN vendor_master_input vm ON vm.vendor_id = vj.vendor_id
              WHERE TRIM(LOWER(vj.sla_status)) = 'overdue' AND vj.active = 'Yes'
              ORDER BY vj.assigned_date ASC
            `);
            const openJobs = result.rows.map((r) => ({ ...r, days: daysSince(r.assigned) }));
            sendJson(res, 200, { openJobs });
            return;
          }

          // ── Vendor Assignment: called when adjuster clicks Accept Recommendation ──
          if (route === "/assign") {
            if (req.method !== "POST") { sendJson(res, 405, { error: "POST required" }); return; }
            const body = await readBody(req);
            const claimId = body.claim_id as string;
            const vendorId = body.vendor_id as string;
            const vendorType = (body.vendor_type as string) || null;
            if (!claimId || !vendorId) {
              sendJson(res, 400, { error: "claim_id and vendor_id are required" });
              return;
            }
            // Validate vendor exists
            const vendorCheck = await db.query(
              "SELECT vendor_id FROM vendor_master_input WHERE vendor_id = $1",
              [vendorId]
            );
            if (vendorCheck.rowCount === 0) {
              sendJson(res, 404, { error: `Vendor ${vendorId} not found` });
              return;
            }
            // Validate claim exists
            const claimCheck = await db.query(
              "SELECT claim_number FROM claims WHERE claim_number = $1",
              [claimId]
            );
            if (claimCheck.rowCount === 0) {
              sendJson(res, 404, { error: `Claim ${claimId} not found` });
              return;
            }
            // Upsert vendor_assignment
            const existing = await db.query(
              "SELECT id FROM vendor_assignment WHERE claim_id = $1 AND vendor_id = $2",
              [claimId, vendorId]
            );
            if (existing.rowCount && existing.rowCount > 0) {
              await db.query(
                "UPDATE vendor_assignment SET vendor_type = $1, assignment_status = 'Assigned', sla_status = 'On Track' WHERE claim_id = $2 AND vendor_id = $3",
                [vendorType, claimId, vendorId]
              );
            } else {
              await db.query(
                "INSERT INTO vendor_assignment (claim_id, vendor_id, vendor_type, assignment_status, sla_status) VALUES ($1, $2, $3, 'Assigned', 'On Track')",
                [claimId, vendorId, vendorType]
              );
            }
            sendJson(res, 200, { claimId, vendorId, assignmentStatus: "Assigned", slaStatus: "On Track" });
            return;
          }

          sendJson(res, 404, { error: `Unknown vendor route: ${route}` });
        } catch (err) {
          console.error(`vendor api error on ${route}:`, err);
          sendJson(res, 500, { error: "Failed to process vendor request" });
        }
      });
    },
  };
}
