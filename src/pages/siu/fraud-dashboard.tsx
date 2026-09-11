import { useEffect, useState } from "react";
import { Clock, AlertTriangle, ClipboardList, UserCheck, FileText, CheckCircle2, Loader2 } from "lucide-react";

interface FlaggedClaim {
  id: string;
  siuCaseId: string | null;
  policyholder: string;
  lossType: string;
  status: string;
  investigator: string;
  fraudScore: number | null;
}

const recentActivity = [
  { name: "John Davis", desc: "there was a pipe burst in kitchen area", status: "Loss Investigation" },
  { name: "FNTest_132 LNTest_132", desc: "Pipe under kitchen sink burst at 8am, flooding kitchen floor and two b...", status: "Loss Investigation" },
  { name: "FNTest_132 LNTest_132", desc: "Storm on June 1st, 2026 caused hail and wind damage to roof and gutters. 60...", status: "Approved" },
  { name: "FNTest_132 LNTest_132", desc: "Pipe burst in kitchen caused sudden water damage to kitchen and nea...", status: "Loss Investigation" },
  { name: "FNTest_132 LNTest_132", desc: "Pipe under kitchen sink burst, flooding kitchen floor and lower cabinets. Dam...", status: "Approved" },
];

function fraudSeverity(score: number | null): string {
  if (score === null) return "Unknown";
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function severityColor(severity: string): string {
  if (severity === "High") return "bg-red-600";
  if (severity === "Medium") return "bg-amber-500";
  return "bg-emerald-600";
}

export default function FraudDashboard() {
  const [flaggedClaims, setFlaggedClaims] = useState<FlaggedClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/siu/cases")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.cases)) {
          const flagged = (data.cases as Array<{
            claimId: string;
            siuId: string | null;
            policyholder: string;
            lossType: string;
            status: string;
            investigator: string;
            fraudScore: number | null;
            fraudFlag: number;
          }>)
            .filter((c) => c.fraudFlag === 1)
            .map((c) => ({
              id: c.claimId,
              siuCaseId: c.siuId ?? null,
              policyholder: c.policyholder,
              lossType: c.lossType,
              status: c.status,
              investigator: c.investigator,
              fraudScore: c.fraudScore,
            } as FlaggedClaim));
          setFlaggedClaims(flagged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Fraud Investigation Center</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Investigate suspicious claims and anomalies</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Suspected Claims</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">29</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-blue-800 to-indigo-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Anomalies Flagged</span>
            <AlertTriangle className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{loading ? "—" : flaggedClaims.length}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-orange-600 to-red-600">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Investigation Queue</span>
            <ClipboardList className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">18</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Resolved This Week</span>
            <UserCheck className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">4</div>
        </div>
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flagged Claims */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-violet-600 to-blue-600">
            <h2 className="text-white font-extrabold text-sm">Flagged Claims</h2>
            <button className="text-[11px] font-bold text-white/80 hover:text-white">View All →</button>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="px-5 py-8 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading flagged claims…</span>
              </div>
            ) : flaggedClaims.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No flagged claims found.</div>
            ) : (
              flaggedClaims.map((c) => {
                const severity = fraudSeverity(c.fraudScore);
                return (
                  <div key={c.id} className="relative px-5 py-4 bg-violet-50/30 hover:bg-violet-50/60 transition-colors">
                    <span className="absolute inset-y-0 left-0 w-1 bg-violet-500" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-violet-600">{c.id}</div>
                        <div className="mt-0.5 text-sm font-bold text-slate-900">{c.policyholder}</div>
                        <div className="mt-1 text-[11px] text-slate-400 font-medium">
                          {c.lossType} <span className="mx-1">•</span> {c.status}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Investigator: <span className="font-medium text-slate-600">{c.investigator}</span>
                          {c.fraudScore !== null && (
                            <> <span className="mx-1">•</span> Fraud score: <span className="font-medium text-slate-600">{c.fraudScore}</span></>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0 ${severityColor(severity)}`}>
                        {severity}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-600">
            <h2 className="text-white font-extrabold text-sm">Recent Activity</h2>
            <button className="text-[11px] font-bold text-white/80 hover:text-white">View All →</button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                      a.status === "Approved" ? "bg-emerald-100" : "bg-blue-100"
                    }`}
                  >
                    {a.status === "Approved" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-600" />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{a.name}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{a.desc}</div>
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0 ${
                    a.status === "Approved" ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
