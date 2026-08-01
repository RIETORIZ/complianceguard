import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { logAudit, dispatchNotification, SEVERITY_CONFIG } from "@/lib/compliance";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/access-control";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  open: { color: "bg-red-100 text-red-700", label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  remediated: { color: "bg-blue-100 text-blue-700", label: "Remediated" },
  verified_closed: { color: "bg-emerald-100 text-emerald-700", label: "Verified Closed" },
  accepted: { color: "bg-slate-100 text-slate-600", label: "Accepted" },
};

export default function Findings() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "findings_manage");
  const [data, setData] = useState({ findings: [], audits: [], owners: [], controls: [], requests: [], submissions: [], orgUnits: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const [findings, audits, owners, controls, requests, submissions, orgUnits] = await Promise.all([
        base44.entities.Finding.list("-created_date", 1000), base44.entities.Audit.list("-created_date", 500), base44.entities.Owner.list("full_name", 1000), base44.entities.AuditControl.list("control_number", 5000), base44.entities.EvidenceRequest.list("-created_date", 5000), base44.entities.EvidenceSubmission.list("-created_date", 5000), base44.entities.OrgUnit.list("name", 1000),
      ]);
      setData({ findings, audits, owners, controls, requests, submissions, orgUnits });
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const filtered = data.findings.filter((finding) => (!search || [finding.title, finding.description, finding.regulatory_impact].some((value) => value?.toLowerCase().includes(search.toLowerCase()))) && (!severity || finding.severity === severity) && (!status || finding.status === status));
  const auditName = (id) => data.audits.find((audit) => audit.id === id)?.name || "—";
  const ownerName = (id) => data.owners.find((owner) => owner.id === id)?.full_name || "—";
  if (loading) return <Spinner />;

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold">Findings</h1><p className="text-sm text-slate-500 mt-1">Findings from audits, evidence reviews, risk assessments, continuous monitoring, and control testing.</p></div>{canManage && <button onClick={() => setEditing({})} className="flex gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />New Finding</button>}</div>
    <div className="flex gap-2 flex-wrap"><div className="relative flex-1 min-w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, title, or regulatory impact…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" /></div><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All severities</option>{["critical","high","medium","low"].map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All statuses</option>{Object.keys(STATUS_CONFIG).map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{["Finding","Source","Owner","Severity / Risk","Status","Due",""] .map((header) => <th key={header} className="px-4 py-2 text-left font-medium text-slate-600">{header}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((finding) => <tr key={finding.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-medium">{finding.title}</div><div className="text-xs text-slate-400 max-w-md truncate">{finding.description}</div></td><td className="px-4 py-3">{finding.source_audit_id ? <Link to={`/audits/${finding.source_audit_id}`} className="text-blue-700">{auditName(finding.source_audit_id)}</Link> : finding.source_type}</td><td className="px-4 py-3">{ownerName(finding.owner_id)}</td><td className="px-4 py-3"><div className="flex gap-1"><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[finding.severity])}>{finding.severity}</span><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[finding.risk_rating])}>{finding.risk_rating}</span></div></td><td className="px-4 py-3"><StatusBadge status={finding.status} config={STATUS_CONFIG} /></td><td className="px-4 py-3">{finding.due_date || "—"}</td><td className="px-4 py-3">{canManage && <button onClick={() => setEditing(finding)} className="text-xs border px-2 py-1 rounded">Open</button>}</td></tr>)}</tbody></table>{!filtered.length && <div className="p-8 text-center text-sm text-slate-400">No findings found.</div>}</div>
    {editing && <FindingModal value={editing.id ? editing : null} data={data} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
  </div>;
}

function FindingModal({ value, data, onClose, onDone }) {
  const [form, setForm] = useState({ title: "", description: "", source_audit_id: "", source_type: "Evidence Review", framework_id: "", control_id: "", audit_control_id: "", evidence_request_id: "", severity: "medium", risk_rating: "medium", regulatory_impact: "", owner_id: "", department_id: "", due_date: "", auditor_comments: "", management_response: "", closure_evidence_url: "", verification_result: "", status: "open", ...(value || {}) });
  const [closureFile, setClosureFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const change = (key, next) => setForm((previous) => ({ ...previous, [key]: next }));
  const auditControls = data.controls.filter((control) => !form.source_audit_id || control.audit_id === form.source_audit_id);
  const evidenceRequests = data.requests.filter((request) => (!form.source_audit_id || request.audit_id === form.source_audit_id) && (!form.audit_control_id || request.audit_control_id === form.audit_control_id));
  const save = async () => {
    if (!form.title || !form.description) return alert("Finding title and description are required.");
    if (form.status === "verified_closed" && !form.closure_evidence_url && !closureFile) return alert("Closure evidence is required before verified closure.");
    if (form.status === "verified_closed" && !form.verification_result) return alert("Verification result is required before verified closure.");
    setSaving(true);
    try {
      let closureUrl = form.closure_evidence_url;
      if (closureFile) closureUrl = (await base44.integrations.Core.UploadFile({ file: closureFile })).file_url;
      const history = [...(form.status_history || [])];
      if (!value || value.status !== form.status) history.push({ status: form.status, changed_at: new Date().toISOString(), comment: form.verification_result || form.auditor_comments || "Status updated" });
      const payload = { ...form, closure_evidence_url: closureUrl, status_history: history };
      delete payload.id; delete payload.created_date; delete payload.updated_date; delete payload.created_by_id; delete payload.is_sample;
      const record = value ? await base44.entities.Finding.update(value.id, payload) : await base44.entities.Finding.create(payload);
      await logAudit({ action: value ? "finding_updated" : "finding_created", recordType: "Finding", recordId: record.id, recordName: form.title, previousValue: value, newValue: payload, comment: form.verification_result });
      const owner = data.owners.find((candidate) => candidate.id === form.owner_id);
      if (owner) await dispatchNotification({ recipientId: owner.id, recipientEmail: owner.work_email, type: "finding", title: `${value ? "Finding updated" : "New finding"}: ${form.title}`, body: `${form.severity} severity; due ${form.due_date || "not set"}.`, relatedRecordType: "Finding", relatedRecordId: record.id, link: "/findings" });
      onDone();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  };
  const createPlan = async () => {
    if (!value?.id) return alert("Save the finding first.");
    const plan = await base44.entities.CorrectionPlan.create({ corrective_action: `Remediate: ${form.title}`, finding_id: value.id, audit_id: form.source_audit_id, control_id: form.control_id, primary_owner_id: form.owner_id, supporting_owner_ids: [], priority: form.severity, risk: form.risk_rating, target_date: form.due_date, completion_percentage: 0, required_closure_evidence: "Evidence demonstrating remediation and closure", validation_comments: "", escalation_level: 0, closure_decision: "pending", status: "open" });
    await logAudit({ action: "correction_plan_created", recordType: "CorrectionPlan", recordId: plan.id, recordName: plan.corrective_action, newValue: plan });
    alert("Correction plan created.");
  };
  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto"><div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">{value ? "Finding Details" : "New Finding"}</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-6 space-y-3"><Text label="Title *" value={form.title} set={(next) => change("title", next)} /><Area label="Description *" value={form.description} set={(next) => change("description", next)} /><div className="grid md:grid-cols-2 gap-3"><Select label="Source audit" value={form.source_audit_id} set={(next) => change("source_audit_id", next)} options={data.audits.map((audit) => [audit.id, audit.name])} /><Select label="Source type" value={form.source_type} set={(next) => change("source_type", next)} options={["Regulatory Audit","Internal Audit","External Audit","Corporate Assessment","Technical Assessment","Evidence Review","Risk Assessment","Control Testing","Continuous Compliance Monitoring"].map((item) => [item,item])} /><Select label="Related control" value={form.audit_control_id} set={(next) => { const control = data.controls.find((item) => item.id === next); setForm((previous) => ({ ...previous, audit_control_id: next, control_id: control?.control_id || "", framework_id: control?.framework_id || previous.framework_id })); }} options={auditControls.map((control) => [control.id, `${control.control_number} — ${control.control_title}`])} /><Select label="Related evidence" value={form.evidence_request_id} set={(next) => change("evidence_request_id", next)} options={evidenceRequests.map((request) => [request.id, request.title])} /></div><div className="grid md:grid-cols-4 gap-3"><Select label="Severity" value={form.severity} set={(next) => change("severity", next)} options={["low","medium","high","critical"].map((item) => [item,item])} /><Select label="Risk rating" value={form.risk_rating} set={(next) => change("risk_rating", next)} options={["low","medium","high","critical"].map((item) => [item,item])} /><Select label="Owner" value={form.owner_id} set={(next) => change("owner_id", next)} options={data.owners.map((owner) => [owner.id, owner.full_name])} /><Select label="Department" value={form.department_id} set={(next) => change("department_id", next)} options={data.orgUnits.filter((unit) => unit.type === "department").map((unit) => [unit.id,unit.name])} /></div><Text type="date" label="Target date" value={form.due_date} set={(next) => change("due_date", next)} /><Area label="Regulatory impact" value={form.regulatory_impact} set={(next) => change("regulatory_impact", next)} /><Area label="Auditor comments" value={form.auditor_comments} set={(next) => change("auditor_comments", next)} /><Area label="Management response" value={form.management_response} set={(next) => change("management_response", next)} /><div className="grid md:grid-cols-2 gap-3"><Select label="Status" value={form.status} set={(next) => change("status", next)} options={Object.keys(STATUS_CONFIG).map((item) => [item, STATUS_CONFIG[item].label])} /><Text label="Verification result" value={form.verification_result} set={(next) => change("verification_result", next)} /></div><label className="block text-xs font-medium text-slate-600">Closure evidence<input type="file" onChange={(event) => setClosureFile(event.target.files?.[0] || null)} className="w-full mt-1 text-sm" /></label>{form.closure_evidence_url && <a href={form.closure_evidence_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700">Current closure evidence</a>}<div className="flex gap-2"><button onClick={save} disabled={saving} className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? "Saving…" : "Save Finding"}</button>{value && <button onClick={createPlan} className="border border-amber-300 text-amber-800 px-3 py-2 rounded-lg text-sm">Create Correction Plan</button>}</div></div></div></div>;
}

function Text({ label, value, set, type = "text" }) { return <label className="block text-xs font-medium text-slate-600">{label}<input type={type} value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></label>; }
function Area({ label, value, set }) { return <label className="block text-xs font-medium text-slate-600">{label}<textarea value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-20" /></label>; }
function Select({ label, value, set, options }) { return <label className="block text-xs font-medium text-slate-600">{label}<select value={value || ""} onChange={(event) => set(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>; }
function Spinner() { return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
