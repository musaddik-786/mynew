import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Phone,
  Search,
  Shield,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

// const VENDOR_MATCHING_AGENT_URL = "http://localhost:9102";
const VENDOR_MATCHING_AGENT_URL = "http://10.4.173.136:9102";
const VENDOR_ORCHESTRATOR_URL = import.meta.env.VITE_VENDOR_ORCHESTRATOR_URL ?? "http://10.4.173.139:9120"; //"http://10.4.173.139:9120";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (val: number | null | undefined) => {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US").format(val);
};

function rankCircle(rank: number): string {
  if (rank === 1) return "bg-amber-400 text-white";
  if (rank === 2) return "bg-slate-400 text-white";
  if (rank === 3) return "bg-orange-400 text-white";
  return "bg-slate-200 text-slate-600";
}

function subroPill(level: string): string {
  if (level === "High") return "bg-red-500";
  if (level === "Medium") return "bg-amber-500";
  return "bg-emerald-500";
}

export default function SmartVendorMatch() {
  const { toast } = useToast();
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedClaimNumber, setSelectedClaimNumber] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("vis");

  const [matchingRunning, setMatchingRunning] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingResult, setMatchingResult] = useState<{
    vendorName: string;
    vendorId: string;
    specialty: string;
    assignmentStatus: string;
    slaStatus: string;
    rawText: string;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const matchingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/claims")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load claims (${res.status})`);
        return res.json();
      })
      .then((d) => {
        const list = d.claims || [];
        setClaims(list);
        if (list.length > 0) setSelectedClaimNumber(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMatchingResult(null);
    setMatchingError(null);
    setAccepted(false);
    matchingAbortRef.current?.abort();
    const qs = selectedClaimNumber ? `?claimNumber=${encodeURIComponent(selectedClaimNumber)}` : "";
    fetch(`/api/adjuster/vendor-match${qs}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => setData(json))
      .catch(() => {});
  }, [selectedClaimNumber]);

  const specialties = useMemo(
    () => Array.from(new Set((data?.vendors || []).map((v: any) => String(v.specialty)))) as string[],
    [data]
  );

  const rankedVendors = useMemo(() => {
    let list = [...(data?.vendors || [])];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v: any) =>
          v.name.toLowerCase().includes(q) ||
          v.specialty.toLowerCase().includes(q) ||
          `${v.city}, ${v.state}`.toLowerCase().includes(q)
      );
    }
    if (specialtyFilter !== "all") list = list.filter((v: any) => v.specialty === specialtyFilter);
    if (sortBy === "vis") list.sort((a: any, b: any) => b.visScore - a.visScore);
    else if (sortBy === "rating") list.sort((a: any, b: any) => b.rating - a.rating);
    else if (sortBy === "cost") list.sort((a: any, b: any) => a.avgCost - b.avgCost);
    return list;
  }, [data, search, specialtyFilter, sortBy]);

  const stats = data?.stats;
  const subro = data?.claim?.subrogationPotential || "Low";

  const parseMatchingResult = useCallback((raw: string) => {
    // Strip tool lifecycle markers
    let clean = raw.replace(/\[Tool:[^\]]+\]\s*(Starting\.\.\.|Done)/g, "").trim();

    // Normalize: insert newlines before known field labels so values don't bleed together
    // (SSE tokens are concatenated without whitespace between them)
    const FIELD_LABELS = [
      "Vendor Recommended", "Vendor Name", "Vendor ID", "VendorID",
      "Specialty", "Loss Type", "Location", "Assignment Status", "SLA Status", "End",
    ];
    for (const label of FIELD_LABELS) {
      clean = clean.replace(new RegExp(`(?<!\n)(${label}:)`, "g"), "\n$1");
    }

    // Extract value on the same line as a label, stopping at end of line
    const extract = (keys: string[]): string => {
      for (const key of keys) {
        const re = new RegExp(`^${key}[:\\s]+(.+)$`, "im");
        const m = clean.match(re);
        if (m) return m[1].trim();
      }
      return "—";
    };

    return {
      vendorName: extract(["Vendor Recommended", "Vendor Assigned", "Vendor Name"]),
      vendorId: extract(["Vendor ID", "VendorID"]),
      specialty: extract(["Specialty"]),
      assignmentStatus: extract(["Assignment Status", "AssignmentStatus"]) || "Recommended",
      slaStatus: extract(["SLA Status", "SLAStatus"]) || "Pending",
      rawText: clean.replace(/\bEnd\b/g, "").trim(),
    };
  }, []);

  async function startVendorMatching() {
    if (!selectedClaimNumber) {
      toast({ title: "No Claim Selected", description: "Please select a claim before starting vendor matching.", variant: "destructive" });
      return;
    }
    matchingAbortRef.current?.abort();
    const ctrl = new AbortController();
    matchingAbortRef.current = ctrl;

    setMatchingRunning(true);
    setMatchingResult(null);
    setMatchingError(null);

    const message = `Find and assign the best vendor for claim ${selectedClaimNumber}.`;

    try {
      const resp = await fetch(`${VENDOR_MATCHING_AGENT_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`Agent returned ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = (line.startsWith("data: ") ? line.slice(6) : line.slice(5)).replace(/\r$/, "");
          if (!raw || raw === "[DONE]") continue;
          accumulated += raw;
        }
      }

      setMatchingResult(parseMatchingResult(accumulated));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMatchingError("Could not reach the Vendor Matching Agent. Make sure it is running on port 9102.");
      }
    } finally {
      setMatchingRunning(false);
    }
  }

  async function acceptRecommendation() {
    if (!matchingResult || !selectedClaimNumber) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/vendor/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: selectedClaimNumber,
          vendor_id: matchingResult.vendorId,
          vendor_type: matchingResult.specialty,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `HTTP ${res.status}`);
      }
      setAccepted(true);
      toast({ title: "Vendor Assigned", description: `${matchingResult.vendorName} has been assigned to ${selectedClaimNumber}. Running SLA & Performance assessment…` });
      // Fire-and-forget: trigger no-dispatch SLA + Performance flow on the orchestrator.
      // Results will be visible on the Vendor Dashboard and SLA Tracker pages.
      fetch(`${VENDOR_ORCHESTRATOR_URL}/no-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: selectedClaimNumber, vendor_id: matchingResult.vendorId }),
      }).catch(() => {});
    } catch (err) {
      toast({ title: "Assignment Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-7 py-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Vendor Matching Intelligence</h1>
            <p className="mt-0.5 text-sm text-indigo-200/80 font-medium">AI-ranked vendors using 9-factor Vendor Intelligence Score (VIS)</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-white whitespace-nowrap">
            VIS Records: {stats ? stats.totalVendors : "—"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-white whitespace-nowrap">
            <Users className="h-3.5 w-3.5" /> {stats ? stats.totalVendors : "—"} Vendors
          </span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, specialty, or location..."
            className="w-full rounded-full bg-white border border-slate-200 pl-11 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-full md:w-48 rounded-full bg-white border-slate-200 font-semibold text-sm h-10 shadow-sm">
            <span className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-slate-400" /><SelectValue placeholder="All Specialties" /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specialties</SelectItem>
            {specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-44 rounded-full bg-white border-slate-200 font-semibold text-sm h-10 shadow-sm">
            <span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-slate-400" /><SelectValue placeholder="VIS Score" /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vis">VIS Score</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="cost">Avg Cost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI-Powered Vendor Recommendation */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-800 px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <FileText className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <h2 className="text-white font-extrabold">AI-Powered Vendor Recommendation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select a claim to compute the 9-factor Vendor Intelligence Score (VIS)</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Select Claim</label>
              <Select value={selectedClaimNumber} onValueChange={setSelectedClaimNumber}>
                <SelectTrigger className="w-full rounded-lg border-slate-200 font-semibold text-sm h-10">
                  <SelectValue placeholder="Select claim" />
                </SelectTrigger>
                <SelectContent>
                  {claims.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">Loss Type</div>
              <span className="inline-flex rounded-full bg-blue-500 px-3.5 py-1.5 text-[11px] font-bold text-white">
                {data?.claim?.lossType || "—"}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">Required Specialty</div>
              <span className="inline-flex rounded-full bg-violet-500 px-3.5 py-1.5 text-[11px] font-bold text-white">
                {data?.claim?.requiredSpecialty || "—"}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">Subrogation Potential</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white ${subroPill(subro)}`}>
                  {subro}
                </span>
                {subro === "High" && (
                  <span className="text-[11px] font-semibold text-red-500">Forensic-compliant vendors prioritized</span>
                )}
              </div>
            </div>
          </div>

          {matchingRunning ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm font-semibold text-violet-600">Finding best vendor for {selectedClaimNumber}…</p>
              <p className="text-xs text-slate-400">Running match and assignment tools</p>
            </div>
          ) : matchingError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-medium text-sm">{matchingError}</div>
          ) : matchingResult ? (
            <div className={`rounded-xl border-2 p-5 ${accepted ? "border-emerald-400 bg-emerald-50/60" : "border-violet-300 bg-violet-50/40"}`}>
              {/* Header */}
              <div className="flex items-start gap-3 mb-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow ${accepted ? "bg-emerald-500" : "bg-violet-500"}`}>
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-slate-900">
                      {accepted ? "Vendor Successfully Assigned" : "AI Vendor Recommendation"}
                    </h3>
                    <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold text-white ${accepted ? "bg-emerald-500" : "bg-violet-500"}`}>
                      {accepted ? "Assigned" : "AI Matched"}
                    </span>
                  </div>
                  <p className={`text-xs font-semibold mt-1 ${accepted ? "text-emerald-700" : "text-violet-700"}`}>
                    {accepted
                      ? `Vendor assigned to claim ${selectedClaimNumber}`
                      : `Best available vendor recommended for claim ${selectedClaimNumber} — click Accept to confirm`}
                  </p>
                </div>
              </div>
              {/* Details grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-white border border-slate-100 px-4 py-3">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">Vendor Name</div>
                  <div className="font-extrabold text-slate-900 text-sm">{matchingResult.vendorName}</div>
                </div>
                <div className="rounded-lg bg-white border border-slate-100 px-4 py-3">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">Vendor ID</div>
                  <div className="font-extrabold text-violet-600 text-sm">{matchingResult.vendorId}</div>
                </div>
                <div className="rounded-lg bg-white border border-slate-100 px-4 py-3">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">Specialty</div>
                  <div className="font-extrabold text-slate-900 text-sm">{matchingResult.specialty}</div>
                </div>
                <div className="rounded-lg bg-white border border-slate-100 px-4 py-3">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">Claim</div>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedClaimNumber}</div>
                </div>
              </div>
              {/* Accept button or confirmed state */}
              {!accepted ? (
                <button
                  onClick={acceptRecommendation}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors"
                >
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {accepting ? "Assigning…" : "Accept Recommendation"}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Vendor assigned successfully
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
              <Zap className="h-8 w-8 text-violet-300" />
              <p className="text-sm font-medium">Click <span className="font-bold text-violet-600">Start Vendor Matching</span> to find the best vendor for this claim</p>
            </div>
          )}
        </div>
      </div>

      {/* Start Vendor Matching button — outside the box */}
      <div className="flex justify-start">
        <button
          onClick={startVendorMatching}
          disabled={matchingRunning || !selectedClaimNumber}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors"
        >
          {matchingRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Start Vendor Matching
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span className="text-[11px] font-bold text-slate-500">License Verified</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">{stats.licenseVerified}</div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-blue-500" />
              <span className="text-[11px] font-bold text-slate-500">Avg Rating</span>
            </div>
            <div className="text-2xl font-extrabold text-blue-600">{stats.avgRating}</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-[11px] font-bold text-slate-500">Avg Turnaround</span>
            </div>
            <div className="text-2xl font-extrabold text-amber-600">{stats.avgTurnaroundDays} days</div>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-violet-500" />
              <span className="text-[11px] font-bold text-slate-500">Total Jobs</span>
            </div>
            <div className="text-2xl font-extrabold text-violet-600">{fmt(stats.totalJobs)}</div>
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-teal-500" />
              <span className="text-[11px] font-bold text-slate-500">STP Ready</span>
            </div>
            <div className="text-2xl font-extrabold text-teal-600">{stats.stpReady}</div>
          </div>
        </div>
      )}

      {/* Ranked Vendor List */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-6 py-4">
          <h2 className="flex items-center gap-2 text-white font-extrabold">
            <TrendingUp className="h-4 w-4" /> Ranked Vendor List
          </h2>
          <p className="text-xs text-blue-100/90 mt-0.5">
            Vendors ranked by 9-factor VIS: Specialty, License, SLA, Cost, Capacity, Rework, Subro, Risk, Concentration
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-extrabold tracking-wide text-slate-500">
                <th className="px-4 py-3">RANK</th>
                <th className="px-4 py-3">VENDOR NAME</th>
                <th className="px-4 py-3">SPECIALTY</th>
                <th className="px-4 py-3">LICENSE</th>
                <th className="px-4 py-3">RATING</th>
                <th className="px-4 py-3">AVG COST</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">JOBS</th>
                <th className="px-4 py-3">LOCATION</th>
                <th className="px-4 py-3">VIS SCORE</th>
                <th className="px-4 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankedVendors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500 text-sm">No vendors found</td>
                </tr>
              ) : (
                rankedVendors.map((v: any, i: number) => (
                  <tr key={v.name} className={i % 2 === 0 ? "bg-amber-50/40" : "bg-white"}>
                    <td className="px-4 py-4">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold shadow-sm ${rankCircle(i + 1)}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 min-w-[190px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">{v.name}</span>
                        {v.verified && (
                          <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[9px] font-bold">STP</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                        <Phone className="h-3 w-3" /> {v.phone}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold">SLA: On Track</span>
                        <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold">
                          Risk: {v.fraudScore >= 0.4 ? "High" : v.fraudScore >= 0.2 ? "Medium" : "Low"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-amber-100/80 text-teal-700 px-3 py-1 text-[10px] font-bold whitespace-nowrap">
                        {v.specialty}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        {v.licenseValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">{v.licenseNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${s <= Math.round(v.rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                          />
                        ))}
                        <span className="text-xs font-bold text-slate-700 ml-1">{v.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 whitespace-nowrap">
                        <DollarSign className="h-3.5 w-3.5" />{fmt(v.avgCost)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 whitespace-nowrap">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> {v.avgTurnaroundDays}d
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{fmt(v.completedJobs)}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" /> {v.city}, {v.state}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white">
                        {v.visScore}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleAction(`Assign ${v.name}`)}
                        className="inline-flex rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
