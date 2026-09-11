import { useEffect, useMemo, useState } from "react";
import { Clock, Timer, ShieldCheck, AlertTriangle, ArrowUpDown, BarChart3, AlertCircle, Bell, Trophy, Send, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SlaMetric {
  name: string;
  specialty: string;
  response: string;
  completion: string;
  compliance: number;
}

interface OpenJob {
  claimId: string;
  vendor: string;
  assigned: string;
  days: number | null;
}

interface EtaPrediction {
  claimId: string;
  vendorId: string;
  vendor: string;
  predictedEtaDays: number | null;
  confidence: number | null;
  factors: string | null;
  createdAt: string | null;
}

function medal(rank: number) {
  if (rank === 1) return { wrap: "bg-amber-50 border-amber-300", icon: "🏅" };
  if (rank === 2) return { wrap: "bg-slate-50 border-slate-300", icon: "🥈" };
  if (rank === 3) return { wrap: "bg-amber-50 border-amber-300", icon: "🥉" };
  return { wrap: "bg-white border-slate-200", icon: null };
}

function complianceColor(c: number) {
  if (c >= 90) return "bg-emerald-500";
  if (c >= 80) return "bg-amber-400";
  return "bg-red-500";
}

function statusBadge(c: number) {
  if (c >= 90)
    return <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Compliant</span>;
  if (c >= 80)
    return <span className="inline-flex rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white">At Risk</span>;
  return <span className="inline-flex rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Breached</span>;
}

function leadingNumber(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

export default function VendorSlaTracker() {
  const { toast } = useToast();
  const [slaMetrics, setSlaMetrics] = useState<SlaMetric[]>([]);
  const [openJobs, setOpenJobs] = useState<OpenJob[]>([]);
  const [etaPredictions, setEtaPredictions] = useState<EtaPrediction[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/vendor/sla-metrics").then((r) => r.json()),
      fetch("/api/vendor/open-jobs").then((r) => r.json()),
      fetch("/api/vendor/eta-predictions").then((r) => r.json()),
    ])
      .then(([metricsData, jobsData, etaData]) => {
        setSlaMetrics(metricsData.metrics ?? []);
        setOpenJobs(jobsData.openJobs ?? []);
        setEtaPredictions(etaData.etaPredictions ?? []);
      })
      .catch((err) => console.error("Failed to load SLA tracker data:", err));
  }, []);

  const breachAlerts = useMemo(
    () => slaMetrics.filter((v) => v.compliance < 80).map((v) => ({ ...v, below: 80 - v.compliance })),
    [slaMetrics]
  );
  const top5 = useMemo(() => slaMetrics.slice(0, 5), [slaMetrics]);
  const bottom5 = useMemo(
    () => [...slaMetrics].slice(-5).reverse().map((v, i) => ({ ...v, rank: slaMetrics.length - i })),
    [slaMetrics]
  );

  const escalate = (vendor: string) => {
    toast({
      title: "Escalation Raised",
      description: `SLA breach for ${vendor} has been escalated to the vendor management team.`,
    });
  };

  const sendReminder = (vendor: string, claimId: string) => {
    toast({
      title: "Reminder Sent",
      description: `A reminder for ${claimId} has been sent to ${vendor}.`,
    });
  };

  const avgResponse = useMemo(() => {
    const nums = slaMetrics.map((v) => leadingNumber(v.response)).filter((n): n is number => n !== null);
    return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
  }, [slaMetrics]);
  const avgCompletion = useMemo(() => {
    const nums = slaMetrics.map((v) => leadingNumber(v.completion)).filter((n): n is number => n !== null);
    return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
  }, [slaMetrics]);
  const overallCompliance = slaMetrics.length
    ? Math.round(slaMetrics.reduce((s, v) => s + v.compliance, 0) / slaMetrics.length)
    : 0;

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Vendor SLA Tracker</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Monitor vendor service level agreements, compliance metrics, and escalation triggers</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg Response Time</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{avgResponse !== null ? `${avgResponse} hrs` : "—"}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-blue-800 to-indigo-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg Completion Time</span>
            <Timer className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{avgCompletion !== null ? `${avgCompletion} days` : "—"}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Overall SLA Compliance</span>
            <ShieldCheck className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{overallCompliance}%</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-red-600 to-orange-600">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Delay Frequency</span>
            <AlertTriangle className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{breachAlerts.length} vendors</div>
        </div>
      </div>

      {/* SLA Metrics by Vendor */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-violet-600 to-blue-600">
          <span className="flex items-center gap-2.5">
            <BarChart3 className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">SLA Metrics by Vendor</h2>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
            <ArrowUpDown className="h-3.5 w-3.5" /> Best First
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-white text-left text-[11px] uppercase tracking-wide">
              <th className="px-5 py-2.5 font-bold">Vendor Name</th>
              <th className="px-5 py-2.5 font-bold">Specialty</th>
              <th className="px-5 py-2.5 font-bold">Avg Response Time</th>
              <th className="px-5 py-2.5 font-bold">Avg Completion Time</th>
              <th className="px-5 py-2.5 font-bold">SLA Compliance %</th>
              <th className="px-5 py-2.5 font-bold">SLA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slaMetrics.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No SLA data yet.</td>
              </tr>
            ) : (
              slaMetrics.map((v) => (
                <tr key={v.name} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900">{v.name}</td>
                  <td className="px-5 py-3 text-slate-600">{v.specialty}</td>
                  <td className="px-5 py-3 text-slate-600">{v.response}</td>
                  <td className="px-5 py-3 text-slate-600">{v.completion}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <span className={`block h-full rounded-full ${complianceColor(v.compliance)}`} style={{ width: `${v.compliance}%` }} />
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">{v.compliance}%</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">{statusBadge(v.compliance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SLA Breach Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <h2 className="text-slate-900 font-extrabold text-sm">SLA Breach Alerts</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {breachAlerts.length === 0 && (
            <div className="text-sm text-slate-500 col-span-full text-center py-4">No SLA breaches right now.</div>
          )}
          {breachAlerts.map((b) => (
            <div key={b.name} className="rounded-xl border-2 border-amber-400 bg-amber-50/40 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{b.name}</div>
                  <span className="mt-1 inline-flex rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Warning
                  </span>
                </div>
                <span className="text-2xl font-extrabold text-red-600">{b.compliance}%</span>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-500">{b.below}% below 80% SLA threshold</div>
              <button
                onClick={() => escalate(b.name)}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-800 to-red-700 px-3 py-2 text-[11px] font-bold text-white hover:from-red-700 hover:to-red-600 transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Escalate
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Escalation Triggers — Open Jobs */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-red-500">
          <Bell className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Escalation Triggers — Open Jobs</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-950 text-white text-left text-[11px] uppercase tracking-wide">
              <th className="px-5 py-2.5 font-bold">Claim ID</th>
              <th className="px-5 py-2.5 font-bold">Vendor Name</th>
              <th className="px-5 py-2.5 font-bold">Assigned Date</th>
              <th className="px-5 py-2.5 font-bold">Days Since Assignment</th>
              <th className="px-5 py-2.5 font-bold">Status</th>
              <th className="px-5 py-2.5 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {openJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No overdue open jobs.</td>
              </tr>
            ) : (
              openJobs.map((j, i) => (
                <tr key={`${j.claimId}-${j.vendor}-${i}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600 text-xs font-semibold">{j.claimId}</td>
                  <td className="px-5 py-3 font-bold text-slate-900">{j.vendor}</td>
                  <td className="px-5 py-3 text-slate-600">{j.assigned}</td>
                  <td className="px-5 py-3 font-bold text-red-600">{j.days !== null ? `${j.days} days` : "—"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-red-800 px-2.5 py-0.5 text-[10px] font-bold text-white">Overdue</span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => sendReminder(j.vendor, j.claimId)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition-colors"
                    >
                      <Send className="h-3 w-3" /> Send Reminder
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ETA Predictions */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600">
          <Zap className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">ETA Predictions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-950 text-white text-left text-[11px] uppercase tracking-wide">
                <th className="px-5 py-2.5 font-bold">Claim ID</th>
                <th className="px-5 py-2.5 font-bold">Vendor</th>
                <th className="px-5 py-2.5 font-bold">Predicted ETA (days)</th>
                <th className="px-5 py-2.5 font-bold">Confidence</th>
                <th className="px-5 py-2.5 font-bold">Key Factors</th>
                <th className="px-5 py-2.5 font-bold">Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {etaPredictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No ETA predictions yet. Run the Dispatch flow to generate predictions.
                  </td>
                </tr>
              ) : (
                etaPredictions.map((e, i) => {
                  const confidencePct = e.confidence !== null ? Math.round(e.confidence * (e.confidence <= 1 ? 100 : 1)) : null;
                  let factors: string[] = [];
                  try { factors = e.factors ? JSON.parse(e.factors) : []; } catch { factors = e.factors ? [e.factors] : []; }
                  return (
                    <tr key={`${e.claimId}-${e.vendorId}-${i}`} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-xs font-semibold text-slate-600">{e.claimId}</td>
                      <td className="px-5 py-3 font-bold text-slate-900">{e.vendor}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-extrabold text-indigo-700">
                          <Clock className="h-3 w-3" />
                          {e.predictedEtaDays !== null ? `${e.predictedEtaDays} days` : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {confidencePct !== null ? (
                          <span className="flex items-center gap-2">
                            <span className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <span className={`block h-full rounded-full ${confidencePct >= 80 ? "bg-emerald-500" : confidencePct >= 60 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${confidencePct}%` }} />
                            </span>
                            <span className="text-xs font-extrabold text-slate-700">{confidencePct}%</span>
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {factors.length > 0
                            ? factors.slice(0, 3).map((f, fi) => (
                                <span key={fi} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{f}</span>
                              ))
                            : <span className="text-slate-400 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">{e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 / Bottom 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600">
            <Trophy className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">Top 5 — Best SLA Compliance</h2>
          </div>
          <div className="p-4 space-y-3">
            {top5.map((v, i) => {
              const m = medal(i + 1);
              return (
                <div key={v.name} className={`rounded-lg border ${m.wrap} px-4 py-3`}>
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-sm font-extrabold text-slate-600">{m.icon ?? `#${i + 1}`}</span>
                    <div className="flex-1">
                      <div className="text-xs font-extrabold text-slate-900">{v.name}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${v.compliance}%` }} />
                        </span>
                        <span className="text-[11px] font-extrabold text-slate-700">{v.compliance}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-rose-600 to-pink-600">
            <AlertTriangle className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">Bottom 5 — Lowest SLA Compliance</h2>
          </div>
          <div className="p-4 space-y-3">
            {bottom5.map((v) => (
              <div key={v.name} className="rounded-lg border border-rose-200 bg-rose-50/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-xs font-extrabold text-rose-600">#{v.rank}</span>
                  <div className="flex-1">
                    <div className="text-xs font-extrabold text-slate-900">{v.name}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <span className={`block h-full rounded-full ${v.compliance >= 75 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${v.compliance}%` }} />
                      </span>
                      <span className="text-[11px] font-extrabold text-rose-600">{v.compliance}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
