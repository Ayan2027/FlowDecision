
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, FileCheck2,
  FileText, Gauge, LayoutDashboard, ListChecks, Loader2,
  Menu, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Wallet, X, AlertCircle
} from "lucide-react";
import {
  getWorkflows, getExecutions, submitApplication,
  updateWorkflow, getAuditLogs
} from "./api";

const cx = (...classes) => classes.filter(Boolean).join(" ");

function decisionStyle(decision) {
  if (decision === "APPROVED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (decision === "REJECTED") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (decision === "MANUAL_REVIEW") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function formatDate(date) {
  return date ? new Date(date).toLocaleString() : "—";
}

function StatCard({ title, value, note, icon: Icon, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</h3>
        </div>
        <div className={cx("rounded-xl p-3", tones[tone])}>
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Badge({ decision }) {
  return (
    <span className={cx(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset",
      decisionStyle(decision)
    )}>
      {decision?.replace("_", " ") || "PROCESSING"}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50";

export default function App() {
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [page, setPage] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [incomeThreshold, setIncomeThreshold] = useState(25000);
  const [ageThreshold, setAgeThreshold] = useState(21);
  const [form, setForm] = useState({
    applicationId: "",
    age: 25,
    monthlyIncome: 40000,
    documentsVerified: "true"
  });

  const workflow = workflows[0];

  async function loadData() {
    setError("");
    try {
      const [workflowResponse, executionResponse] = await Promise.all([
        getWorkflows(),
        getExecutions()
      ]);
      setWorkflows(workflowResponse.data.data || []);
      setExecutions(executionResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not connect to the backend. Check that your server is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
      const incomeRule = workflow.rules?.find(r => r.ruleId === "INCOME001");
      const ageRule = workflow.rules?.find(r => r.ruleId === "AGE001");
      if (incomeRule) setIncomeThreshold(incomeRule.value);
      if (ageRule) setAgeThreshold(ageRule.value);
    }
  }, [workflow?._id, workflow?.version]);

  const stats = useMemo(() => ({
    total: executions.length,
    approved: executions.filter(e => e.decision === "APPROVED").length,
    rejected: executions.filter(e => e.decision === "REJECTED").length,
    review: executions.filter(e => e.decision === "MANUAL_REVIEW").length
  }), [executions]);

  const filteredExecutions = executions.filter(e => {
    const term = search.toLowerCase();
    return (e.applicationId || "").toLowerCase().includes(term) ||
      (e.decision || "").toLowerCase().includes(term);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!workflow) return setError("Create or seed a workflow first.");
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await submitApplication(workflow._id, {
        applicationId: form.applicationId.trim() || `APP-${Date.now()}`,
        age: Number(form.age),
        monthlyIncome: Number(form.monthlyIncome),
        documentsVerified: form.documentsVerified === "true"
      });
      const decision = result.data.data.decision;
      setSuccess(`Application evaluated: ${decision.replace("_", " ")}.`);
      setForm({ applicationId: "", age: 25, monthlyIncome: 40000, documentsVerified: "true" });
      await loadData();
      setPage("Applications");
    } catch (err) {
      setError(err.response?.data?.message || "Application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRules(e) {
    e.preventDefault();
    if (!workflow) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const rules = workflow.rules.map(rule => {
        if (rule.ruleId === "INCOME001") return { ...rule, value: Number(incomeThreshold) };
        if (rule.ruleId === "AGE001") return { ...rule, value: Number(ageThreshold) };
        return rule;
      });
      await updateWorkflow(workflow._id, { name: workflowName, rules });
      setSuccess("Workflow configuration updated. New executions will use the new version.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update workflow.");
    } finally {
      setBusy(false);
    }
  }

  async function showAudit(execution) {
    setSelectedExecution(execution);
    setAuditLogs([]);
    try {
      const result = await getAuditLogs(execution._id);
      setAuditLogs(result.data.data || []);
    } catch {
      setError("Could not load audit events.");
    }
  }

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Applications", icon: FileText },
    { name: "Workflows", icon: ListChecks },
    { name: "Audit Trail", icon: ShieldCheck }
  ];

  function navigate(name) {
    setPage(name);
    setMobileMenu(false);
    setError("");
    setSuccess("");
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-800">
      <div className="flex min-h-screen">
        {mobileMenu && (
          <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileMenu(false)} />
        )}

        <aside className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#111b32] text-white transition-transform lg:static lg:translate-x-0",
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/30">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">FlowDecision</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Decision platform</p>
            </div>
          </div>

          <div className="px-4 pt-8">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <nav className="space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.name} onClick={() => navigate(item.name)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                      page === item.name ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}>
                    <Icon size={18} /> {item.name}
                    {page === item.name && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 text-blue-300">
                <Sparkles size={16} />
                <span className="text-xs font-semibold">System status</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                API connected
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Powered by MongoDB & Express</p>
            </div>
            <p className="mt-5 px-2 text-[10px] text-slate-600">FLOWDECISION · v1.0.0</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenu(true)} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
              <div>
                <p className="text-xs text-slate-400">Workspace / <span className="text-slate-600">{page}</span></p>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{page}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={loadData} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50" title="Refresh data"><RefreshCw size={17} /></button>
              <button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-500" /></button>
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white sm:flex">AD</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] space-y-7 p-5 sm:p-8">
            {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}<button className="ml-auto" onClick={() => setError("")}><X size={16} /></button></div>}
            {success && (
  <div className={cx(
    "flex items-center gap-2 rounded-xl border p-3 text-sm",
    success.includes("REJECTED")
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : success.includes("MANUAL REVIEW")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700"
  )}>
    <CheckCircle2 size={17} />
    {success}
    <button className="ml-auto" onClick={() => setSuccess("")}>
      <X size={16} />
    </button>
  </div>
)}

            {loading ? (
              <div className="flex min-h-96 items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" />Loading workspace...</div>
            ) : (
              <>
                {page === "Overview" && (
                  <>
                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#172747] via-[#1c3764] to-[#2454a0] p-7 text-white shadow-xl shadow-blue-950/10 sm:p-9">
                      <div className="relative z-10 max-w-2xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-blue-100"><Sparkles size={13} /> Intelligent workflow automation</div>
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Make every decision<br className="hidden sm:block" /> clear, consistent and explainable.</h2>
                        <p className="mt-3 max-w-lg text-sm leading-6 text-blue-100/80">Manage configurable business rules, evaluate applications and understand every decision from one workspace.</p>
                        <button onClick={() => navigate("Applications")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-900 shadow-lg transition hover:bg-blue-50">Evaluate an application <ArrowUpRight size={16} /></button>
                      </div>
                      <div className="pointer-events-none absolute -right-12 -top-28 h-80 w-80 rounded-full border-[45px] border-white/[0.06]" />
                      <div className="pointer-events-none absolute -bottom-48 right-28 h-80 w-80 rounded-full border-[1px] border-white/10" />
                      <div className="absolute right-12 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 p-8 lg:flex"><ShieldCheck size={100} strokeWidth={1} className="text-blue-100/70" /></div>
                    </section>

                    <section>
                      <div className="mb-4 flex items-center justify-between">
                        <div><h2 className="font-semibold text-slate-900">Performance overview</h2><p className="mt-1 text-xs text-slate-500">Live statistics from your execution records</p></div>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live data</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Total applications" value={stats.total} note="All recorded executions" icon={FileText} tone="blue" />
                        <StatCard title="Approved" value={stats.approved} note="Successfully approved" icon={CheckCircle2} tone="green" />
                        <StatCard title="Rejected" value={stats.rejected} note="Did not meet criteria" icon={ArrowDownRight} tone="red" />
                        <StatCard title="Manual review" value={stats.review} note="Require human attention" icon={Clock3} tone="amber" />
                      </div>
                    </section>

                    <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Recent applications</h3><p className="mt-1 text-xs text-slate-500">Latest workflow decisions</p></div><button onClick={() => navigate("Applications")} className="text-xs font-semibold text-blue-600 hover:text-blue-800">View all →</button></div>
                        <div className="mt-5 overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="pb-3 font-medium">Application</th><th className="pb-3 font-medium">Decision</th><th className="pb-3 font-medium">Date</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {executions.slice(0, 5).map(e => <tr key={e._id}><td className="py-3 font-medium text-slate-800">{e.applicationId || "—"}</td><td className="py-3"><Badge decision={e.decision} /></td><td className="py-3 text-xs text-slate-500">{formatDate(e.createdAt)}</td></tr>)}
                              {executions.length === 0 && <tr><td colSpan="3" className="py-10 text-center text-sm text-slate-400">No applications yet. Submit your first application.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                        <h3 className="font-semibold text-slate-900">Decision distribution</h3>
                        <p className="mt-1 text-xs text-slate-500">Breakdown of all applications</p>
                        <div className="mt-6 space-y-5">
                          {[["Approved", stats.approved, "bg-emerald-500"], ["Rejected", stats.rejected, "bg-rose-500"], ["Manual review", stats.review, "bg-amber-400"]].map(([label, value, color]) => (
                            <div key={label}><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-600">{label}</span><span className="font-semibold text-slate-800">{stats.total ? Math.round(value / stats.total * 100) : 0}% <span className="font-normal text-slate-400">({value})</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${stats.total ? value / stats.total * 100 : 0}%` }} /></div></div>
                          ))}
                        </div>
                        <div className="mt-7 rounded-xl bg-blue-50 p-4"><div className="flex items-center gap-2 text-blue-700"><Gauge size={17} /><span className="text-xs font-semibold">Workflow engine</span></div><p className="mt-1 text-xs leading-5 text-blue-700/75">{workflows.length} configured workflow(s) available for evaluation.</p></div>
                      </div>
                    </section>
                  </>
                )}

                {page === "Applications" && (
                  <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                      <div className="mb-6"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileCheck2 size={22} /></div><h2 className="text-lg font-semibold text-slate-900">New application</h2><p className="mt-1 text-sm text-slate-500">Submit applicant details for automated evaluation.</p></div>
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <Field label="Application ID"><input className={inputClass} placeholder="e.g. APP-1004" value={form.applicationId} onChange={e => setForm({ ...form, applicationId: e.target.value })} /></Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Applicant age"><input required min="18" type="number" className={inputClass} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></Field>
                          <Field label="Monthly income (₹)"><input required min="0" type="number" className={inputClass} value={form.monthlyIncome} onChange={e => setForm({ ...form, monthlyIncome: e.target.value })} /></Field>
                        </div>
                        <Field label="Documents verified"><select className={inputClass} value={form.documentsVerified} onChange={e => setForm({ ...form, documentsVerified: e.target.value })}><option value="true">Yes — verified</option><option value="false">No — pending verification</option></select></Field>
                        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-blue-800"><ShieldCheck size={17} /> Active workflow</div><p className="mt-1 text-sm text-blue-700">{workflow?.name || "No workflow configured"}</p><p className="mt-1 text-xs text-blue-600/80">Version {workflow?.version || "—"} · Rules-based evaluation</p></div>
                        <button disabled={busy || !workflow} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{busy ? "Evaluating..." : "Evaluate application"}</button>
                      </form>
                    </div>
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Decision policy</h3><p className="mt-1 text-xs text-slate-500">Current rules applied by the workflow engine</p><div className="mt-5 space-y-3">{workflow?.rules?.map(rule => <div key={rule.ruleId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p className="text-sm font-medium text-slate-800">{rule.name}</p><p className="mt-1 text-xs text-slate-500">{rule.field} {rule.operator} {String(rule.value)}</p></div><span className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{rule.outcome}</span></div>)}</div></div>
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">How decisions work</h3><div className="mt-5 space-y-4">{[["01","Eligibility evaluation","Age and income are checked against configured thresholds."],["02","Document verification","Unverified documents trigger manual review."],["03","Explainable outcome","Each evaluated rule is recorded with its result and explanation."]].map(([n,title,desc]) => <div key={n} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">{n}</span><div><p className="text-sm font-medium text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p></div></div>)}</div></div>
                    </div>
                  </section>
                )}

                {page === "Workflows" && (
                  <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                      <h2 className="font-semibold text-slate-900">Workflow configuration</h2><p className="mt-1 text-sm text-slate-500">Manage the active decision policy.</p>
                      {workflow ? <form onSubmit={saveRules} className="mt-6 space-y-5">
                        <Field label="Workflow name"><input className={inputClass} value={workflowName} onChange={e => setWorkflowName(e.target.value)} /></Field>
                        <Field label="Minimum applicant age"><input type="number" min="18" className={inputClass} value={ageThreshold} onChange={e => setAgeThreshold(e.target.value)} /></Field>
                        <Field label="Minimum monthly income (₹)"><input type="number" min="0" className={inputClass} value={incomeThreshold} onChange={e => setIncomeThreshold(e.target.value)} /></Field>
                        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}Save configuration</button>
                        <p className="text-xs leading-5 text-slate-400">Saving creates a new workflow version. Previous executions retain their original configuration snapshot.</p>
                      </form> : <p className="mt-5 text-sm text-slate-500">No workflow found. Run the seed script first.</p>}
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                      <h3 className="font-semibold text-slate-900">Configured workflows</h3><p className="mt-1 text-xs text-slate-500">Available workflow definitions</p>
                      <div className="mt-5 space-y-3">{workflows.map(w => <div key={w._id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><ListChecks size={20} /></div><div><p className="text-sm font-semibold text-slate-800">{w.name}</p><p className="mt-1 text-xs text-slate-500">Version {w.version} · {w.rules?.length || 0} rules</p></div></div><span className={cx("rounded-full px-2.5 py-1 text-[10px] font-semibold", w.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{w.active ? "ACTIVE" : "INACTIVE"}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">{w.description}</p></div>)}</div>
                    </div>
                  </section>
                )}

                {page === "Audit Trail" && (
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="mb-5"><h2 className="font-semibold text-slate-900">Execution audit trail</h2><p className="mt-1 text-xs text-slate-500">Select an application to inspect its recorded events and decision explanation.</p></div>
                    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                      <div className="space-y-2">{executions.map(e => <button key={e._id} onClick={() => showAudit(e)} className={cx("flex w-full items-center justify-between rounded-xl border p-4 text-left transition", selectedExecution?._id === e._id ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50")}><div><p className="text-sm font-semibold text-slate-800">{e.applicationId || e._id}</p><p className="mt-1 text-xs text-slate-500">{formatDate(e.createdAt)}</p></div><Badge decision={e.decision} /></button>)}
                      {executions.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No executions recorded.</p>}</div>
                      <div className="rounded-xl bg-slate-50 p-5">
                        {selectedExecution ? <><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Decision details</h3><Badge decision={selectedExecution.decision} /></div><p className="mt-2 text-xs text-slate-500">Application {selectedExecution.applicationId}</p><div className="mt-5 space-y-3"><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rule explanations</h4>{selectedExecution.stageResults?.map((rule, i) => (
  <div key={i} className="flex gap-2 rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
    {rule.passed ? (
      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
    ) : (
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
    )}
    <span>
      <strong>{rule.name}:</strong>{" "}
      {rule.passed ? "Passed" : "Failed"}
      {" (actual: "}{String(rule.actualValue)}
      {", expected: "}{rule.operator} {String(rule.expectedValue)}{")"}
    </span>
  </div>
))}</div><div className="mt-6"><h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Audit events</h4>{auditLogs.length ? auditLogs.map(log => <div key={log._id} className="border-l-2 border-blue-200 py-2 pl-4"><p className="text-xs font-semibold text-slate-700">{log.action}</p><p className="mt-1 text-[11px] text-slate-400">{formatDate(log.createdAt)}</p></div>) : <p className="text-xs text-slate-400">No audit events found.</p>}</div></> : <div className="flex min-h-64 flex-col items-center justify-center text-center"><ShieldCheck size={34} className="text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">Select an execution</p><p className="mt-1 text-xs text-slate-400">Its explanation and audit events will appear here.</p></div>}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
            <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400 sm:flex-row"><span>© 2026 FlowDecision. Configurable decisions, made explainable.</span><span>React · Express · MongoDB</span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
