import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit, dispatchNotification, SEVERITY_CONFIG } from "@/lib/compliance";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/access-control";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { CheckCircle2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  open: { color: "bg-red-100 text-red-700", label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  validated: { color: "bg-blue-100 text-blue-700", label: "Validated" },
  closed: { color: "bg-emerald-100 text-emerald-700", label: "Closed" },
  overdue: { color: "bg-red-100 text-red-700", label: "Overdue" },
};

export default function CorrectionPlans() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "correction_manage");
  const [data, setData] = useState({ plans: [], owners: [], findings: [], audits: [], controls: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const [plans, owners, findings, audits, controls] = await Promise.all([
        base44.entities.CorrectionPlan.list("-created_date", 1000), base44.entities.Owner.list("full_name", 1000), base44.entities.Finding.list("-created_date", 1000), base44.entities.Audit.list("-created_date", 500), base44.entities.AuditControl.list("control_number", 5000),
      ]);
      setData({ plans, owners, findings, audits, controls });
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const ownerName = (id) => data.owners.find((owner) => owner.id === id)?.full_name || "—";
  const filtered = data.plans.filter((plan) => (!search || [plan.corrective_action, plan.required_closure_evidence, plan.validation_comments].some((value) => value?.toLowerCase().includes(search.toLowerCase()))) && (!status || plan.status === status));
  if (loading) return <Spinner />;

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold">Correction Plans</h1><p className="text-sm text-slate-500 mt-1">Remediation ownership, risk, target dates, closure evidence, validation, escalation, and closure decisions.</p></div>{canManage && <button onClick={() => setEditing({})} className="flex gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />New Action</button>}</div>
    <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actions, evidence, or comments…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="border rounded-lg px-3 text-sm"><option value="">All statuses</option>{Object.keys(STATUS_CONFIG).map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{["Corrective Action","Primary / Supporting Owners","Priority / Risk","Target","Progress","Status",""] .map((header) => <th key={header} className="px-4 py-2 text-left font-medium text-slate-600">{header}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((plan) => <tr key={plan.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-medium">{plan.corrective_action}</div><div className="text-xs text-slate-400 max-w-md truncate">{plan.required_closure_evidence}</div></td><td className="px-4 py-3"><div>{ownerName(plan.primary_owner_id)}</div><div className="text-xs text-slate-400">{(plan.supporting_owner_ids || []).map(ownerName).join(", ")}</div></td><td className="px-4 py-3"><div className="flex gap-1"><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[plan.priority])}>{plan.priority}</span><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[plan.risk])}>{plan.risk}</span></div></td><td className="px-4 py-3">{plan.target_date || "—"}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-slate-700 rounded-full" style={{ width: `${Math.min(100, plan.completion_percentage || 0)}%` }} /></div><span className="text-xs">{plan.completion_percentage || 0}%</span></div></td><td className="px-4 py-3"><StatusBadge status={plan.status} config={STATUS_CONFIG} /></td><td className="px-4 py-3">{canManage && <button onClick={() => setEditing(plan)} className="text-xs border px-2 py-1 rounded">Open</button>}</td></tr>)}</tbody></table>{!filtered.length && <div className="p-8 text-center text-sm text-slate-400">No correction plans found.</div>}</div>
    {editing && <PlanModal value={editing.id ? editing : null} data={data} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
  </div>;
}

function PlanModal({ value, data, onClose, onDone }) {
  const [form, setForm] = useState({ corrective_action: "", finding_id: "", audit_id: "", control_id: "", primary_owner_id: "", supporting_owner_ids: [], priority: "medium", risk: "medium", target_date: "", completion_percentage: 0, required_closure_evidence: "", submitted_closure_evidence_url: "", validation_comments: "", escalation_level: 0, closure_decision: "pending", status: "open", ...(value || {}) });
  const [closureFile, setClosureFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const change = (key, next) => setForm((previous) => ({ ...previous, [key]: next }));
  const controls = data.controls.filter((control) => !form.audit_id || control.audit_id === form.audit_id);
  const save = async () => {
    if (!form.corrective_action || !form.primary_owner_id || !form.target_date) return alert("Corrective action, primary owner, and target date are required.");
    if (form.status === "closed" && Number(form.completion_percentage) < 100) return alert("Completion must be 100% before closure.");
    if (form.status === "closed" && !form.submitted_closure_evidence_url && !closureFile) return alert("Closure evidence is required before closure.");
    if (["validated", "closed"].includes(form.status) && !form.validation_comments) return alert("Validation comments are required for validation or closure.");
    setSaving(true);
    try {
      let closureUrl = form.submitted_closure_evidence_url;
      if (closureFile) closureUrl = (await base44.integrations.Core.UploadFile({ file: closureFile })).file_url;
      const payload = { ...form, submitted_closure_evidence_url: closureUrl, completion_percentage: form.status === "closed" ? 100 : Number(form.completion_percentage), closure_decision: form.status === "closed" ? "closed" : form.status === "validated" ? "validated" : form.closure_decision, escalation_level: Number(form.escalation_level) || 0 };
      delete payload.id; delete payload.created_date; delete payload.updated_date; delete payload.created_by_id; delete payload.is_sample;
      const record = value ? await base44.entities.CorrectionPlan.update(value.id, payload) : await base44.entities.CorrectionPlan.create(payload);
      await logAudit({ action: value ? "correction_plan_updated" : "correction_plan_created", recordType: "CorrectionPlan", recordId: record.id, recordName: form.corrective_action, previousValue: value, newValue: payload, comment: form.validation_comments });
      const owner = data.owners.find((candidate) => candidate.id === form.primary_owner_id);
      if (owner) await dispatchNotification({ recipientId: owner.id, recipientEmail: owner.work_email, type: form.status === "closed" ? "approval" : "corrective_action", title: `${value ? "Corrective action updated" : "New corrective action"}: ${form.corrective_action}`, body: `Target: ${form.target_date}; status: ${form.status}; progress: ${payload.completion_percentage}%.`, relatedRecordType: "CorrectionPlan", relatedRecordId: record.id, link: "/correction-plans" });
      onDone();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto"><div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">{value ? "Corrective Action" : "New Corrective Action"}</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-6 space-y-3"><Area label="Corrective action *" value={form.corrective_action} set={(next) => change("corrective_action", next)} /><div className="grid md:grid-cols-3 gap-3"><Select label="Source finding" value={form.finding_id} set={(next) => { const finding = data.findings.find((item) => item.id === next); setForm((previous) => ({ ...previous, finding_id: next, audit_id: finding?.source_audit_id || previous.audit_id, control_id: finding?.control_id || previous.control_id })); }} options={data.findings.map((finding) => [finding.id, finding.title])} /><Select label="Source audit" value={form.audit_id} set={(next) => change("audit_id", next)} options={data.audits.map((audit) => [audit.id, audit.name])} /><Select label="Related control" value={form.control_id} set={(next) => change("control_id", next)} options={controls.map((control) => [control.control_id, `${control.control_number} — ${control.control_title}`])} /></div><div className="grid md:grid-cols-2 gap-3"><Select label="Primary owner *" value={form.primary_owner_id} set={(next) => change("primary_owner_id", next)} options={data.owners.filter((owner) => owner.active).map((owner) => [owner.id, owner.full_name])} /><label className="text-xs font-medium text-slate-600">Supporting owners<select multiple value={form.supporting_owner_ids || []} onChange={(event) => change("supporting_owner_ids", Array.from(event.target.selectedOptions).map((option) => option.value))} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-24">{data.owners.filter((owner) => owner.active && owner.id !== form.primary_owner_id).map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label></div><div className="grid md:grid-cols-4 gap-3"><Select label="Priority" value={form.priority} set={(next) => change("priority", next)} options={["low","medium","high","critical"].map((item) => [item,item])} /><Select label="Risk" value={form.risk} set={(next) => change("risk", next)} options={["low","medium","high","critical"].map((item) => [item,item])} /><Text type="date" label="Target date *" value={form.target_date} set={(next) => change("target_date", next)} /><Text type="number" label="Escalation level" value={form.escalation_level} set={(next) => change("escalation_level", next)} /></div><label className="block text-xs font-medium text-slate-600">Completion: {form.completion_percentage || 0}%<input type="range" min="0" max="100" value={form.completion_percentage || 0} onChange={(event) => change("completion_percentage", Number(event.target.value))} className="w-full mt-1" /></label><Area label="Required closure evidence" value={form.required_closure_evidence} set={(next) => change("required_closure_evidence", next)} /><label className="block text-xs font-medium text-slate-600">Submitted closure evidence<input type="file" onChange={(event) => setClosureFile(event.target.files?.[0] || null)} className="w-full mt-1 text-sm" /></label>{form.submitted_closure_evidence_url && <a href={form.submitted_closure_evidence_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700">Current closure evidence</a>}<Area label="Validation comments" value={form.validation_comments} set={(next) => change("validation_comments", next)} /><div className="grid md:grid-cols-2 gap-3"><Select label="Status" value={form.status} set={(next) => change("status", next)} options={Object.keys(STATUS_CONFIG).map((item) => [item,STATUS_CONFIG[item].label])} /><Select label="Closure decision" value={form.closure_decision} set={(next) => change("closure_decision", next)} options={["pending","validated","rejected","closed"].map((item) => [item,item])} /></div><button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg text-sm disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />{saving ? "Saving…" : "Save Corrective Action"}</button></div></div></div>;
}

function Text({ label, value, set, type = "text" }) { return <label className="block text-xs font-medium text-slate-600">{label}<input type={type} value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></label>; }
function Area({ label, value, set }) { return <label className="block text-xs font-medium text-slate-600">{label}<textarea value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-20" /></label>; }
function Select({ label, value, set, options }) { return <label className="block text-xs font-medium text-slate-600">{label}<select value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>; }
function Spinner() { return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
