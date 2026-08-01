import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SEVERITY_CONFIG } from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  open: { color: "bg-red-100 text-red-700", label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  remediated: { color: "bg-blue-100 text-blue-700", label: "Remediated" },
  verified_closed: { color: "bg-emerald-100 text-emerald-700", label: "Verified Closed" },
  accepted: { color: "bg-slate-100 text-slate-600", label: "Accepted" },
};

export default function Findings() {
  const [findings, setFindings] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  const load = async () => {
    try {
      const [f, a] = await Promise.all([base44.entities.Finding.list("-created_date", 200), base44.entities.Audit.list("-created_date", 200)]);
      setFindings(f); setAudits(a);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const auditName = (id) => audits.find((a) => a.id === id)?.name || "—";
  const filtered = findings.filter((f) => {
    if (search && !f.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSeverity && f.severity !== filterSeverity) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <p className="text-sm text-slate-500 mt-1">Findings from regulatory audits, internal audits, evidence reviews, and control testing.</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search findings…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All severities</option>
          {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Finding</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Source Audit</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Severity</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Risk</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5"><div className="font-medium text-slate-900">{f.title}</div><div className="text-xs text-slate-400">{f.source_type}</div></td>
                <td className="px-4 py-2.5 text-slate-600">{f.source_audit_id ? <Link to={`/audits/${f.source_audit_id}`} className="text-blue-600 hover:underline">{auditName(f.source_audit_id)}</Link> : "—"}</td>
                <td className="px-4 py-2.5"><span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", SEVERITY_CONFIG[f.severity])}>{f.severity}</span></td>
                <td className="px-4 py-2.5"><span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", SEVERITY_CONFIG[f.risk_rating])}>{f.risk_rating}</span></td>
                <td className="px-4 py-2.5"><StatusBadge status={f.status} config={STATUS_CONFIG} /></td>
                <td className="px-4 py-2.5 text-slate-600">{f.due_date || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No findings found.</div>}
      </div>
    </div>
  );
}