import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit, SEVERITY_CONFIG } from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { Search, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  open: { color: "bg-red-100 text-red-700", label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  validated: { color: "bg-blue-100 text-blue-700", label: "Validated" },
  closed: { color: "bg-emerald-100 text-emerald-700", label: "Closed" },
  overdue: { color: "bg-red-100 text-red-700", label: "Overdue" },
};

export default function CorrectionPlans() {
  const [plans, setPlans] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState(null);

  const load = async () => {
    try {
      const [p, o] = await Promise.all([base44.entities.CorrectionPlan.list("-created_date", 200), base44.entities.Owner.list("-created_date", 200)]);
      setPlans(p); setOwners(o);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const ownerName = (id) => owners.find((o) => o.id === id)?.full_name || "—";
  const filtered = plans.filter((p) => !search || p.corrective_action?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Correction Plans</h1>
        <p className="text-sm text-slate-500 mt-1">Corrective actions with owners, targets, completion tracking, and closure validation.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search corrective actions…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Corrective Action</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Owner</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Priority</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Target</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Progress</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setEditItem(p)}>
                <td className="px-4 py-2.5"><div className="font-medium text-slate-900">{p.corrective_action}</div></td>
                <td className="px-4 py-2.5 text-slate-600">{ownerName(p.primary_owner_id)}</td>
                <td className="px-4 py-2.5"><span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", SEVERITY_CONFIG[p.priority])}>{p.priority}</span></td>
                <td className="px-4 py-2.5 text-slate-600">{p.target_date || "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-700 rounded-full" style={{ width: `${p.completion_percentage}%` }} /></div>
                    <span className="text-xs text-slate-500">{p.completion_percentage}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={p.status} config={STATUS_CONFIG} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No correction plans found.</div>}
      </div>
      {editItem && <EditModal item={editItem} owners={owners} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); load(); }} />}
    </div>
  );
}

function EditModal({ item, owners, onClose, onDone }) {
  const [pct, setPct] = useState(item.completion_percentage || 0);
  const [status, setStatus] = useState(item.status);
  const [comments, setComments] = useState(item.validation_comments || "");
  const [saving, setSaving] = useState(false);
  const ownerName = (id) => owners.find((o) => o.id === id)?.full_name || "—";

  const save = async () => {
    setSaving(true);
    try {
      const updates = { completion_percentage: Number(pct), status, validation_comments: comments };
      if (status === "closed") { updates.closure_decision = "closed"; updates.completion_percentage = 100; }
      await base44.entities.CorrectionPlan.update(item.id, updates);
      await logAudit({ action: "correction_plan_updated", recordType: "CorrectionPlan", recordId: item.id, recordName: item.corrective_action, previousValue: { status: item.status, pct: item.completion_percentage }, newValue: updates });
      onDone();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Corrective Action</h2><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-slate-900 font-medium">{item.corrective_action}</div>
          <div className="text-xs text-slate-500">Primary owner: {ownerName(item.primary_owner_id)}</div>
          {item.required_closure_evidence && <div className="text-xs text-slate-500">Required closure evidence: {item.required_closure_evidence}</div>}
          <div>
            <label className="text-xs font-medium text-slate-600">Completion: {pct}%</label>
            <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Validation comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm h-20" />
          </div>
          <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 text-sm bg-slate-900 text-white py-2 rounded-lg"><CheckCircle2 className="w-4 h-4" /> Save</button>
        </div>
      </div>
    </div>
  );
}