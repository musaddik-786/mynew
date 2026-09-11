import { useEffect, useRef, useState } from "react";
import { Upload, MapPin, Sparkles, Mail, Phone, FileText, CheckCircle2, XCircle, UserPlus, ClipboardList, ShieldCheck, Calendar, Hash, X, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const VENDOR_ORCHESTRATOR_URL = "http://10.4.173.139:9120";

type WfStage = "onboarding" | "qualifying" | "capacity" | "cost";

const STAGES: { key: WfStage; label: string }[] = [
  { key: "onboarding", label: "Onboarding" },
  { key: "qualifying", label: "Qualification" },
  { key: "capacity", label: "Capacity Check" },
  { key: "cost", label: "Cost Benchmark" },
];

const TOOL_STAGE: Record<string, WfStage> = {
  submit_vendor_application: "onboarding",
  score_vendor_qualification: "qualifying",
  get_vendor_active_jobs: "capacity",
  manage_vendor_capacity: "capacity",
  get_vendor_benchmark: "cost",
  get_vendor_cost_inputs: "cost",
};

interface WorkflowState {
  vendorName: string;
  applicationId: number;
  activeStage: WfStage | null;
  completedStages: WfStage[];
  halted: boolean;
  done: boolean;
  running: boolean;
  log: string;
  error: string | null;
}

interface Application {
  id: number;
  name: string;
  specialty: string;
  location: string;
  license: string;
  expires: string;
  submitted: string;
  status: "Pending" | "Approved" | "Rejected";
  rejectionReason?: string | null;
}

const serviceAreaStates = ["NY", "CA", "FL", "TX", "IL", "OH", "GA", "PA", "AZ", "WA", "NJ", "LA", "NV", "MI", "MN", "CO", "NC", "VA", "OR", "UT"];
const specializations = ["Water", "Fire", "Wind", "Structural", "Roofing", "Electrical", "General", "Landscaping", "Glass/Windows", "Security Systems", "Salvage"];

export default function VendorOnboarding() {
  const { toast } = useToast();
  const [pending, setPending] = useState<Application[]>([]);
  const [processed, setProcessed] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const wfLogRef = useRef("");

  async function streamOrchestrator(url: string, body: object, isResume: boolean) {
    if (!isResume) {
      wfLogRef.current = "";
      setWorkflow((prev) => prev ? { ...prev, running: true, halted: false, done: false, log: "", error: null, activeStage: null, completedStages: [] } : prev);
    } else {
      wfLogRef.current = "";
      setWorkflow((prev) => prev ? { ...prev, running: true, halted: false, error: null, log: "" } : prev);
    }

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            const stage = TOOL_STAGE[toolStart[1].trim()];
            if (stage) setWorkflow((prev) => prev ? { ...prev, activeStage: stage } : prev);
          } else if (toolDone) {
            const stage = TOOL_STAGE[toolDone[1].trim()];
            if (stage) {
              setWorkflow((prev) => {
                if (!prev) return prev;
                const completed = prev.completedStages.includes(stage) ? prev.completedStages : [...prev.completedStages, stage];
                return { ...prev, completedStages: completed, activeStage: null };
              });
            }
          } else {
            wfLogRef.current += chunk;
            const logSnapshot = wfLogRef.current;
            const isHalt = chunk.includes("⛔") || chunk.includes("awaiting approval") || chunk.includes("awaiting a decision");
            setWorkflow((prev) => {
              if (!prev) return prev;
              return { ...prev, log: logSnapshot, halted: prev.halted || isHalt };
            });
          }
        }
      }
    } catch (err) {
      setWorkflow((prev) => prev ? { ...prev, error: String(err), running: false } : prev);
      return;
    }

    setWorkflow((prev) => {
      if (!prev) return prev;
      const done = prev.completedStages.includes("cost");
      return { ...prev, running: false, done, activeStage: null };
    });
  }

  const loadApplications = async () => {
    try {
      const [pendingRes, processedRes] = await Promise.all([
        fetch("/api/vendor/applications?status=Pending"),
        fetch("/api/vendor/applications?status=Approved,Rejected"),
      ]);
      const [pendingData, processedData] = await Promise.all([pendingRes.json(), processedRes.json()]);
      setPending(pendingData.applications ?? []);
      setProcessed(processedData.applications ?? []);
    } catch (err) {
      console.error("Failed to load vendor applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const decide = async (application: Application, decision: "Approved" | "Rejected", reason?: string) => {
    try {
      const endpoint = decision === "Approved"
        ? `/api/vendor/applications/${application.id}/approve`
        : `/api/vendor/applications/${application.id}/reject`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: decision === "Rejected" ? JSON.stringify({ reason }) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to ${decision.toLowerCase()} application`);
      }

      if (decision === "Approved") {
        const responseData = await res.json().catch(() => ({}));
        const vendorId: string = responseData.vendorId ?? "";

        setWorkflow((prev) => prev ? {
          ...prev,
          running: true,
          halted: false,
          done: false,
          error: null,
        } : {
          vendorName: application.name,
          applicationId: application.id,
          activeStage: null,
          completedStages: ["onboarding"],
          halted: false,
          done: false,
          running: true,
          log: "",
          error: null,
        });

        streamOrchestrator(`${VENDOR_ORCHESTRATOR_URL}/resume`, {
          application_id: application.id,
          vendor_id: vendorId,
          vendor_name: application.name,
        }, true);
      }

      await loadApplications();
      toast({
        title: decision === "Approved" ? "Vendor Approved" : "Vendor Rejected",
        description: `${application.name} has been ${decision.toLowerCase()}.`,
      });
    } catch (err) {
      toast({ title: "Action Failed", description: String(err), variant: "destructive" });
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await decide(rejectTarget, "Rejected", rejectReason.trim());
    setRejectTarget(null);
    setRejectReason("");
  };

  const submitApplication = async () => {
    if (!name.trim() || !licenseNumber.trim() || !specialization) {
      toast({ title: "Missing Required Fields", description: "Vendor name, license number, and specialization are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          specialty: specialization,
          location: serviceAreas.trim(),
          zipCode: zipCode.trim() || null,
          licenseNumber: licenseNumber.trim(),
          licenseExpiryDate: licenseExpiry || null,
          contactEmail: email.trim() || null,
          contactPhone: phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to submit application");
      }
      const data = await res.json();
      const applicationId: number = data.application?.id ?? data.id;
      const submittedName = name.trim();
      const submittedSpecialty = specialization;
      const submittedLocation = serviceAreas.trim();

      await loadApplications();
      toast({ title: "Application Submitted", description: "Triggering vendor orchestrator workflow…" });

      setWorkflow({
        vendorName: submittedName,
        applicationId,
        activeStage: null,
        completedStages: [],
        halted: false,
        done: false,
        running: true,
        log: "",
        error: null,
      });

      streamOrchestrator(`${VENDOR_ORCHESTRATOR_URL}/run`, {
        application_id: applicationId,
        vendor_name: submittedName,
        specialty: submittedSpecialty,
        location: submittedLocation,
        license_number: licenseNumber.trim(),
        license_expiry_date: licenseExpiry || null,
        zip_code: zipCode.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
      }, false);

      setName("");
      setLicenseNumber("");
      setLicenseExpiry("");
      setZipCode("");
      setServiceAreas("");
      setSpecialization("");
      setEmail("");
      setPhone("");
    } catch (err) {
      toast({ title: "Submission Failed", description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const addState = (st: string) => {
    const parts = serviceAreas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.includes(st)) setServiceAreas([...parts, st].join(", "));
  };

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-5">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-8 py-7 shadow-md">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Vendor Onboarding</h1>
        <p className="mt-1 text-sm text-indigo-200/80 font-medium">Submit new vendor applications and manage pending approvals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Application form */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-blue-600">
            <UserPlus className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">New Vendor Application</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <FileText className="h-3.5 w-3.5 text-violet-500" /> Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Acme Restoration LLC"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500" /> License Number <span className="text-red-500">*</span>
              </label>
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Enter license number"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Calendar className="h-3.5 w-3.5 text-violet-500" /> License Expiry Date
              </label>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Hash className="h-3.5 w-3.5 text-violet-500" /> ZIP Code
              </label>
              <input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g., 90210"
                maxLength={10}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Upload className="h-3.5 w-3.5 text-violet-500" /> Certification Upload
              </label>
              <div className="rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/30 px-6 py-8 text-center cursor-pointer hover:bg-violet-50 transition-colors">
                <Upload className="h-5 w-5 text-violet-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-500">Drop certification files here or click to browse</div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <MapPin className="h-3.5 w-3.5 text-violet-500" /> Service Areas
              </label>
              <input
                value={serviceAreas}
                onChange={(e) => setServiceAreas(e.target.value)}
                placeholder="Comma-separated state codes (e.g., NY, CA, FL, TX, IL)"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {serviceAreaStates.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => addState(st)}
                    className="rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 px-2.5 py-1 text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Specialization <span className="text-red-500">*</span>
              </label>
              <Select value={specialization} onValueChange={setSpecialization}>
                <SelectTrigger className="w-full rounded-lg border-slate-200 text-sm h-10">
                  <SelectValue placeholder="Select specialization" />
                </SelectTrigger>
                <SelectContent>
                  {specializations.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Mail className="h-3.5 w-3.5 text-violet-500" /> Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
                <Phone className="h-3.5 w-3.5 text-violet-500" /> Contact Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            <button
              onClick={submitApplication}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors"
            >
              <FileText className="h-4 w-4" /> Submit Vendor Application
            </button>
          </div>
        </div>

        {/* Pending approvals */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2.5 bg-gradient-to-r from-amber-500 to-orange-600">
            <ClipboardList className="h-4 w-4 text-white" />
            <h2 className="text-white font-extrabold text-sm">Pending Approvals ({pending.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.length === 0 && !loading && (
              <div className="px-5 py-6 text-sm text-slate-500 text-center">No pending applications</div>
            )}
            {pending.map((p) => (
              <div key={p.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                  <span className="rounded-full bg-amber-500 text-white px-3 py-1 text-[10px] font-bold">Pending Review</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {p.specialty} · {p.location} · Submitted {p.submitted}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  License: {p.license} · Expires: {p.expires}
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <button
                    onClick={() => decide(p, "Approved")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 text-[11px] font-bold transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectTarget(p);
                      setRejectReason("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 text-[11px] font-bold transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}

            {/* Processed list below pending */}
            {processed.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-500 text-sm">{p.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {p.specialty} · {p.location} · Submitted {p.submitted}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold text-white ${
                    p.status === "Approved" ? "bg-emerald-500/80" : "bg-red-400"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md p-6">
          {rejectTarget && (
            <>
              <DialogTitle className="text-base font-extrabold text-slate-900 mb-1">Reject Application</DialogTitle>
              <p className="text-xs text-slate-500 mb-4">Provide a reason for rejecting {rejectTarget.name}</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., License expired, insufficient coverage area..."
                className="w-full rounded-lg border border-slate-200 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="flex items-center justify-end gap-2.5 mt-4">
                <button
                  onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={!rejectReason.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 px-4 py-2 text-sm font-bold text-white transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" /> Confirm Rejection
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
