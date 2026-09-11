import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, UserCheck, Search, RefreshCw, BarChart3, X, FileText, PenLine, Bell, Send, Truck, Loader2, AlertCircle, Package, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// const VENDOR_ORCHESTRATOR_URL = "http://localhost:9120";
const VENDOR_ORCHESTRATOR_URL = "http://10.4.173.139:9120";

interface Assignment {
  assignmentId: number;
  claimId: string;
  vendorId: string;
  vendor: string;
  specialty: string;
  assignmentStatus: string | null;
  vendorType: string | null;
  assignmentSlaStatus: string | null;
}

interface Expert {
  expertId: string;
  name: string;
  company: string | null;
  expertType: string;
  email: string;
  phone: string;
}

type DispatchStage = "dispatch" | "eta" | "sla" | "escalation" | "performance";

const DISPATCH_STAGES: { key: DispatchStage; label: string }[] = [
  { key: "dispatch", label: "Dispatch" },
  { key: "eta", label: "ETA Prediction" },
  { key: "sla", label: "SLA Compliance" },
  { key: "escalation", label: "Escalation" },
  { key: "performance", label: "Performance" },
];

const DISPATCH_TOOL_STAGE: Record<string, DispatchStage> = {
  create_work_order: "dispatch",
  get_work_order: "dispatch",
  predict_eta: "eta",
  get_eta_prediction: "eta",
  get_vendor_jobs_sla: "sla",
  compute_sla_compliance: "sla",
  get_vendor_escalations: "escalation",
  create_vendor_escalation: "escalation",
  escalate_overdue_jobs: "escalation",
  get_vendor_jobs: "performance",
  compute_vendor_performance_score: "performance",
};

interface DispatchWorkflow {
  claimId: string;
  activeStage: DispatchStage | null;
  completedStages: DispatchStage[];
  running: boolean;
  done: boolean;
  log: string;
  error: string | null;
}

interface WorkloadRow {
  name: string;
  jobs: number;
  level: string;
}

interface WorkOrder {
  workOrderId: number;
  workOrderRef: string | null;
  claimId: string;
  expertId: string | null;
  expertName: string | null;
  expertType: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  priority: string | null;
  status: string | null;
  estimatedCost: number | null;
  assignedBy: string | null;
  notes: string | null;
  createdAt: string | null;
}

interface DispatchLog {
  id: number;
  workOrderId: number;
  status: string | null;
  changedBy: string | null;
  notes: string | null;
  changedAt: string | null;
}

interface ExpertEstimate {
  id: number;
  claimNumber: string;
  workOrderId: string;
  expertName: string | null;
  expertType: string | null;
  repairNetPayable: number | null;
  replacementNetPayable: number | null;
  notes: string | null;
  submittedAt: string | null;
}

const statusBadge: Record<string, string> = {
  Reassigned: "border border-slate-300 text-slate-400 bg-white",
  Assigned: "border border-amber-300 bg-amber-50 text-amber-600",
  "Pending Review": "border border-orange-300 bg-orange-50 text-orange-600",
  Completed: "bg-emerald-700 text-white",
  "In Progress": "bg-blue-600 text-white",
};

const statusFilters = ["All", "Assigned", "In Progress", "Pending Review", "Completed", "Reassigned"];

export default function VendorAssignmentMonitor() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reassignRow, setReassignRow] = useState<Assignment | null>(null);
  const [newVendor, setNewVendor] = useState("");
  const [escalateRow, setEscalateRow] = useState<Assignment | null>(null);
  const [editingMessage, setEditingMessage] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState("");
  const [escalationActions, setEscalationActions] = useState<Record<string, boolean>>({});

  // Work orders state
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [expandedWorkOrder, setExpandedWorkOrder] = useState<number | null>(null);
  const [dispatchLogs, setDispatchLogs] = useState<Record<number, DispatchLog[]>>({});
  const [expertEstimates, setExpertEstimates] = useState<ExpertEstimate[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<number | null>(null);

  // Dispatch state
  const [dispatchRow, setDispatchRow] = useState<Assignment | null>(null);
  const [selectedExpertId, setSelectedExpertId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [assignedBy, setAssignedBy] = useState("Rachel Martinez");
  const [priority, setPriority] = useState("Normal");
  const [notesToExpert, setNotesToExpert] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchingClaimId, setDispatchingClaimId] = useState<string | null>(null);
  const [dispatchWorkflow, setDispatchWorkflow] = useState<DispatchWorkflow | null>(null);
  // Track which claims have already been dispatched so the button stays disabled
  const [dispatchedClaims, setDispatchedClaims] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dispatchedClaims") ?? "[]")); } catch { return new Set(); }
  });
  const dispatchLogRef = useRef("");

  useEffect(() => {
    Promise.all([
      fetch("/api/vendor/assignments").then((r) => r.json()),
      fetch("/api/vendor/workload").then((r) => r.json()),
      fetch("/api/vendor/directory").then((r) => r.json()),
      fetch("/api/vendor/experts").then((r) => r.json()),
      fetch("/api/vendor/work-orders").then((r) => r.json()),
      fetch("/api/vendor/expert-estimates").then((r) => r.json()),
    ])
      .then(([assignmentsData, workloadData, directoryData, expertsData, workOrdersData, expertEstimatesData]) => {
        setRows(assignmentsData.assignments ?? []);
        setWorkload(workloadData.workload ?? []);
        setAvailableVendors(
          (directoryData.vendors ?? [])
            .filter((v: { status: string; assignmentEligible: boolean }) => v.status === "Active" && v.assignmentEligible)
            .map((v: { name: string }) => v.name)
        );
        setExperts(expertsData.experts ?? []);
        setWorkOrders(workOrdersData.workOrders ?? []);
        setExpertEstimates(expertEstimatesData.expertEstimates ?? []);
      })
      .catch((err) => console.error("Failed to load assignment monitor data:", err));
  }, []);

  async function toggleDispatchLogs(workOrderId: number) {
    if (expandedWorkOrder === workOrderId) {
      setExpandedWorkOrder(null);
      return;
    }
    setExpandedWorkOrder(workOrderId);
    if (dispatchLogs[workOrderId]) return;
    setLoadingLogs(workOrderId);
    try {
      const data = await fetch(`/api/vendor/dispatch-logs?workOrderId=${workOrderId}`).then((r) => r.json());
      setDispatchLogs((prev) => ({ ...prev, [workOrderId]: data.dispatchLogs ?? [] }));
    } catch {
      setDispatchLogs((prev) => ({ ...prev, [workOrderId]: [] }));
    } finally {
      setLoadingLogs(null);
    }
  }

  const selectedExpert = experts.find((e) => e.expertId === selectedExpertId) ?? null;

  async function runDispatch(row: Assignment) {
    if (!selectedExpertId || !scheduledDate || !scheduledTime) {
      toast({ title: "Missing Fields", description: "Expert, date and time are required.", variant: "destructive" });
      return;
    }
    setDispatching(true);
    setDispatchingClaimId(row.claimId);
    dispatchLogRef.current = "";
    setDispatchWorkflow({
      claimId: row.claimId,
      activeStage: null,
      completedStages: [],
      running: true,
      done: false,
      log: "",
      error: null,
    });
    setDispatchRow(null);

    try {
      const resp = await fetch(`${VENDOR_ORCHESTRATOR_URL}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_number: row.claimId,
          vendor_id: row.vendorId,
          expert_id: selectedExpertId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          assigned_by: assignedBy,
          priority,
          notes_to_expert: notesToExpert || null,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Orchestrator returned ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const chunk = (line.startsWith("data: ") ? line.slice(6) : line.slice(5)).replace(/\r$/, "");
          if (!chunk || chunk === "[DONE]") continue;

          const toolStart = chunk.match(/\[Tool:\s*([^\]]+)\]\s*Starting/);
          const toolDone = chunk.match(/\[Tool:\s*([^\]]+)\]\s*Done/);

          if (toolStart) {
            const stage = DISPATCH_TOOL_STAGE[toolStart[1].trim()];
            if (stage) setDispatchWorkflow((prev) => prev ? { ...prev, activeStage: stage } : prev);
          } else if (toolDone) {
            const stage = DISPATCH_TOOL_STAGE[toolDone[1].trim()];
            if (stage) {
              setDispatchWorkflow((prev) => {
                if (!prev) return prev;
                const completed = prev.completedStages.includes(stage) ? prev.completedStages : [...prev.completedStages, stage];
                return { ...prev, completedStages: completed, activeStage: null };
              });
            }
          } else {
            dispatchLogRef.current += chunk;
            const logSnapshot = dispatchLogRef.current;
            setDispatchWorkflow((prev) => prev ? { ...prev, log: logSnapshot } : prev);
          }
        }
      }
    } catch (err) {
      setDispatchWorkflow(null);
      setDispatching(false);
      setDispatchingClaimId(null);
      toast({ title: "Dispatch Failed", description: String(err), variant: "destructive" });
      // Do NOT mark as dispatched — keep button enabled so user can retry
      return;
    }

    const completedClaimId = row.claimId;
    setDispatchWorkflow(null);
    setDispatching(false);
    setDispatchingClaimId(null);
    // Only mark as dispatched (and persist) after a confirmed successful run
    setDispatchedClaims((prev) => {
      const next = new Set(prev);
      next.add(completedClaimId);
      try { localStorage.setItem("dispatchedClaims", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    // Refresh work orders so the new row appears immediately without a page reload
    fetch("/api/vendor/work-orders")
      .then((r) => r.json())
      .then((d) => setWorkOrders(d.workOrders ?? []))
      .catch(() => { /* non-fatal */ });
    toast({ title: "Dispatch Workflow Completed", description: `Dispatch workflow for claim ${completedClaimId} completed successfully.` });
  }

  const openEscalate = (r: Assignment) => {
    setEscalateRow(r);
    setEditingMessage(false);
    setEscalationMessage(
      `We have observed a delay in the assigned repair work for Claim ${r.claimId}. The job has exceeded the expected SLA timeline. Please provide an immediate update and revised completion timeline.`
    );
    setEscalationActions({
      "Notify Vendor": true,
      "Notify Adjuster": false,
      "Notify Vendor Supervisor": false,
      "Mark as High Priority": true,
    });
  };

  const sendEscalation = () => {
    if (!escalateRow) return;
    toast({
      title: "Escalation Sent",
      description: `Escalation notification sent to ${escalateRow.vendor} for ${escalateRow.claimId}.`,
    });
    setEscalateRow(null);
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "All") list = list.filter((r) => r.assignmentStatus === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.claimId.toLowerCase().includes(q) || r.vendor.toLowerCase().includes(q));
    }
    return list;
  }, [rows, statusFilter, search]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      inProgress: rows.filter((r) => r.assignmentStatus === "In Progress").length,
      completed: rows.filter((r) => r.assignmentStatus === "Completed").length,
      pendingReview: rows.filter((r) => r.assignmentStatus === "Pending Review").length,
      assigned: rows.filter((r) => r.assignmentStatus === "Assigned").length,
    }),
    [rows]
  );

  const confirmReassign = () => {
    if (!reassignRow || !newVendor) return;
    setRows((prev) =>
      prev.flatMap((r) => {
        if (r === reassignRow) {
          return [
            { ...r, status: "Reassigned" as const, slaStatus: "Reassigned" as const },
            { ...r, vendor: newVendor, status: "Assigned" as const, slaStatus: null },
          ];
        }
        return [r];
      })
    );
    toast({
      title: "Vendor Reassigned",
      description: `${reassignRow.claimId} reassigned to ${newVendor}.`,
    });
    setReassignRow(null);
    setNewVendor("");
  };

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Vendor Assignment Monitor</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Track vendor assignments, workload distribution, and SLA compliance</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Total Assignments</span>
            <ClipboardList className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{counts.total}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-blue-800 to-indigo-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">In Progress</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{counts.inProgress}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Completed</span>
            <CheckCircle2 className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{counts.completed}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-orange-500 to-red-600">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Pending Review</span>
            <AlertTriangle className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{counts.pendingReview}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-violet-600 to-purple-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Assigned</span>
            <UserCheck className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{counts.assigned}</div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Claim ID or Vendor Name..."
            className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40 rounded-lg border-slate-200 text-sm h-10 font-semibold">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assignment details table */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-blue-600">
          <ClipboardList className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Assignment Details ({counts.total})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-950 to-violet-950 text-white text-xs font-bold">
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Vendor ID</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Specialty</th>
                <th className="px-4 py-3">Vendor Type</th>
                <th className="px-4 py-3">Assignment Status</th>
                <th className="px-4 py-3">SLA Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No assignments found</td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const reassigned = r.assignmentStatus === "Reassigned";
                  const completed = r.assignmentStatus === "Completed";
                  const canReassign = !reassigned && !completed;
                  return (
                    <tr key={`${r.claimId}-${r.vendorId}-${i}`} className={reassigned ? "text-slate-400" : ""}>
                      <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap text-slate-800">
                        <div className="flex items-center gap-2">
                          {r.claimId}
                          {dispatchingClaimId === r.claimId && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-bold">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Dispatching…
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap">{r.vendorId}</td>
                      <td className="px-4 py-3.5 text-sm font-medium text-slate-700 whitespace-nowrap">{r.vendor}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{r.specialty}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">{r.vendorType ?? "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.assignmentStatus ? (
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold whitespace-nowrap ${statusBadge[r.assignmentStatus] ?? "border border-slate-300 bg-white text-slate-600"}`}>
                            {r.assignmentStatus}
                          </span>
                        ) : <span className="text-sm text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.assignmentSlaStatus ? (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            r.assignmentSlaStatus === "At Risk" ? "bg-red-100 text-red-700 border border-red-200" :
                            r.assignmentSlaStatus === "On Track" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                            "bg-slate-100 text-slate-600"
                          }`}>{r.assignmentSlaStatus}</span>
                        ) : <span className="text-sm text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {reassigned ? (
                            <span className="text-xs italic text-slate-400">No actions</span>
                          ) : (
                            <button
                              onClick={() => canReassign && setReassignRow(r)}
                              disabled={!canReassign}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-bold transition-colors ${
                                canReassign
                                  ? "bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              <RefreshCw className="h-3 w-3" /> Reassign
                            </button>
                          )}
                          {!reassigned && (
                            <button
                              disabled={dispatchedClaims.has(r.claimId) || dispatchingClaimId === r.claimId}
                              title={
                                dispatchedClaims.has(r.claimId) ? "Dispatch already run for this claim"
                                : dispatchingClaimId === r.claimId ? "Dispatch in progress…"
                                : undefined
                              }
                              onClick={() => {
                                if (dispatchedClaims.has(r.claimId) || dispatchingClaimId === r.claimId) return;
                                setDispatchRow(r);
                                setSelectedExpertId("");
                                setScheduledDate("");
                                setScheduledTime("");
                                setAssignedBy("Rachel Martinez");
                                setPriority("Normal");
                                setNotesToExpert("");
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-bold transition-colors ${
                                dispatchedClaims.has(r.claimId) || dispatchingClaimId === r.claimId
                                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white"
                              }`}
                            >
                              <Truck className="h-3 w-3" /> {dispatchedClaims.has(r.claimId) ? "Dispatched" : dispatchingClaimId === r.claimId ? "Dispatching…" : "Dispatch"}
                            </button>
                          )}
                          {!reassigned && r.assignmentStatus === "In Progress" && r.assignmentSlaStatus === "At Risk" && (
                            <button
                              onClick={() => openEscalate(r)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-bold bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white transition-colors"
                            >
                              <AlertTriangle className="h-3 w-3" /> Escalate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workload distribution */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600">
          <BarChart3 className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Vendor Workload Distribution</h2>
        </div>
        <div className="p-5 space-y-3">
          {workload.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">No workload data yet.</div>
          )}
          {workload.map((w) => {
            const moderate = w.level === "Moderate" || w.level === "Near Capacity";
            const busy = w.level === "Busy" || w.level === "At Capacity";
            return (
              <div
                key={w.name}
                className={`rounded-xl px-4 py-3 ${busy ? "bg-red-50/70" : moderate ? "bg-amber-50/70" : "bg-emerald-50/60"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800">{w.name}</span>
                  <span className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${busy ? "bg-white text-red-600 border border-red-200" : moderate ? "bg-white text-amber-600 border border-amber-200" : "bg-white text-emerald-600 border border-emerald-200"}`}>
                      {w.level}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">{w.jobs} jobs</span>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white overflow-hidden">
                  <div
                    className={`h-full rounded-full ${busy ? "bg-red-400" : moderate ? "bg-amber-400" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max((w.jobs / 4) * 100, w.jobs ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Work Orders */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-violet-700 to-indigo-700">
          <Package className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Dispatch Work Orders ({workOrders.length})</h2>
        </div>
        {workOrders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No work orders yet. Run the Dispatch flow from the table above.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {workOrders.map((wo) => {
              const isExpanded = expandedWorkOrder === wo.workOrderId;
              const logs = dispatchLogs[wo.workOrderId] ?? [];
              return (
                <div key={wo.workOrderId}>
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${wo.status === "Completed" ? "bg-emerald-500" : wo.status === "In Progress" ? "bg-blue-500" : "bg-amber-400"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">{wo.workOrderRef ?? `#${wo.workOrderId}`}</span>
                          <span className="font-extrabold text-slate-900 text-sm">{wo.claimId}</span>
                          {wo.expertType && <><span className="text-slate-400">·</span><span className="text-sm font-semibold text-slate-700">{wo.expertType}</span></>}
                          {wo.priority && wo.priority !== "Normal" && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${wo.priority === "Urgent" || wo.priority === "High" ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{wo.priority}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                          {wo.expertName && <span>Expert: <span className="font-semibold text-slate-600">{wo.expertName}</span></span>}
                          {wo.scheduledDate && <span>Scheduled: <span className="font-semibold text-slate-600">{wo.scheduledDate} {wo.scheduledTime ?? ""}</span></span>}
                          {wo.estimatedCost !== null && <span>Est. Cost: <span className="font-semibold text-slate-600">${wo.estimatedCost.toLocaleString()}</span></span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      {(() => {
                        const ee = expertEstimates.find(e => e.workOrderId === wo.workOrderRef);
                        return ee ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            ✓ Expert estimates: Repair {ee.repairNetPayable !== null ? `$${ee.repairNetPayable.toLocaleString()}` : "—"} / Replace {ee.replacementNetPayable !== null ? `$${ee.replacementNetPayable.toLocaleString()}` : "—"}
                          </span>
                        ) : null;
                      })()}
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${wo.status === "Completed" ? "bg-emerald-600 text-white" : wo.status === "In Progress" ? "bg-blue-600 text-white" : "bg-amber-400 text-white"}`}>
                        {wo.status ?? "Pending"}
                      </span>
                      <button
                        onClick={() => toggleDispatchLogs(wo.workOrderId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors"
                      >
                        {loadingLogs === wo.workOrderId ? <Loader2 className="h-3 w-3 animate-spin" /> : isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Audit Trail
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                        {logs.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-500">No audit log entries for this work order.</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-2 text-left">Status</th>
                                <th className="px-4 py-2 text-left">Changed By</th>
                                <th className="px-4 py-2 text-left">Notes</th>
                                <th className="px-4 py-2 text-left">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {logs.map((log) => (
                                <tr key={log.id} className="bg-white">
                                  <td className="px-4 py-2 font-semibold text-slate-700">{log.status ?? "—"}</td>
                                  <td className="px-4 py-2 text-slate-500">{log.changedBy ?? "—"}</td>
                                  <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{log.notes ?? "—"}</td>
                                  <td className="px-4 py-2 text-slate-400">{log.changedAt ? new Date(log.changedAt).toLocaleString() : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reassign dialog */}
      <Dialog open={!!reassignRow} onOpenChange={(o) => { if (!o) { setReassignRow(null); setNewVendor(""); } }}>
        <DialogContent className="max-w-md p-6">
          {reassignRow && (
            <>
              <DialogTitle className="text-base font-extrabold text-slate-900 mb-1">Reassign Vendor</DialogTitle>
              <p className="text-xs text-slate-500 mb-4">Select a new vendor for claim {reassignRow.claimId}</p>
              <Select value={newVendor} onValueChange={setNewVendor}>
                <SelectTrigger className="w-full rounded-lg border-blue-300 text-sm h-10 mb-5">
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVendors
                    .filter((v) => v !== reassignRow.vendor)
                    .map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => { setReassignRow(null); setNewVendor(""); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={confirmReassign}
                  disabled={!newVendor}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 px-4 py-2 text-sm font-bold text-white transition-colors"
                >
                  Confirm Reassignment
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispatch dialog */}
      <Dialog open={!!dispatchRow} onOpenChange={(o) => { if (!o) setDispatchRow(null); }}>
        <DialogContent className="max-w-lg p-6">
          {dispatchRow && (
            <>
              <div className="flex items-start gap-3 mb-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-700 shrink-0">
                  <Truck className="h-4 w-4 text-white" />
                </span>
                <div>
                  <DialogTitle className="text-base font-extrabold text-slate-900">Dispatch Expert</DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Claim {dispatchRow.claimId} · Vendor: {dispatchRow.vendor}</p>
                </div>
              </div>

              {/* Expert Name dropdown */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Expert Name <span className="text-red-500">*</span></label>
                  <Select value={selectedExpertId} onValueChange={setSelectedExpertId}>
                    <SelectTrigger className="w-full rounded-lg border-slate-200 text-sm h-10">
                      <SelectValue placeholder="Select an expert..." />
                    </SelectTrigger>
                    <SelectContent>
                      {experts.map((e) => (
                        <SelectItem key={e.expertId} value={e.expertId}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Autopopulated fields */}
                {selectedExpert && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                    <div><span className="font-bold text-slate-500">Company</span><div className="font-semibold text-slate-800 mt-0.5">{selectedExpert.company || "—"}</div></div>
                    <div><span className="font-bold text-slate-500">Expert Type</span><div className="font-semibold text-slate-800 mt-0.5">{selectedExpert.expertType}</div></div>
                    <div><span className="font-bold text-slate-500">Email</span><div className="font-semibold text-slate-800 mt-0.5">{selectedExpert.email}</div></div>
                    <div><span className="font-bold text-slate-500">Phone</span><div className="font-semibold text-slate-800 mt-0.5">{selectedExpert.phone || "—"}</div></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">Scheduled Date <span className="text-red-500">*</span></label>
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">Scheduled Time <span className="text-red-500">*</span></label>
                    <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Assigned By</label>
                  <input value={assignedBy} onChange={(e) => setAssignedBy(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="w-full rounded-lg border-slate-200 text-sm h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Low", "Normal", "High", "Urgent"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Notes to Expert</label>
                  <textarea value={notesToExpert} onChange={(e) => setNotesToExpert(e.target.value)}
                    rows={3} placeholder="Optional instructions for the expert..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-5">
                <button onClick={() => setDispatchRow(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={() => runDispatch(dispatchRow)}
                  disabled={dispatching || !selectedExpertId || !scheduledDate || !scheduledTime}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 disabled:opacity-60 px-4 py-2 text-sm font-bold text-white transition-colors">
                  {dispatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                  Submit
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispatch workflow progress panel */}

      {/* Escalate dialog */}
      <Dialog open={!!escalateRow} onOpenChange={(o) => { if (!o) setEscalateRow(null); }}>
        <DialogContent className="max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          {escalateRow && (
            <>
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-700 shrink-0">
                  <FileText className="h-4 w-4 text-white" />
                </span>
                <div>
                  <DialogTitle className="text-base font-extrabold text-slate-900">Escalate Vendor Delay / Issue</DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Review details and send escalation notification</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 mb-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-3">
                  <ClipboardList className="h-3.5 w-3.5" /> Issue Summary
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Claim ID</div>
                    <div className="mt-0.5 text-sm font-extrabold text-slate-900">{escalateRow.claimId}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendor Name</div>
                    <div className="mt-0.5 text-sm font-extrabold text-slate-900">{escalateRow.vendor}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Status</div>
                    <span className="mt-1 inline-flex rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600">
                      {escalateRow.assignmentStatus}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Status</div>
                    <span className="mt-1 inline-flex rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                      {escalateRow.assignmentSlaStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <PenLine className="h-3.5 w-3.5" /> AI-Drafted Message
                  </div>
                  <button
                    onClick={() => setEditingMessage((e) => !e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <PenLine className="h-3 w-3" /> {editingMessage ? "Done Editing" : "Edit Message"}
                  </button>
                </div>
                {editingMessage ? (
                  <textarea
                    value={escalationMessage}
                    onChange={(e) => setEscalationMessage(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium text-slate-700 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                ) : (
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs italic font-medium text-slate-600 leading-relaxed">
                    {escalationMessage}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 mb-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-3">
                  <Bell className="h-3.5 w-3.5" /> Escalation Actions
                </div>
                <div className="space-y-2.5">
                  {Object.entries(escalationActions).map(([label, checked]) => (
                    <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEscalationActions((a) => ({ ...a, [label]: !a[label] }))}
                        className="h-4 w-4 rounded-full accent-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setEscalateRow(null)}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendEscalation}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 px-4 py-2 text-sm font-bold text-white transition-colors"
                >
                  <Send className="h-3.5 w-3.5" /> Send Escalation
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
