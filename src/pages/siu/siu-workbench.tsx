import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  User,
  AlertTriangle,
  Clock,
  ListChecks,
  Scale,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Phone,
  Globe,
  FileUp,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Network,
  Users,
  Activity,
  FileSearch,
  Eye,
  Pencil,
  Video,
  FileText,
  X,
} from "lucide-react";
import { runSiuWorkflow, continueSiuWorkflow, decideClaimGate } from "@/lib/siu-orchestrator";

interface FraudRiskFlag {
  riskFlag: string;
  severity: string;
  reason: string;
}

interface FraudSummary {
  entityRiskScore: number | null;
  ringDetected: boolean | null;
  ringRiskScore: number | null;
  anomalyScore: number | null;
  toneShiftDetected: boolean | null;
  timingAnomalyDetected: boolean | null;
  corroborationScore: number | null;
  overallFinding: string | null;
}

interface ProgressTracking {
  stage: string | null;
  percent: number | null;
}

interface TimelineEventRow {
  eventType: string;
  status: string;
  timestamp: string;
}

interface SiuCase {
  siuId: string;
  claimId: string;
  fraud: number;
  policyholder: string;
  investigator: string;
  status: string;
  lossType: string;
  referral: string;
  decision?: string | null;
  claimAmount?: number | null;
  fraudRiskFlags?: FraudRiskFlag[];
  fraudSummary?: FraudSummary;
  progress?: ProgressTracking;
  timelineEvents?: TimelineEventRow[];
  caseOpenedAt?: string | null;
}

// The 6 fixed Timeline View stages, each mapped to the siu_timeline_events
// event_type that marks it complete. A stage lights up green the instant a
// matching row exists (siu_timeline_events.event_type), and stays grey
// otherwise — all 6 always render, regardless of how far the case has
// progressed.
const TIMELINE_STAGES: { title: string; eventType: string; label: string }[] = [
  { title: "Case Forwarded to SIU", eventType: "Case Opened", label: "Case Created" },
  { title: "SIU Review Initiated", eventType: "SIU Review Initiated", label: "SIU Review Started" },
  { title: "Evidence Review Completed", eventType: "Evidence Review Completed", label: "Evidence Review" },
  { title: "Interview Scheduled", eventType: "Interview Scheduled", label: "Interviews" },
  { title: "Final Decision Recorded", eventType: "Case Resolved", label: "Decision" },
];

function findTimelineEvent(events: TimelineEventRow[] | undefined, eventType: string): TimelineEventRow | null {
  if (!events) return null;
  return events.find((e) => e.eventType === eventType) ?? null;
}

function formatTimelineTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// SLA formula:
//   Base = 5 days
//   + Claim amount tier: >$50k → +5, $25k-$50k → +3, $10k-$25k → +1, else 0
//   + Fraud score tier:  ≥80    → +5, 60-79      → +3, 40-59      → +1, else 0
// Range: 5–15 days
function computeSlaEstimate(claimAmount: number | null | undefined, fraudScore: number): number {
  const base = 5;
  const amt = claimAmount ?? 0;
  const amtFactor = amt > 50000 ? 5 : amt > 25000 ? 3 : amt > 10000 ? 1 : 0;
  const fraudFactor = fraudScore >= 80 ? 5 : fraudScore >= 60 ? 3 : fraudScore >= 40 ? 1 : 0;
  return base + amtFactor + fraudFactor;
}

function computeDaysPassed(caseOpenedAt: string | null | undefined): number {
  if (!caseOpenedAt) return 0;
  const opened = new Date(caseOpenedAt);
  if (Number.isNaN(opened.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - opened.getTime()) / 86_400_000));
}

function fmtMetric(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "Pending" : `${value}${suffix}`;
}

function fmtBool(value: boolean | null | undefined): string {
  return value === null || value === undefined ? "Pending" : value ? "Yes" : "No";
}

// Claim Amount — ai_decision_recommendations.final_settlement_amount
// (fallback settlement_amount), written by the Adjuster's Settlement
// Recommendation panel. "—" until the Adjuster has run that analysis.
function fmtCurrency(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const CLOSED_STATUSES = new Set(["completed", "closed", "cleared"]);

function riskLabel(score: number): { label: string; badgeClass: string; strokeColor: string } {
  if (score >= 70) return { label: "High Risk", badgeClass: "bg-rose-600", strokeColor: "#e11d48" };
  if (score >= 40) return { label: "Medium Risk", badgeClass: "bg-amber-500", strokeColor: "#f59e0b" };
  return { label: "Low Risk", badgeClass: "bg-emerald-500", strokeColor: "#10b981" };
}

async function fetchSiuCase(claimId: string): Promise<SiuCase | null> {
  const resp = await fetch(`/api/siu/cases?claimId=${encodeURIComponent(claimId)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return Array.isArray(data.cases) && data.cases.length > 0 ? data.cases[0] : null;
}

// gate is what decide_approval sets on human_approval_requests — both
// "Confirm Fraud" and "Clear Claim" now approve the gate so Phase 3 always
// runs; the orchestrator prompt distinguishes which OUTCOME happened by
// reading decision_notes (set to `decision` below) on that same approval
// record. Only "Inconclusive — Return to Adjuster" still rejects the gate,
// which stops the workflow at Phase 2 per the orchestrator's prompt.
const FRAUD_DECISIONS = [
  {
    label: "Confirm Fraud",
    decision: "Fraud Confirmed",
    icon: ShieldAlert,
    gate: "Approved" as const,
    className: "bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-600 hover:to-red-700",
  },
  {
    label: "Clear Claim (Not Fraud)",
    decision: "Claim Cleared (no fraud)",
    icon: ShieldCheck,
    gate: "Approved" as const,
    className: "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500",
  },
] as const;

const DEFAULT_PROOF_REQUEST_TEXT = `As part of our ongoing investigation into your claim, the Special Investigation Unit requires additional documentation. Please provide the following:

1. Original receipts or invoices for all claimed items
2. Photographs of the damaged property showing visible date and time stamps
3. Any police or fire department incident reports related to this claim
4. Contact information for any third-party witnesses
5. Bank or credit card statements confirming purchase of the claimed items

Please submit these documents within 10 business days. Failure to provide the requested documentation may result in delays to your claim resolution.`;

const VERIFICATION_OPTIONS_DEFAULT = [
  {
    id: "location",
    label: "Location & Telematics",
    desc: "Validate GPS, telematics, and incident location",
    recommended: false,
    checked: false,
  },
  {
    id: "liability",
    label: "Third-Party Liability",
    desc: "Confirm third-party identity and insurance coverage",
    recommended: false,
    checked: false,
  },
  {
    id: "invoice",
    label: "Invoice / Estimate",
    desc: "Validate vendor invoice against market benchmarks",
    recommended: true,
    checked: true,
  },
  {
    id: "frauddb",
    label: "Fraud Database",
    desc: "Check NICB and industry fraud watchlists",
    recommended: true,
    checked: true,
  },
];

const INTERVIEW_MORNING_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM"];
const INTERVIEW_AFTERNOON_SLOTS = ["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

// Activity detail bullets per timeline stage — keyed by TIMELINE_STAGES[].eventType
const ACTIVITY_DETAILS: Record<string, { title: string; items: string[] }> = {
  "Case Opened":              { title: "Case Forwarded to SIU",    items: ["Forwarded by Adjuster / AI", "SIU Case ID generated"] },
  "SIU Review Initiated":     { title: "SIU Review Initiated",      items: ["Investigator assigned", "Initial fraud signals reviewed"] },
  "Evidence Review Completed":{ title: "Evidence Review Completed", items: ["Documents analyzed", "Image / damage validation", "Vendor inputs reviewed"] },
  "Interview Scheduled":      { title: "Interview Scheduled",       items: ["Interview scheduled (customer/vendor/witness)", "Interview completed", "Notes captured"] },
  "Case Resolved":            { title: "Final Decision Recorded",   items: ["Fraud determination made", "Case closed and documented"] },
};

function CaseDetail({ c, onBack }: { c: SiuCase; onBack: () => void }) {
  const [openEvent, setOpenEvent] = useState<number | null>(0);
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<SiuCase>(c);
  const [decision, setDecision] = useState<string | null>(c.decision ?? null);
  const [decidingAction, setDecidingAction] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Investigation Actions — Request Additional Proof panel
  const [openAction, setOpenAction] = useState<"proof" | "interview" | null>(null);
  const [proofMode, setProofMode] = useState<"edit" | "preview">("edit");
  const [proofText, setProofText] = useState(DEFAULT_PROOF_REQUEST_TEXT);

  // Investigation Actions — Schedule Interview panel
  const [interviewMode, setInterviewMode] = useState<"video" | "phone">("video");
  const [interviewWeekOffset, setInterviewWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ dayIndex: number; time: string } | null>(null);
  const [interviewNotesOpen, setInterviewNotesOpen] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState("");

  const interviewDays = useMemo(() => {
    const days: Date[] = [];
    const base = new Date();
    base.setDate(base.getDate() + 1 + interviewWeekOffset * 3);
    for (let i = 0; i < 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d);
    }
    return days;
  }, [interviewWeekOffset]);

  // Investigation Actions — Trigger External Verification modal
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationOptions, setVerificationOptions] = useState(VERIFICATION_OPTIONS_DEFAULT);
  const verificationCheckedCount = verificationOptions.filter((o) => o.checked).length;

  const toggleVerificationOption = (id: string) => {
    setVerificationOptions((opts) => opts.map((o) => (o.id === id ? { ...o, checked: !o.checked } : o)));
  };

  const [actionError, setActionError] = useState<string | null>(null);

  // "Schedule Interview" (Send) and "Trigger External Verification" (Trigger
  // Verification) don't go through the SIU orchestrator's LLM, so they log
  // their own siu_timeline_events row directly — this is what lights up the
  // "Interviews" / "External Verification" stages on the Timeline View.
  const logTimelineEvent = async (eventType: string) => {
    const resp = await fetch("/api/siu/timeline-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId: caseData.claimId,
        siuCaseId: caseData.siuId.startsWith("PENDING-") ? null : caseData.siuId,
        eventType,
        status: "Completed",
      }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Failed to log ${eventType} (HTTP ${resp.status})`);
    }
  };

  // Writes an outbound communication_history entry (mirroring Adjuster's own
  // Request Additional Proof action, but attributed to "SIU") so this action
  // surfaces in the "Follow My Claims" Latest Actions box for this claim,
  // regardless of which persona is viewing it.
  const handleSendProofRequest = async () => {
    try {
      setActionError(null);
      const resp = await fetch("/api/siu/request-additional-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: caseData.claimId, message: proofText }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Failed to send the request (HTTP ${resp.status})`);
      }
      setOpenAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send the additional proof request.");
    }
  };

  const handleSendInterview = async () => {
    if (!selectedSlot) return;
    try {
      setActionError(null);
      await logTimelineEvent("Interview Scheduled");

      // Same communication_history write Adjuster's own Schedule Interview
      // action makes, attributed to "SIU" — surfaces this in "Follow My
      // Claims" Latest Actions regardless of persona.
      const dateLabel = interviewDays[selectedSlot.dayIndex].toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const resp = await fetch("/api/siu/schedule-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: caseData.claimId,
          mode: interviewMode === "video" ? "Video Call" : "Phone Call",
          dateLabel,
          time: selectedSlot.time,
          notes: interviewNotes,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Failed to schedule the interview (HTTP ${resp.status})`);
      }

      setOpenAction(null);
      await refreshCaseData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to schedule interview.");
    }
  };

  const handleTriggerVerification = async () => {
    try {
      setActionError(null);
      await logTimelineEvent("External Verification Triggered");
      setVerificationOpen(false);
      await refreshCaseData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to trigger external verification.");
    }
  };

  // Case Header / Fraud Risk Summary fields (Fraud Risk Score, Assigned
  // Investigator, SIU Case ID, Key Fraud Indicators, ...) are all written by
  // the orchestrator's Phase 1/2 agents. Re-pull them from the DB right after
  // a run finishes so the UI reflects the fresh values instead of the
  // snapshot from when this case was opened.
  const refreshCaseData = async () => {
    const fresh = await fetchSiuCase(caseData.claimId);
    if (fresh) {
      setCaseData(fresh);
      if (fresh.decision) setDecision(fresh.decision);
    }
  };

  const runAiAnalysis = async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    try {
      await runSiuWorkflow(caseData.claimId);
      await refreshCaseData();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run SIU analysis.");
    } finally {
      setRunning(false);
    }
  };

  // One of the 3 Fraud Decision buttons was clicked:
  //   1. Persist the canonical decision string into
  //      siu_evidence_correlation_results.decision — "Fraud Confirmed"
  //      (Confirm Fraud), "Claim Cleared (no fraud)" (Clear Claim), or
  //      "Return to Adjuster" (Inconclusive). Verified via response.ok
  //      before treating it as recorded — a prior version fire-and-forgot
  //      this fetch, so a failed write (e.g. no evidence-correlation row
  //      yet) still flipped the UI to "Decision Recorded" while the DB
  //      stayed NULL.
  //   2. Decide the pending siu_investigation_review HITL gate — "Confirm
  //      Fraud" AND "Clear Claim" both now approve it (Phase 3 always runs
  //      for either outcome); only "Inconclusive — Return to Adjuster"
  //      rejects it, stopping the workflow at Phase 2. The same decision
  //      text goes into decision_notes on the approval record so the
  //      orchestrator's prompt can tell "Fraud Confirmed" apart from
  //      "Claim Cleared" once it sees "Approved".
  //   3. Resume the orchestrator conversation so it actually executes Phase 3
  //      (FraudResolution, using the investigator's own decision rather than
  //      re-deriving one from Phase 2 evidence → Legal/Watchlist if
  //      confirmed → SIUClosure) per its own system prompt — the
  //      orchestrator logic already implements this, no need to duplicate
  //      here.
  const handleDecision = async (label: string, decisionValue: string, gate: "Approved" | "Rejected") => {
    if (decidingAction) return;
    setDecidingAction(label);
    setDecisionError(null);
    setRunError(null);
    try {
      const decisionResp = await fetch("/api/siu/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: caseData.claimId, decision: decisionValue }),
      });
      if (!decisionResp.ok) {
        const body = await decisionResp.json().catch(() => ({}));
        throw new Error(body.error || `Failed to save the decision (HTTP ${decisionResp.status})`);
      }

      const gateResult = await decideClaimGate(caseData.claimId, gate, {
        gateType: "siu_investigation_review",
        // The orchestrator prompt reads decision_notes off this same approval
        // record to tell "Fraud Confirmed" apart from "Claim Cleared" when
        // status is Approved — must be the canonical decision text, not the
        // button's display label.
        notes: decisionValue,
      });
      if (gateResult.decided === 0) {
        setDecisionError(
          "No pending Phase 2 review found for this claim yet — run AI Analysis first and wait for the HITL gate."
        );
        return;
      }

      setDecision(decisionValue);

      setRunning(true);
      try {
        await continueSiuWorkflow(caseData.claimId);
      } catch (err) {
        setRunError(err instanceof Error ? err.message : "Failed to continue the SIU workflow.");
      }
      await refreshCaseData();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Failed to record the fraud decision.");
    } finally {
      setDecidingAction(null);
      setRunning(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 pb-16 space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Cases
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={runAiAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {running ? "Running..." : "Run AI Analysis"}
          </button>
          <span className="inline-flex rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white">
            Case Status: {caseData.status}
          </span>
        </div>
      </div>

      {runError && (
        <div className="text-xs font-semibold text-rose-600">⚠️ {runError}</div>
      )}

      {/* Case Header */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-950 via-red-950 to-red-800">
          <span className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">Case Header</h2>
          </span>
          <ChevronDown className="h-4 w-4 text-white/70" />
        </div>
        <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Claim ID", value: caseData.claimId },
            { label: "SIU Case ID", value: caseData.siuId },
            { label: "Policyholder", value: caseData.policyholder },
            { label: "Loss Type", value: caseData.lossType },
            { label: "Claim Amount", value: fmtCurrency(caseData.claimAmount) },
            { label: "Fraud Risk Score", value: String(caseData.fraud), green: true },
            { label: "Referral Source", value: caseData.referral },
            { label: "Assigned Investigator", value: caseData.investigator },
          ].map((f) => (
            <div key={f.label} className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{f.label}</div>
              <div className={`mt-1 text-sm font-extrabold ${f.green ? "text-emerald-600" : "text-slate-900"}`}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5">
          {/* Fraud Risk Summary */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-600">
              <span className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">Fraud Risk Summary</h2>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${riskLabel(caseData.fraud).badgeClass}`}>
                  {riskLabel(caseData.fraud).label}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </span>
            </div>
            <div className="p-6 flex flex-col md:flex-row items-center gap-8">
              <div className="flex flex-col items-center">
                <div className="relative h-28 w-44">
                  <svg viewBox="0 0 100 55" className="w-full h-full">
                    <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                    <path
                      d="M 8 50 A 42 42 0 0 1 92 50"
                      fill="none"
                      stroke={riskLabel(caseData.fraud).strokeColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(Math.min(100, Math.max(0, caseData.fraud)) / 100) * 132} 132`}
                    />
                    <line
                      x1="50" y1="50" x2="24" y2="22"
                      stroke="#334155" strokeWidth="2.5" strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-x-0 bottom-0 text-center">
                    <span className="text-2xl font-extrabold text-slate-900">{caseData.fraud}</span>
                    <span className="text-xs font-bold text-slate-400"> / 100</span>
                  </div>
                </div>
                <span className={`mt-2 rounded-full px-3 py-0.5 text-[10px] font-bold text-white ${riskLabel(caseData.fraud).badgeClass}`}>
                  {riskLabel(caseData.fraud).label}
                </span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <Sparkles className="h-3.5 w-3.5 text-rose-500" /> Key Fraud Indicators
                </div>
                <div className="mt-3 space-y-2.5">
                  {caseData.fraudRiskFlags && caseData.fraudRiskFlags.length > 0 ? (
                    caseData.fraudRiskFlags.map((flag, i) => (
                      <div
                        key={`${flag.riskFlag}-${i}`}
                        className="rounded-lg border border-rose-100 bg-rose-50/60 px-4 py-3 flex items-center gap-3"
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500">
                          <AlertTriangle className="h-3 w-3 text-white" />
                        </span>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">{flag.riskFlag}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{flag.severity}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-[11px] font-semibold text-slate-400">
                      No fraud pattern flags recorded yet — run AI Analysis to generate them.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary — one metric per Phase 2 investigation agent */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600">
              <span className="flex items-center gap-2.5">
                <FileSearch className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">Summary</h2>
              </span>
              <ChevronDown className="h-4 w-4 text-white/70" />
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <Network className="h-3.5 w-3.5 text-indigo-500" /> Entity Relationship Agent
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Suspicion Risk Score</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {fmtMetric(caseData.fraudSummary?.entityRiskScore, "/100")}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <Users className="h-3.5 w-3.5 text-violet-500" /> Network Analysis Agent
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Fraud Ring Detected</span>
                  <span
                    className={`text-sm font-extrabold ${
                      caseData.fraudSummary?.ringDetected ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {fmtBool(caseData.fraudSummary?.ringDetected)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <Activity className="h-3.5 w-3.5 text-amber-500" /> Behavioral Analytics Agent
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Anomaly Score</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {fmtMetric(caseData.fraudSummary?.anomalyScore, "/100")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Tone Shift Detected</span>
                    <span className="text-xs font-bold text-slate-700">{fmtBool(caseData.fraudSummary?.toneShiftDetected)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Timing Anomaly Detected</span>
                    <span className="text-xs font-bold text-slate-700">{fmtBool(caseData.fraudSummary?.timingAnomalyDetected)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <FileSearch className="h-3.5 w-3.5 text-emerald-500" /> Evidence Correlation Agent
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Corroboration Score</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {fmtMetric(caseData.fraudSummary?.corroborationScore, "/100")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Overall Finding</span>
                    <span className="text-xs font-bold text-slate-700">
                      {caseData.fraudSummary?.overallFinding ?? "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SIU Investigation Timeline */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600">
              <span className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">SIU Investigation Timeline</h2>
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {caseData.timelineEvents?.length ?? 0} events
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </span>
            </div>
            <div className="p-5 space-y-5">
              <div className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-white text-xs font-extrabold flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Timeline Structure
              </div>
              <div className="flex items-start justify-between px-2">
                {TIMELINE_STAGES.map((stage, i) => {
                  const completed = Boolean(findTimelineEvent(caseData.timelineEvents, stage.eventType));
                  return (
                    <div key={stage.eventType} className="flex-1 flex flex-col items-center relative">
                      {i < TIMELINE_STAGES.length - 1 && (
                        <div className={`absolute top-3.5 left-1/2 w-full h-[2px] ${completed ? "bg-emerald-300" : "bg-slate-200"}`} />
                      )}
                      <span
                        className={`relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full ring-4 ${
                          completed ? "bg-emerald-500 ring-emerald-100" : "bg-slate-300 ring-slate-100"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </span>
                      <span className="mt-2 text-[9px] font-bold text-slate-600 text-center leading-tight">{stage.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-white text-xs font-extrabold flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5" /> Timeline View
              </div>
              <div className="space-y-1">
                {TIMELINE_STAGES.map((stage, i) => {
                  const event = findTimelineEvent(caseData.timelineEvents, stage.eventType);
                  const completed = Boolean(event);
                  return (
                    <div key={stage.eventType}>
                      <button
                        onClick={() => event && setOpenEvent(openEvent === i ? null : i)}
                        className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-left ${
                          event ? "hover:bg-violet-50/60 cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${completed ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className={`text-xs font-extrabold ${completed ? "text-slate-800" : "text-slate-400"}`}>
                            {stage.title}
                          </span>
                        </span>
                        {event ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            {formatTimelineTimestamp(event.timestamp)} <Info className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Pending</span>
                        )}
                      </button>
                      {event && openEvent === i && (
                        <div className="ml-6 mt-1 mb-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4 grid grid-cols-2 gap-x-8 gap-y-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Event Type</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{event.eventType}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timestamp</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{formatTimelineTimestamp(event.timestamp)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{event.status}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Activities — ALL TIMELINE_STAGES, Done when event exists, Pending otherwise */}
          {(() => {
            const doneCount = TIMELINE_STAGES.filter(
              (s) => Boolean(findTimelineEvent(caseData.timelineEvents, s.eventType))
            ).length;
            return (
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-green-600">
                  <span className="flex items-center gap-2.5">
                    <Activity className="h-4 w-4 text-white" />
                    <h2 className="text-white font-extrabold text-sm">Activities</h2>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {doneCount}/{TIMELINE_STAGES.length} done
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/70" />
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {TIMELINE_STAGES.map((stage) => {
                    const event = findTimelineEvent(caseData.timelineEvents, stage.eventType);
                    const done = Boolean(event);
                    const detail = ACTIVITY_DETAILS[stage.eventType];
                    return (
                      <div
                        key={stage.eventType}
                        className={`rounded-xl border px-5 py-4 ${done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2.5">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              : <Clock className="h-4 w-4 text-slate-400" />}
                            <span className={`text-xs font-extrabold ${done ? "text-slate-900" : "text-slate-400"}`}>
                              {detail?.title ?? stage.title}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {done && event?.timestamp && (
                              <span className="text-[10px] text-slate-400 font-medium">{formatTimelineTimestamp(event.timestamp)}</span>
                            )}
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${done ? "bg-emerald-500" : "bg-slate-300"}`}>
                              {done ? "Done" : "Pending"}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2.5 space-y-1.5 pl-6">
                          {(detail?.items ?? []).map((it) => (
                            <div key={it} className={`flex items-center gap-2 text-[11px] font-semibold ${done ? "text-slate-500" : "text-slate-300"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full border ${done ? "border-emerald-400" : "border-slate-300"}`} /> {it}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Estimated Completion */}
          {(() => {
            const slaEstimate = computeSlaEstimate(caseData.claimAmount, caseData.fraud);
            // Days passed: count from case creation. Stop counting once a fraud
            // decision (Confirm Fraud / Clear Claim / Inconclusive) is recorded.
            const decisionMade = Boolean(decision);
            const daysPassed = decisionMade
              ? computeDaysPassed(caseData.caseOpenedAt)
              : computeDaysPassed(caseData.caseOpenedAt);
            const overdue = !decisionMade && daysPassed > slaEstimate;
            const progressPct = Math.min(100, Math.round((daysPassed / slaEstimate) * 100));
            return (
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
                  <span className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-white" />
                    <h2 className="text-white font-extrabold text-sm">Estimated Completion</h2>
                  </span>
                  <ChevronDown className="h-4 w-4 text-white/70" />
                </div>
                <div className="p-4 space-y-3">
                  <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-4 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Estimated SIU Completion</div>
                    <div className="mt-1 text-3xl font-extrabold text-amber-700">{slaEstimate} days</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Days Passed</span>
                      <span className={`font-extrabold text-sm ${overdue ? "text-red-600" : decisionMade ? "text-emerald-600" : "text-slate-800"}`}>
                        {daysPassed} {daysPassed === 1 ? "day" : "days"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${overdue ? "bg-red-500" : decisionMade ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-[10px] text-slate-400 text-right">
                      {decisionMade
                        ? "Decision recorded — case closed"
                        : overdue
                          ? `${daysPassed - slaEstimate} day(s) overdue`
                          : `${slaEstimate - daysPassed} day(s) remaining`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Progress Tracking */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-orange-500 to-rose-500">
              <span className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">Progress Tracking</h2>
              </span>
              <ChevronDown className="h-4 w-4 text-white/70" />
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Stage</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600">
                    <Sparkles className="h-3 w-3 text-white" />
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">{caseData.progress?.stage ?? "Pending"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>Stage Progress</span>
                  <span className="text-slate-700">
                    {caseData.progress?.percent === null || caseData.progress?.percent === undefined
                      ? "Pending"
                      : `${caseData.progress.percent}%`}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                    style={{ width: `${Math.min(100, Math.max(0, caseData.progress?.percent ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Investigation Actions */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
              <span className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">Investigation Actions</h2>
              </span>
              <ChevronDown className="h-4 w-4 text-white/70" />
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => setOpenAction(openAction === "proof" ? null : "proof")}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:from-orange-400 hover:to-amber-400"
              >
                <FileUp className="h-3.5 w-3.5" /> Request Additional Proof
              </button>
              <button
                onClick={() => setOpenAction(openAction === "interview" ? null : "interview")}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:from-violet-500 hover:to-purple-500"
              >
                <Phone className="h-3.5 w-3.5" /> Schedule Interview
              </button>

              {openAction === "proof" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500">
                      <FileUp className="h-3.5 w-3.5 text-white" />
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">Request Additional Proof / Documentation</h3>
                  </div>
                  <textarea
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    readOnly={proofMode === "preview"}
                    rows={6}
                    className={`w-full rounded-lg border p-3 text-xs font-medium leading-relaxed resize-none focus:outline-none ${
                      proofMode === "preview"
                        ? "border-slate-200 bg-white text-slate-400 cursor-default"
                        : "border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-amber-300"
                    }`}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setProofMode(proofMode === "edit" ? "preview" : "edit")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {proofMode === "edit" ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                      {proofMode === "edit" ? "Preview" : "Edit"}
                    </button>
                    <button
                      onClick={handleSendProofRequest}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-[11px] font-bold text-white hover:from-orange-400 hover:to-amber-400"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> Send Request
                    </button>
                    <button
                      onClick={() => setOpenAction(null)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {actionError && (
                    <div className="text-[11px] font-semibold text-rose-600">⚠️ {actionError}</div>
                  )}
                </div>
              )}

              {openAction === "interview" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                      <Clock className="h-3.5 w-3.5 text-white" />
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">Schedule Interview</h3>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mode:</span>
                    <button
                      onClick={() => setInterviewMode("video")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                        interviewMode === "video" ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      <Video className="h-3.5 w-3.5" /> Video Call
                    </button>
                    <button
                      onClick={() => setInterviewMode("phone")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                        interviewMode === "phone" ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" /> Phone Call
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <Clock className="h-3 w-3" /> Select Available Slots
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInterviewWeekOffset((w) => w - 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setInterviewWeekOffset((w) => w + 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {interviewDays.map((d, dayIndex) => (
                        <div key={dayIndex} className="rounded-lg border border-emerald-200 bg-white p-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                              </div>
                              <div className="text-xs font-extrabold text-slate-900">
                                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </div>
                            <span className="inline-flex h-4 w-4 rounded-full border-2 border-emerald-400" />
                          </div>

                          <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-amber-600">Morning</div>
                          <div className="mt-1 space-y-1">
                            {INTERVIEW_MORNING_SLOTS.map((time) => {
                              const isSelected = selectedSlot?.dayIndex === dayIndex && selectedSlot.time === time;
                              return (
                                <button
                                  key={time}
                                  onClick={() => setSelectedSlot({ dayIndex, time })}
                                  className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50"
                                >
                                  <span
                                    className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 ${
                                      isSelected ? "border-emerald-600 bg-emerald-600" : "border-emerald-400"
                                    }`}
                                  />
                                  {time}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-indigo-500">Afternoon</div>
                          <div className="mt-1 space-y-1">
                            {INTERVIEW_AFTERNOON_SLOTS.map((time) => {
                              const isSelected = selectedSlot?.dayIndex === dayIndex && selectedSlot.time === time;
                              return (
                                <button
                                  key={time}
                                  onClick={() => setSelectedSlot({ dayIndex, time })}
                                  className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50"
                                >
                                  <span
                                    className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 ${
                                      isSelected ? "border-emerald-600 bg-emerald-600" : "border-emerald-400"
                                    }`}
                                  />
                                  {time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setInterviewNotesOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5" /> Add additional notes
                  </button>
                  {interviewNotesOpen && (
                    <textarea
                      value={interviewNotes}
                      onChange={(e) => setInterviewNotes(e.target.value)}
                      placeholder="Notes for the interview..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSendInterview}
                      disabled={!selectedSlot}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-1.5 text-[11px] font-bold text-white hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> Send
                    </button>
                    <button
                      onClick={() => setOpenAction(null)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {actionError && (
                    <div className="text-[11px] font-semibold text-rose-600">⚠️ {actionError}</div>
                  )}
                </div>
              )}

              <div className="rounded-md bg-emerald-600 px-3 py-1.5 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Investigation Notes</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add investigation notes..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs font-medium text-slate-700 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button disabled className="w-full rounded-full bg-slate-400 px-4 py-2 text-xs font-bold text-white cursor-not-allowed">
                Save Notes
              </button>
            </div>
          </div>

          {/* Fraud Decision */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600">
              <span className="flex items-center gap-2.5">
                <Scale className="h-4 w-4 text-white" />
                <h2 className="text-white font-extrabold text-sm">Fraud Decision</h2>
              </span>
              <ChevronDown className="h-4 w-4 text-white/70" />
            </div>
            <div className="p-4 space-y-3">
              {decision ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Decision Recorded</div>
                  <div className="mt-1 text-lg font-extrabold text-emerald-700">{decision}</div>
                </div>
              ) : (
                <>
                  {FRAUD_DECISIONS.map(({ label, decision: decisionValue, icon: Icon, gate, className }) => (
                    <button
                      key={label}
                      onClick={() => handleDecision(label, decisionValue, gate)}
                      disabled={decidingAction !== null}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
                    >
                      {decidingAction === label ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                  {decisionError && (
                    <div className="text-[11px] font-semibold text-rose-600 text-center">⚠️ {decisionError}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {verificationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between px-6 pt-5">
              <div className="flex items-center gap-2.5">
                <Globe className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">Trigger External Verification</h3>
              </div>
              <button
                onClick={() => setVerificationOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="px-6 pt-1.5 text-xs font-medium text-slate-500">
              Select the external checks to run for this claim. Each verification will create a record and update the SIU timeline.
            </p>

            <div className="px-6 pt-4">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3 flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <div className="text-[11px] font-semibold text-indigo-700">
                  <span className="font-extrabold uppercase tracking-wider">AI Recommendation</span>
                  <div className="mt-0.5 text-indigo-600">
                    Based on detected fraud signals, we recommend running:{" "}
                    <span className="font-extrabold">Invoice / Estimate, Fraud Database</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pt-3 pb-5 space-y-2.5 max-h-80 overflow-y-auto">
              {verificationOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleVerificationOption(opt.id)}
                  className={`w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${
                    opt.checked ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      opt.checked ? "border-blue-600 bg-blue-600" : "border-slate-300"
                    }`}
                  >
                    {opt.checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">{opt.label}</span>
                      {opt.recommended && (
                        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-600">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-slate-500">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {actionError && (
              <div className="px-6 pb-2 text-[11px] font-semibold text-rose-600">⚠️ {actionError}</div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setVerificationOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerVerification}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-1.5 text-xs font-bold text-white hover:from-blue-500 hover:to-sky-400"
              >
                <Globe className="h-3.5 w-3.5" /> Trigger Verification ({verificationCheckedCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiuWorkbench() {
  const [selected, setSelected] = useState<SiuCase | null>(null);
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<SiuCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/siu/cases");
        if (!resp.ok) throw new Error(`Failed to load SIU cases (HTTP ${resp.status})`);
        const data = await resp.json();
        if (!cancelled) setCases(Array.isArray(data.cases) ? data.cases : []);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load SIU cases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (selected) {
    return <CaseDetail c={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = cases.filter(
    (c) =>
      c.siuId.toLowerCase().includes(search.toLowerCase()) ||
      c.claimId.toLowerCase().includes(search.toLowerCase()) ||
      c.investigator.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = cases.filter((c) => !CLOSED_STATUSES.has(c.status.toLowerCase())).length;
  const escalatedCount = cases.filter((c) => c.fraud >= 80).length;

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-6 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">SIU Investigation Workbench</h1>
          <p className="mt-1 text-sm text-indigo-200/80 font-medium">Investigate flagged claims with AI-powered fraud detection tools</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold text-white">
            <Shield className="h-3.5 w-3.5" /> Open Cases ({openCount})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold text-white">
            <AlertTriangle className="h-3.5 w-3.5" /> Escalated ({escalatedCount})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold text-white">
            <ListChecks className="h-3.5 w-3.5" /> Total Cases ({cases.length})
          </span>
        </div>
      </div>

      {/* Investigation Queue */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-red-950 to-red-800">
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-base">Investigation Queue</h2>
          </div>
          <p className="mt-0.5 text-xs text-red-100/70 font-medium">Select a case to open the detailed investigation panel</p>
        </div>
        <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-100">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Search &amp; Filter
          </span>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claim #, SIU case ID, or investigator..."
              className="w-full rounded-full border border-slate-200 bg-slate-50/60 pl-9 pr-4 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            Showing <span className="font-extrabold text-slate-800">{filtered.length}</span> of <span className="font-extrabold text-slate-800">{cases.length}</span> cases
          </span>
        </div>
        {loading && (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">Loading SIU cases…</div>
        )}
        {!loading && loadError && (
          <div className="p-8 text-center text-xs font-semibold text-rose-600">⚠️ {loadError}</div>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">No SIU cases found.</div>
        )}
        {!loading && !loadError && filtered.length > 0 && (
        <div className="p-4 space-y-3">
          {filtered.map((c) => (
            <button
              key={c.siuId}
              onClick={() => setSelected(c)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:border-blue-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-sm">
                  <Shield className="h-5 w-5 text-white" />
                </span>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-900">{c.siuId}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs font-bold text-slate-500">{c.claimId}</span>
                    <span className="inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      Fraud: {c.fraud}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                    <User className="h-3 w-3" /> {c.policyholder}
                    <span className="text-slate-300">|</span> —
                    <span className="text-slate-300">|</span> Investigator: <span className="text-slate-600 font-bold">{c.investigator}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex rounded-full bg-emerald-700 px-3 py-1 text-[10px] font-bold text-white">{c.status}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
