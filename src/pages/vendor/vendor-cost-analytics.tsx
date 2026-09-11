import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  DollarSign,
  Activity,
  BarChart3,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CostVarianceRow {
  vendorId: string;
  vendor: string;
  avgEst: number;
  avgActual: number;
  variance: number;
}

interface BenchmarkVendor {
  name: string;
  cost: number;
  direction: "above" | "below" | "at" | null;
}

interface BenchmarkGroup {
  specialty: string;
  avg: number;
  vendors: BenchmarkVendor[];
}

interface CostRecord {
  vendor: string;
  claimId: string;
  estimated: number;
  actual: number | null;
  status: "Pending" | "Completed";
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function VendorCostAnalytics() {
  const [costComparison, setCostComparison] = useState<CostVarianceRow[]>([]);
  const [benchmarkGroups, setBenchmarkGroups] = useState<BenchmarkGroup[]>([]);
  const [costRecords, setCostRecords] = useState<CostRecord[]>([]);
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/vendor/cost-variance").then((r) => r.json()),
      fetch("/api/vendor/cost-benchmarking").then((r) => r.json()),
      fetch("/api/vendor/cost-records").then((r) => r.json()),
    ])
      .then(([costData, benchmarkData, recordsData]) => {
        setCostComparison(costData.costVariances ?? []);
        setBenchmarkGroups(benchmarkData.benchmarkGroups ?? []);
        setCostRecords(recordsData.records ?? []);
      })
      .catch((err) => console.error("Failed to load cost analytics data:", err));
  }, []);

  const maxVariance = useMemo(
    () => Math.max(1, ...costComparison.map((r) => Math.abs(r.variance))),
    [costComparison]
  );
  const benchmarkMax = useMemo(
    () => Math.max(1, ...benchmarkGroups.flatMap((g) => g.vendors.map((v) => v.cost)), ...benchmarkGroups.map((g) => g.avg)),
    [benchmarkGroups]
  );

  const totalProcessed = costRecords.length;
  const avgEstimate = totalProcessed ? costRecords.reduce((s, r) => s + r.estimated, 0) / totalProcessed : 0;
  const completedRecords = costRecords.filter((r) => r.actual !== null);
  const avgActual = completedRecords.length ? completedRecords.reduce((s, r) => s + (r.actual ?? 0), 0) / completedRecords.length : 0;
  const overallVariance = avgEstimate ? ((avgActual - avgEstimate) / avgEstimate) * 100 : 0;

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Cost &amp; Estimate Analytics</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Analyze vendor cost variances, benchmarks, and estimation accuracy</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Total Estimates Processed</span>
            <FileText className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{totalProcessed}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-blue-800 to-indigo-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg Estimate Amount</span>
            <FileText className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{fmt(avgEstimate)}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-emerald-600 to-green-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Avg Actual Cost</span>
            <DollarSign className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-2xl font-extrabold">{fmt(avgActual)}</div>
        </div>
        <div className="rounded-xl px-5 py-4 text-white shadow-md bg-gradient-to-br from-red-600 to-orange-600">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Overall Variance %</span>
            <Activity className="h-4 w-4 opacity-80" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold">{overallVariance.toFixed(1)}%</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">{overallVariance >= 0 ? "Overrun" : "Underrun"}</span>
          </div>
        </div>
      </div>

      {/* Cost Comparison by Vendor */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-blue-600">
          <BarChart3 className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Cost Comparison by Vendor</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-white text-left text-[11px] uppercase tracking-wide">
              <th className="px-5 py-2.5 font-bold">Vendor</th>
              <th className="px-5 py-2.5 font-bold">Avg Estimate ($)</th>
              <th className="px-5 py-2.5 font-bold">Avg Actual Cost ($)</th>
              <th className="px-5 py-2.5 font-bold">Variance (%)</th>
              <th className="px-5 py-2.5 font-bold">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costComparison.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No cost variance data yet.</td>
              </tr>
            ) : (
              costComparison.map((r) => (
                <tr key={r.vendorId} className="odd:bg-amber-50/40 hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900">{r.vendor}</td>
                  <td className="px-5 py-3 text-slate-700">{fmt(r.avgEst)}</td>
                  <td className="px-5 py-3 text-slate-700">{fmt(r.avgActual)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white ${
                        r.variance > 0 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    >
                      {r.variance > 0 ? "+" : ""}
                      {r.variance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.variance > 0 ? (
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-emerald-500" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Over/Under Estimation Trends */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600">
          <Activity className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Over/Under Estimation Trends</h2>
        </div>
        <div className="p-6 space-y-3">
          {costComparison.map((r) => (
            <div key={r.vendorId} className="grid grid-cols-[160px_1fr_60px] items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 text-right truncate">{r.vendor}</span>
              <div className="relative h-5">
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
                {r.variance >= 0 ? (
                  <div
                    className="absolute inset-y-0 left-1/2 rounded-r-full bg-red-400"
                    style={{ width: `${(r.variance / maxVariance) * 48}%` }}
                  />
                ) : (
                  <div
                    className="absolute inset-y-0 rounded-l-full bg-emerald-400"
                    style={{ right: "50%", width: `${(Math.abs(r.variance) / maxVariance) * 48}%` }}
                  />
                )}
              </div>
              <span className={`text-xs font-extrabold ${r.variance >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {r.variance > 0 ? "+" : ""}
                {r.variance.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Benchmarking by Specialty */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-red-600">
          <Target className="h-4 w-4 text-white" />
          <h2 className="text-white font-extrabold text-sm">Cost Benchmarking by Specialty</h2>
        </div>
        <div className="p-6 space-y-7">
          {benchmarkGroups.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">No benchmark data yet.</div>
          )}
          {benchmarkGroups.map((g) => (
            <div key={g.specialty}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-extrabold text-slate-900">{g.specialty}</span>
                <span className="text-[11px] font-semibold text-slate-400">Avg: {fmt(g.avg)}</span>
              </div>
              <div className="space-y-2.5">
                {g.vendors.map((v) => {
                  const above = v.direction === "above";
                  return (
                    <div key={v.name} className="grid grid-cols-[150px_1fr_auto] items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 text-right truncate">{v.name}</span>
                      <div className="relative h-4 rounded-full bg-slate-100 overflow-visible">
                        <div
                          className={`h-full rounded-full ${above ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${Math.min((v.cost / benchmarkMax) * 100, 100)}%` }}
                        />
                        <div
                          className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-slate-800"
                          style={{ left: `${Math.min((g.avg / benchmarkMax) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800 w-16 text-right">{fmt(v.cost)}</span>
                        {above && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                            Above Benchmark
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Cost Records */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setRecordsOpen((o) => !o)}
          className="w-full px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-left"
        >
          <span className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-white" />
            <span className="text-white font-extrabold text-sm">Detailed Cost Records</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            {recordsOpen ? "Collapse" : "Expand"}
            {recordsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>
        {recordsOpen && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-950 text-white text-left text-[11px] uppercase tracking-wide">
                <th className="px-5 py-2.5 font-bold">Vendor</th>
                <th className="px-5 py-2.5 font-bold">Claim ID</th>
                <th className="px-5 py-2.5 font-bold">Estimated Cost</th>
                <th className="px-5 py-2.5 font-bold">Actual Cost</th>
                <th className="px-5 py-2.5 font-bold">Difference</th>
                <th className="px-5 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {costRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No cost records yet.</td>
                </tr>
              ) : (
                costRecords.map((r, i) => {
                  const diff = r.actual !== null ? r.actual - r.estimated : null;
                  return (
                    <tr key={`${r.claimId}-${i}`} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-900">{r.vendor}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{r.claimId}</td>
                      <td className="px-5 py-3 text-slate-700">{fmt(r.estimated)}</td>
                      <td className="px-5 py-3">
                        {r.actual !== null ? (
                          <span className="text-slate-700">{fmt(r.actual)}</span>
                        ) : (
                          <span className="italic text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {diff !== null ? (
                          <span className={`font-bold ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {diff > 0 ? `+$${Math.round(diff).toLocaleString()}` : `$-${Math.abs(Math.round(diff)).toLocaleString()}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === "Completed" ? (
                          <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Completed</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
