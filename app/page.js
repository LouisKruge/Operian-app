"use client";
// ════════════════════════════════════════════════════════════════
// Operian Operation — standalone growth pipeline tracking dashboard.
// Pulls live data from the Airtable "NEXUS Growth Engine" base via
// /api/growth (server-side, key never reaches the browser) and renders
// pipeline funnel, automation run health, sequence/email activity and
// the POPIA compliance/consent log.
// ════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Building2, Users, Send, ShieldCheck, Activity,
  RefreshCw, Lock, AlertTriangle, CheckCircle2, XCircle, Clock,
  Loader2, Search, Mail,
} from "lucide-react";

const STORAGE_KEY = "operian_operation_dashboard_key";

const STATUS_COLORS = {
  success: "#34d399", researched: "#34d399", customer: "#34d399",
  "in sequence": "#60a5fa", active: "#60a5fa", sent: "#60a5fa",
  "research queued": "#fbbf24", running: "#fbbf24", partial: "#fbbf24", new: "#fbbf24",
  failed: "#fb7185", "do not contact": "#fb7185", disqualified: "#fb7185",
  "opted out": "#fb7185", bounced: "#fb7185", unsubscribed: "#fb7185",
  "not contacted": "#94a3b8", "not opted out": "#34d399",
  engaged: "#a78bfa", opportunity: "#a78bfa", replied: "#a78bfa", "meeting booked": "#a78bfa",
};
function statusColor(s) {
  const k = (s || "").toLowerCase();
  return STATUS_COLORS[k] || "#94a3b8";
}

function Glass({ children, className = "" }) {
  return (
    <div
      className={`relative rounded-2xl backdrop-blur-xl ${className}`}
      style={{
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        backgroundColor: "rgba(255,255,255,0.012)",
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.025), 0 2px 6px rgba(0,0,0,0.4), 0 24px 56px -32px rgba(0,0,0,0.9)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${color}1f`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label || "—"}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub, color = "#a855f7" }) {
  return (
    <Glass className="p-5">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-[0.16em] font-medium">
        <Icon size={13} className="text-slate-500" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </Glass>
  );
}

function BarRow({ label, count, total, color = "#a855f7" }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-500 tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function groupCount(rows, getKey) {
  const map = {};
  rows.forEach((r) => {
    const k = getKey(r) || "Unknown";
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

function linkedNames(ids, table, nameField) {
  if (!ids || !ids.length || !table) return "—";
  return ids.map((id) => table.find((r) => r.id === id)?.[nameField] || id).join(", ");
}

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: Building2 },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "automation", label: "Automation", icon: Activity },
  { key: "sequences", label: "Sequences", icon: Send },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "drafts", label: "Drafts", icon: Mail },
];

function PasscodeGate({ onSubmit, error, busy }) {
  const [val, setVal] = useState("");
  return (
    <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex items-center justify-center p-4">
      <Glass className="w-full max-w-sm p-7">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/15 flex items-center justify-center">
            <Lock size={15} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-white leading-none">Operian Operation</div>
            <div className="text-[10px] text-slate-500 tracking-[0.18em] mt-0.5">DASHBOARD ACCESS</div>
          </div>
        </div>
        <label className="text-[11px] uppercase tracking-widest text-slate-500">Passcode</label>
        <input
          autoFocus
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit(val)}
          className="w-full mt-1.5 mb-4 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 text-[14px] focus:outline-none"
          placeholder="••••••••"
        />
        {error && <div className="mb-4 text-[12px] text-rose-300 bg-rose-500/10 rounded-lg px-3 py-2">{error}</div>}
        <button
          onClick={() => onSubmit(val)}
          disabled={busy || !val}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-white text-[#070b14] hover:bg-slate-200 transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}
          {busy ? "Checking…" : "Unlock"}
        </button>
      </Glass>
    </div>
  );
}

export default function OperianOperationDashboard() {
  const [key, setKey] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setKey(stored || "");
  }, []);

  const load = useCallback(async (candidateKey) => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/growth", { headers: candidateKey ? { "x-dashboard-key": candidateKey } : {} });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      return true;
    } catch (e) {
      setLoadError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) load(key);
  }, [key, load]);

  const handleUnlock = async (val) => {
    setAuthBusy(true);
    setAuthError("");
    const ok = await load(val);
    setAuthBusy(false);
    if (ok) {
      window.localStorage.setItem(STORAGE_KEY, val);
      setKey(val);
    } else {
      setAuthError("Couldn't verify that passcode — try again.");
    }
  };

  // Auto-refresh every 60s once unlocked & loaded successfully.
  useEffect(() => {
    if (key === null || loadError) return;
    const id = setInterval(() => load(key), 60000);
    return () => clearInterval(id);
  }, [key, loadError, load]);

  if (key === null) return null; // reading localStorage
  if (key === "" || (loadError && loadError.toLowerCase().includes("unauthorized") && !data)) {
    return <PasscodeGate onSubmit={handleUnlock} error={authError} busy={authBusy} />;
  }
  if (!data && loading) {
    return (
      <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-slate-500" />
      </div>
    );
  }
  if (!data && loadError) {
    return (
      <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex items-center justify-center p-4">
        <Glass className="max-w-md p-6">
          <div className="flex items-center gap-2 text-rose-300 mb-2"><AlertTriangle size={16} />Couldn't load dashboard data</div>
          <div className="text-[13px] text-slate-400">{loadError}</div>
          <button onClick={() => load(key)} className="mt-4 inline-flex items-center gap-2 text-[12px] text-slate-300 hover:text-white"><RefreshCw size={13} />Retry</button>
        </Glass>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070b14] text-slate-100 font-sans">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#070b14]/80 border-b border-white/[0.06] px-6 py-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-400 flex items-center justify-center text-[#070b14] font-bold text-sm">O</div>
        <div>
          <div className="text-[14px] font-semibold text-white leading-none">Operian Operation</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{data ? `Updated ${fmtDate(data.fetchedAt)}` : ""}</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => load(key)} disabled={loading} className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </header>

      <nav className="px-6 pt-4 flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${tab === t.key ? "bg-white text-[#070b14]" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}
          >
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </nav>

      <main className="px-6 py-6 max-w-7xl">
        {data && tab === "overview" && <Overview data={data} />}
        {data && tab === "pipeline" && <Pipeline data={data} search={search} setSearch={setSearch} />}
        {data && tab === "contacts" && <Contacts data={data} search={search} setSearch={setSearch} />}
        {data && tab === "automation" && <AutomationLog data={data} />}
        {data && tab === "sequences" && <Sequences data={data} />}
        {data && tab === "compliance" && <Compliance data={data} />}
        {data && tab === "drafts" && <Drafts data={data} dashboardKey={key} onRefresh={() => load(key)} />}
      </main>
    </div>
  );
}

function Overview({ data }) {
  const { companies, contacts, sequences, automationLog } = data;
  const inSequence = companies.filter((c) => c.Status === "In Sequence").length;
  const optedOut = contacts.filter((c) => c["Opt-Out Status"] && c["Opt-Out Status"] !== "Not Opted Out").length;
  const lastRuns = [...automationLog].sort((a, b) => new Date(b["Started At"] || 0) - new Date(a["Started At"] || 0)).slice(0, 6);
  const statusBreakdown = groupCount(companies, (c) => c.Status);
  const industryBreakdown = groupCount(companies, (c) => c.Industry);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Companies" value={companies.length} icon={Building2} color="#a855f7" />
        <StatCard label="Contacts" value={contacts.length} icon={Users} color="#22d3ee" />
        <StatCard label="With Email" value={companies.filter((c) => c.Email).length} icon={Mail} color="#34d399" />
        <StatCard label="In Sequence" value={inSequence} icon={Send} color="#60a5fa" />
        <StatCard label="Sequence Records" value={sequences.length} icon={Send} color="#fbbf24" />
        <StatCard label="Opted Out" value={optedOut} icon={ShieldCheck} color="#fb7185" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">Pipeline by Status</div>
          {statusBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={companies.length} color={statusColor(k)} />
          ))}
        </Glass>
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">Companies by Industry</div>
          {industryBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={companies.length} color="#a855f7" />
          ))}
        </Glass>
      </div>

      <Glass className="p-5">
        <div className="text-[13px] font-semibold text-slate-200 mb-3">Recent Automation Runs</div>
        <div className="space-y-2">
          {lastRuns.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-[12.5px] py-1.5 border-b border-white/[0.04] last:border-0">
              <Pill label={r.Status} color={statusColor(r.Status)} />
              <span className="text-slate-300 flex-1 truncate">{r["Workflow Name"]}</span>
              <span className="text-slate-500 tabular-nums">{r["Records Processed"] ?? "—"} recs</span>
              <span className="text-slate-500">{fmtDate(r["Started At"])}</span>
            </div>
          ))}
          {!lastRuns.length && <div className="text-[12px] text-slate-500">No automation runs logged yet.</div>}
        </div>
      </Glass>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 w-full max-w-xs">
      <Search size={14} className="text-slate-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-transparent text-[13px] text-slate-200 focus:outline-none flex-1 placeholder:text-slate-600" />
    </div>
  );
}

function Pipeline({ data, search, setSearch }) {
  const { companies } = data;
  const statusBreakdown = groupCount(companies, (c) => c.Status);
  const filtered = companies.filter((c) =>
    !search || (c["Company Name"] || "").toLowerCase().includes(search.toLowerCase()) || (c.Industry || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-5">
      <Glass className="p-5">
        <div className="text-[13px] font-semibold text-slate-200 mb-3">Status Funnel</div>
        <div className="flex flex-wrap gap-4">
          {statusBreakdown.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <Pill label={k} color={statusColor(k)} />
              <span className="text-slate-400 text-[12px] tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </Glass>
      <div className="flex items-center justify-between">
        <SearchBox value={search} onChange={setSearch} placeholder="Search company or industry…" />
        <div className="text-[12px] text-slate-500">{filtered.length} of {companies.length}</div>
      </div>
      <Glass className="p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/[0.06]">
              {["Company", "Industry", "City", "Email", "Source", "Status", "Collected"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-slate-200">{c["Company Name"]}</td>
                <td className="px-4 py-2 text-slate-400">{c.Industry}</td>
                <td className="px-4 py-2 text-slate-400">{c.City}</td>
                <td className="px-4 py-2 text-slate-400">{c.Email || "—"}</td>
                <td className="px-4 py-2 text-slate-400">{c.Source}</td>
                <td className="px-4 py-2"><Pill label={c.Status} color={statusColor(c.Status)} /></td>
                <td className="px-4 py-2 text-slate-500">{c["Date Collected"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function Contacts({ data, search, setSearch }) {
  const { contacts, companies } = data;
  const decisionMakers = contacts.filter((c) => c["Is Decision Maker"]).length;
  const generic = contacts.length - decisionMakers;
  const verified = contacts.filter((c) => c["Email Verified"]).length;
  const optOutBreakdown = groupCount(contacts, (c) => c["Opt-Out Status"]);
  const filtered = contacts.filter((c) =>
    !search || (c["Full Name"] || "").toLowerCase().includes(search.toLowerCase()) || (c.Email || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Contacts" value={contacts.length} icon={Users} color="#22d3ee" />
        <StatCard label="Decision Makers" value={decisionMakers} icon={CheckCircle2} color="#34d399" />
        <StatCard label="Generic Contacts" value={generic} icon={Mail} color="#fbbf24" sub="info@ / sales@ etc." />
        <StatCard label="Verified Emails" value={verified} icon={ShieldCheck} color="#60a5fa" />
      </div>
      <Glass className="p-5">
        <div className="text-[13px] font-semibold text-slate-200 mb-3">Opt-Out Status</div>
        {optOutBreakdown.map(([k, v]) => (
          <BarRow key={k} label={k} count={v} total={contacts.length} color={statusColor(k)} />
        ))}
      </Glass>
      <div className="flex items-center justify-between">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or email…" />
        <div className="text-[12px] text-slate-500">{filtered.length} of {contacts.length}</div>
      </div>
      <Glass className="p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/[0.06]">
              {["Name", "Job Title", "Email", "Company", "Decision Maker", "Status", "Opt-Out"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-slate-200">{c["Full Name"]}</td>
                <td className="px-4 py-2 text-slate-400">{c["Job Title"]}</td>
                <td className="px-4 py-2 text-slate-400">{c.Email}</td>
                <td className="px-4 py-2 text-slate-400">{linkedNames(c.Company, companies, "Company Name")}</td>
                <td className="px-4 py-2">{c["Is Decision Maker"] ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-slate-600" />}</td>
                <td className="px-4 py-2"><Pill label={c.Status} color={statusColor(c.Status)} /></td>
                <td className="px-4 py-2"><Pill label={c["Opt-Out Status"]} color={statusColor(c["Opt-Out Status"])} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function AutomationLog({ data }) {
  const { automationLog } = data;
  const sorted = [...automationLog].sort((a, b) => new Date(b["Started At"] || 0) - new Date(a["Started At"] || 0));
  const statusBreakdown = groupCount(automationLog, (r) => r.Status);
  const successRate = automationLog.length ? Math.round((automationLog.filter((r) => r.Status === "Success").length / automationLog.length) * 100) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Runs" value={automationLog.length} icon={Activity} color="#a855f7" />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} color="#34d399" />
        <StatCard label="Failed" value={automationLog.filter((r) => r.Status === "Failed").length} icon={XCircle} color="#fb7185" />
        <StatCard label="Running" value={automationLog.filter((r) => r.Status === "Running").length} icon={Clock} color="#fbbf24" />
      </div>
      <Glass className="p-5">
        <div className="text-[13px] font-semibold text-slate-200 mb-3">Status Breakdown</div>
        {statusBreakdown.map(([k, v]) => (
          <BarRow key={k} label={k} count={v} total={automationLog.length} color={statusColor(k)} />
        ))}
      </Glass>
      <Glass className="p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/[0.06]">
              {["Run", "Workflow", "Type", "Status", "Started", "Finished", "Records", "Details"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] align-top">
                <td className="px-4 py-2 text-slate-200">{r["Run Label"]}</td>
                <td className="px-4 py-2 text-slate-400">{r["Workflow Name"]}</td>
                <td className="px-4 py-2 text-slate-400">{r["Automation Type"]}</td>
                <td className="px-4 py-2"><Pill label={r.Status} color={statusColor(r.Status)} /></td>
                <td className="px-4 py-2 text-slate-500">{fmtDate(r["Started At"])}</td>
                <td className="px-4 py-2 text-slate-500">{fmtDate(r["Finished At"])}</td>
                <td className="px-4 py-2 text-slate-400 tabular-nums">{r["Records Processed"] ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500 max-w-xs truncate" title={r["Details / Error"]}>{r["Details / Error"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function Sequences({ data }) {
  const { sequences, contacts } = data;
  const statusBreakdown = groupCount(sequences, (s) => s.Status);
  const campaignBreakdown = groupCount(sequences, (s) => s["Campaign Name"]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Enrollments" value={sequences.length} icon={Send} color="#60a5fa" />
        <StatCard label="Campaigns" value={campaignBreakdown.length} icon={LayoutDashboard} color="#a855f7" />
        <StatCard label="Opt-Out Clicked" value={sequences.filter((s) => s["Opt-Out Link Clicked"]).length} icon={ShieldCheck} color="#fb7185" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">By Status</div>
          {statusBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={sequences.length} color={statusColor(k)} />
          ))}
          {!statusBreakdown.length && <div className="text-[12px] text-slate-500">No sequence records yet.</div>}
        </Glass>
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">By Campaign</div>
          {campaignBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={sequences.length} color="#fbbf24" />
          ))}
          {!campaignBreakdown.length && <div className="text-[12px] text-slate-500">No campaigns yet.</div>}
        </Glass>
      </div>
      <Glass className="p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/[0.06]">
              {["Sequence", "Campaign", "Channel", "Status", "Step", "Contact", "Enrolled"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sequences.slice(0, 200).map((s) => (
              <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-slate-200">{s["Sequence Label"]}</td>
                <td className="px-4 py-2 text-slate-400">{s["Campaign Name"]}</td>
                <td className="px-4 py-2 text-slate-400">{s.Channel}</td>
                <td className="px-4 py-2"><Pill label={s.Status} color={statusColor(s.Status)} /></td>
                <td className="px-4 py-2 text-slate-400 tabular-nums">{s["Step Reached"] ?? "—"}</td>
                <td className="px-4 py-2 text-slate-400">{linkedNames(s.Contact, contacts, "Full Name")}</td>
                <td className="px-4 py-2 text-slate-500">{s["Enrolled Date"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function Compliance({ data }) {
  const { consentLog, contacts, companies } = data;
  const eventBreakdown = groupCount(consentLog, (c) => c["Event Type"]);
  const lawfulBasisBreakdown = groupCount(consentLog, (c) => c["Lawful Basis At Time"]);
  const optedOut = contacts.filter((c) => c["Opt-Out Status"] && c["Opt-Out Status"] !== "Not Opted Out");
  const sorted = [...consentLog].sort((a, b) => new Date(b["Event Date"] || 0) - new Date(a["Event Date"] || 0));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Consent Log Entries" value={consentLog.length} icon={ShieldCheck} color="#a855f7" />
        <StatCard label="Opted Out / Bounced" value={optedOut.length} icon={AlertTriangle} color="#fb7185" />
        <StatCard label="Needs Review" value={contacts.filter((c) => c["Lawful Basis"] === "Unknown/Legacy – Needs Review").length} icon={AlertTriangle} color="#fbbf24" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">Event Types</div>
          {eventBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={consentLog.length} color="#a855f7" />
          ))}
        </Glass>
        <Glass className="p-5">
          <div className="text-[13px] font-semibold text-slate-200 mb-3">Lawful Basis</div>
          {lawfulBasisBreakdown.map(([k, v]) => (
            <BarRow key={k} label={k} count={v} total={consentLog.length} color="#22d3ee" />
          ))}
        </Glass>
      </div>
      <Glass className="p-0 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/[0.06]">
              {["Log Entry", "Event Type", "Date", "Source", "Lawful Basis", "Recorded By"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 200).map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-slate-200 max-w-sm truncate" title={c["Log Entry"]}>{c["Log Entry"]}</td>
                <td className="px-4 py-2"><Pill label={c["Event Type"]} color={statusColor(c["Event Type"])} /></td>
                <td className="px-4 py-2 text-slate-500">{fmtDate(c["Event Date"])}</td>
                <td className="px-4 py-2 text-slate-400">{c.Source}</td>
                <td className="px-4 py-2 text-slate-400">{c["Lawful Basis At Time"]}</td>
                <td className="px-4 py-2 text-slate-500">{c["Recorded By"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function Drafts({ data, dashboardKey, onRefresh }) {
  const { emailDrafts, companies } = data;
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({});

  const sorted = [...emailDrafts].sort((a, b) => new Date(b["Created At"] || 0) - new Date(a["Created At"] || 0));
  const statusBreakdown = groupCount(emailDrafts, (d) => d.Status);
  const pending = emailDrafts.filter((d) => d.Status === "Pending Review").length;
  const sent = emailDrafts.filter((d) => d.Status === "Sent").length;
  const rejected = emailDrafts.filter((d) => d.Status === "Rejected").length;

  const filtered = sorted.filter((d) =>
    !search ||
    (d.Subject || "").toLowerCase().includes(search.toLowerCase()) ||
    (d["To Email"] || "").toLowerCase().includes(search.toLowerCase()) ||
    linkedNames(d.Company, companies, "Company Name").toLowerCase().includes(search.toLowerCase())
  );

  const act = async (id, action) => {
    setBusyId(id);
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(dashboardKey ? { "x-dashboard-key": dashboardKey } : {}) },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      onRefresh();
    } catch (e) {
      setRowError((err) => ({ ...err, [id]: e.message }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Drafts" value={emailDrafts.length} icon={Mail} color="#a855f7" />
        <StatCard label="Pending Review" value={pending} icon={Clock} color="#fbbf24" />
        <StatCard label="Sent" value={sent} icon={CheckCircle2} color="#34d399" />
        <StatCard label="Rejected" value={rejected} icon={XCircle} color="#fb7185" />
      </div>
      <Glass className="p-5">
        <div className="text-[13px] font-semibold text-slate-200 mb-3">Status Breakdown</div>
        {statusBreakdown.map(([k, v]) => (
          <BarRow key={k} label={k} count={v} total={emailDrafts.length} color={statusColor(k)} />
        ))}
      </Glass>
      <div className="flex items-center justify-between">
        <SearchBox value={search} onChange={setSearch} placeholder="Search company, email, or subject…" />
        <div className="text-[12px] text-slate-500">{filtered.length} of {emailDrafts.length}</div>
      </div>
      <div className="space-y-2.5">
        {filtered.slice(0, 200).map((d) => {
          const isOpen = expanded === d.id;
          const isBusy = busyId === d.id;
          const isPending = d.Status === "Pending Review";
          return (
            <Glass key={d.id} className="p-0 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
              >
                <Pill label={d.Status} color={statusColor(d.Status)} />
                <span className="text-[13px] text-slate-200 flex-1 truncate">{d.Subject}</span>
                <span className="text-[12px] text-slate-500 truncate max-w-[160px]">{linkedNames(d.Company, companies, "Company Name")}</span>
                <span className="text-[12px] text-slate-500 truncate max-w-[180px]">{d["To Email"]}</span>
                <span className="text-[11px] text-slate-600">{fmtDate(d["Created At"])}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
                  <div className="text-[12px] text-slate-500 mb-1">To: <span className="text-slate-300">{d["To Email"]}</span></div>
                  <div className="text-[12px] text-slate-500 mb-2">Subject: <span className="text-slate-300">{d.Subject}</span></div>
                  <pre className="whitespace-pre-wrap text-[12.5px] text-slate-300 bg-white/[0.03] rounded-xl p-3.5 leading-relaxed font-sans">{d.Body}</pre>
                  {rowError[d.id] && <div className="mt-2 text-[12px] text-rose-300 bg-rose-500/10 rounded-lg px-3 py-2">{rowError[d.id]}</div>}
                  {isPending ? (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => act(d.id, "approve")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Approve & Send
                      </button>
                      <button
                        onClick={() => act(d.id, "reject")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-[12px] text-slate-500">
                      {d.Status === "Sent" ? `Sent ${fmtDate(d["Sent At"])}` : `Marked ${d.Status}`}
                    </div>
                  )}
                </div>
              )}
            </Glass>
          );
        })}
        {!filtered.length && <div className="text-[12px] text-slate-500 px-1">No drafts match.</div>}
      </div>
    </div>
  );
}
