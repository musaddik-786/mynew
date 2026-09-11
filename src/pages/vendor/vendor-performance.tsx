import { useEffect, useMemo, useState } from "react";
import { Clock, Star, DollarSign, ShieldCheck, Trophy, BarChart3, AlertTriangle, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface OverviewVendor {
  vendorId: string;
  name: string;
  specialty: string;
  location: string;
  status: string;
  vis: number | null;
  slaCompliance: number | null;
  variance: number | null;
  rating: number | null;
}

interface VisBreakdown {
  slaScore: number | null;
  costEfficiency: number | null;
  quality: number | null;
  vis: number | null;
}

const visFactors: { key: keyof VisBreakdown; label: string }[] = [
  { key: "slaScore", label: "SLA Score" },
  { key: "costEfficiency", label: "Cost Efficiency" },
  { key: "quality", label: "Quality" },
];

function rankCircle(rank: number): string {
  if (rank === 1) return "bg-amber-400 text-white";
  if (rank === 2) return "bg-slate-400 text-white";
  if (rank === 3) return "bg-orange-500 text-white";
  return "bg-slate-200 text-slate-600";
}

function buildIssues(v: OverviewVendor): string[] {
  const issues: string[] = [];
  if (v.slaCompliance !== null && v.slaCompliance < 80) issues.push(`SLA breach (${Math.round(v.slaCompliance)}%)`);
  if (v.variance !== null && Math.abs(v.variance) > 10) {
    issues.push(`High cost variance (${v.variance > 0 ? "+" : ""}${v.variance.toFixed(0)}%)`);
  }
  if (v.rating !== null && v.rating < 3) issues.push(`Low rating (${v.rating.toFixed(1)}/5)`);
  return issues;
}

export default function VendorPerformance() {
  const [vendors, setVendors] = useState<OverviewVendor[]>([]);
  const [visVendor, setVisVendor] = useState<OverviewVendor | null>(null);
  const [breakdown, setBreakdown] = useState<VisBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    fetch("/api/vendor/overview")
      .then((r) => r.json())
      .then((data) => setVendors(data.vendors ?? []))
      .catch((err) => console.error("Failed to load vendor performance overview:", err));
  }, []);

  const scored = useMemo(() => vendors.filter((v) => v.vis !== null), [vendors]);
  const topVendors = useMemo(() => scored.slice(0, 5), [scored]);
  const bottomPerformers = useMemo(() => [...scored].reverse().slice(0, 5), [scored]);

  const highCount = scored.filter((v) => v.vis! >= 80).length;
  const mediumCount = scored.filter((v) => v.vis! >= 60 && v.vis! < 80).length;
  const lowCount = scored.filter((v) => v.vis! < 60).length;
  const total = scored.length || 1;

  const avgSlaCompliant = vendors.filter((v) => v.slaCompliance !== null);
  const avgSla = avgSlaCompliant.length
    ? avgSlaCompliant.reduce((s, v) => s + v.slaCompliance!, 0) / avgSlaCompliant.length
    : 0;
  const avgVis = scored.length ? scored.reduce((s, v) => s + v.vis!, 0) / scored.length : 0;
  const ratedVendors = vendors.filter((v) => v.rating !== null);
  const avgRating = ratedVendors.length ? ratedVendors.reduce((s, v) => s + v.rating!, 0) / ratedVendors.length : 0;

  const openVisBreakdown = async (v: OverviewVendor) => {
    setVisVendor(v);
    setBreakdown(null);
    setBreakdownLoading(true);
    try {
      const res = await fetch(`/api/vendor/vis-breakdown/${encodeURIComponent(v.vendorId)}`);
      const data = await res.json();
      setBreakdown(data.breakdown ?? null);
    } catch (err) {
      console.error("Failed to load VIS breakdown:", err);
    } finally {
      setBreakdownLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Vendor Performance</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Monitor vendor intelligence scores, SLA compliance, and performance metrics</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg VIS Score</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{avgVis.toFixed(1)}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-blue-800 to-indigo-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg Customer Rating</span>
            <Star className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{avgRating ? `${avgRating.toFixed(1)} / 5` : "—"}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-red-600 to-orange-600">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Total Scored Vendors</span>
            <DollarSign className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{scored.length}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg SLA Compliance</span>
            <ShieldCheck className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{avgSla.toFixed(0)}%</div>
        </div>
      </div>

      {/* Top 5 leaderboard */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600">
          <Trophy className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Top 5 Vendors — VIS Leaderboard</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {topVendors.length === 0 && (
            <div className="px-5 py-6 text-sm text-slate-500 text-center">No scored vendors yet.</div>
          )}
          {topVendors.map((v, i) => (
            <button
              key={v.vendorId}
              onClick={() => openVisBreakdown(v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold shadow-sm ${rankCircle(i + 1)}`}>
                  {i + 1}
                </span>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{v.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{v.specialty} · {v.location}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-extrabold text-emerald-600">
                  {Math.round(v.vis!)} <span className="text-[10px] font-bold text-slate-400">VIS</span>
                </span>
                <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(v.vis!, 100)}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Vendor Performance Distribution */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-blue-600">
          <BarChart3 className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Vendor Performance Distribution</h2>
        </div>
        <div className="p-5 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <TrendingUp className="h-3.5 w-3.5 text-slate-500" /> High Performers
                <span className="text-[10px] font-semibold text-slate-400">(VIS ≥ 80)</span>
              </span>
              <span className="text-sm font-extrabold text-slate-900">{highCount} <span className="text-[11px] font-semibold text-slate-400">({Math.round((highCount / total) * 100)}%)</span></span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-500" style={{ width: `${Math.max((highCount / total) * 100, highCount ? 5 : 0)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <BarChart3 className="h-3.5 w-3.5 text-slate-500" /> Medium Performers
                <span className="text-[10px] font-semibold text-slate-400">(VIS 60-79)</span>
              </span>
              <span className="text-sm font-extrabold text-slate-900">{mediumCount} <span className="text-[11px] font-semibold text-slate-400">({Math.round((mediumCount / total) * 100)}%)</span></span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-700" style={{ width: `${Math.max((mediumCount / total) * 100, mediumCount ? 5 : 0)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <TrendingDown className="h-3.5 w-3.5 text-slate-500" /> Low Performers
                <span className="text-[10px] font-semibold text-slate-400">(VIS &lt; 60)</span>
              </span>
              <span className="text-sm font-extrabold text-slate-900">{lowCount} <span className="text-[11px] font-semibold text-slate-400">({Math.round((lowCount / total) * 100)}%)</span></span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-800 to-red-600" style={{ width: `${Math.max((lowCount / total) * 100, lowCount ? 5 : 0)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 5 performers */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-red-600 to-pink-600">
          <AlertTriangle className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Bottom 5 Performers</h2>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-950 to-violet-950 text-white text-xs font-bold">
              <th className="px-5 py-2.5">Vendor</th>
              <th className="px-5 py-2.5">VIS</th>
              <th className="px-5 py-2.5">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bottomPerformers.map((v) => {
              const issues = buildIssues(v);
              return (
                <tr key={v.vendorId}>
                  <td className="px-5 py-3.5 min-w-[160px]">
                    <div className="font-extrabold text-slate-900 text-sm">{v.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{v.specialty} · {v.location}</div>
                  </td>
                  <td className="px-5 py-3.5 text-lg font-extrabold text-amber-500">{Math.round(v.vis!)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {issues.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No flagged issues</span>
                      ) : (
                        issues.map((issue) => (
                          <span key={issue} className="rounded-full border border-red-200 bg-red-50 text-red-500 px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
                            {issue}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key Insights */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-teal-600 to-emerald-600">
          <Lightbulb className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Key Insights</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 text-sm font-medium text-slate-700">
            <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
            {Math.round((lowCount / total) * 100)}% of vendors ({lowCount}) are below acceptable performance threshold (VIS &lt; 60)
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4 text-amber-500 flex-shrink-0" />
            {avgSlaCompliant.filter((v) => v.slaCompliance! < 90).length} of {avgSlaCompliant.length} scored vendors have SLA compliance below 90%
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-slate-700">
            <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            {Math.round((highCount / total) * 100)}% of vendors ({highCount}) are high performers (VIS ≥ 80), network average VIS is {avgVis.toFixed(0)}
          </div>
        </div>
      </div>

      {/* VIS Breakdown popup */}
      <Dialog open={!!visVendor} onOpenChange={(o) => !o && setVisVendor(null)}>
        <DialogContent className="max-w-md p-6">
          {visVendor && (
            <>
              <DialogTitle className="text-base font-extrabold text-slate-900 mb-1">
                VIS Breakdown — {visVendor.name}
              </DialogTitle>
              <p className="text-xs text-slate-500 mb-4">{visVendor.specialty} · {visVendor.location}</p>
              {breakdownLoading ? (
                <div className="text-sm text-slate-500 py-4 text-center">Loading breakdown…</div>
              ) : !breakdown ? (
                <div className="text-sm text-slate-500 py-4 text-center">
                  VIS breakdown not yet computed for this vendor.
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {visFactors.map((f) => {
                      const score = breakdown[f.key];
                      return (
                        <div key={f.key} className="flex items-center gap-3">
                          <span className="w-32 text-xs font-semibold text-slate-700 flex-shrink-0">{f.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${score ?? 0}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-extrabold text-slate-900">{score !== null ? Math.round(score) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Weighted Total (VIS)</span>
                    <span className="text-xl font-extrabold text-white">{breakdown.vis !== null ? Math.round(breakdown.vis) : "—"}</span>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
