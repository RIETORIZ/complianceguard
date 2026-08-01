import React, { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { base44 } from "@/api/base44Client";
import { logAudit, recordStatusTransition, dispatchNotification, SEVERITY_CONFIG } from "@/lib/compliance";
import { CORRECTION_PLAN_STATUSES, normalizeCorrectionPlanStatus } from "@/lib/audit-workflow";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/access-control";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { CheckCircle2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  Draft: { color: "bg-slate-100 text-slate-600", label: "Draft" },
  "Awaiting Owner Response": { color: "bg-violet-100 text-violet-700", label: "Awaiting Owner Response" },
  Open: { color: "bg-red-100 text-red-700", label: "Open" },
  "In Progress": { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  "Pending Closure Evidence": { color: "bg-orange-100 text-orange-700", label: "Pending Closure Evidence" },
  "Submitted for Verification": { color: "bg-blue-100 text-blue-700", label: "Submitted for Verification" },
  "Revision Required": { color: "bg-rose-100 text-rose-700", label: "Revision Required" },
  Verified: { color: "bg-cyan-100 text-cyan-700", label: "Verified" },
  Closed: { color: "bg-emerald-100 text-emerald-700", label: "Closed" },
  Overdue: { color: "bg-red-100 text-red-700", label: "Overdue" },
  "On Hold": { color: "bg-slate-200 text-slate-700", label: "On Hold" },
  Cancelled: { color: "bg-slate-100 text-slate-500", label: "Cancelled" },
  "Risk Accepted": { color: "bg-slate-200 text-slate-700", label: "Risk Accepted" },
};

const CLOSURE_DECISIONS = ["Pending", "Verified", "Partially Verified", "Closure Evidence Rejected", "Technical Validation Required", "Risk Accepted", "Cancelled"];
const AUDIT_STATUS_CONFIG = {
  planned: { color: "bg-slate-100 text-slate-700", label: "Planned" },
  active: { color: "bg-blue-100 text-blue-700", label: "Active" },
  in_review: { color: "bg-amber-100 text-amber-700", label: "In Review" },
  completed: { color: "bg-emerald-100 text-emerald-700", label: "Completed" },
  cancelled: { color: "bg-red-100 text-red-700", label: "Cancelled" },
};

export default function CorrectionPlans() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "correction_manage");
  const canVerify = hasPermission(user, "evidence_review");
  const [data, setData] = useState({ plans: [], owners: [], findings: [], audits: [], controls: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("ongoing");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const [plans, owners, findings, audits, controls] = await Promise.all([
        base44.entities.CorrectionPlan.list("-created_date", 1000),
        base44.entities.Owner.list("full_name", 1000),
        base44.entities.Finding.list("-created_date", 1000),
        base44.entities.Audit.list("-created_date", 500),
        base44.entities.AuditControl.list("control_number", 5000),
      ]);
      setData({ plans, owners, findings, audits, controls });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const ownerName = (id) => data.owners.find((owner) => owner.id === id)?.full_name || "—";
  const filtered = data.plans.filter((plan) => {
    const normalizedStatus = normalizeCorrectionPlanStatus(plan.status);
    const matchesSearch = !search || [plan.corrective_action, plan.gap_description, plan.root_cause, plan.required_closure_evidence, plan.validation_comments].some((value) => value?.toLowerCase().includes(search.toLowerCase()));
    const matchesView = view === "completed" ? normalizedStatus === "Closed" : normalizedStatus !== "Closed";
    return matchesSearch && matchesView && (!status || normalizedStatus === status);
  });
  const correctionAudits = data.audits.filter((audit) => audit.audit_type === "Correction Plan" && (view === "completed" ? audit.status === "completed" : audit.status !== "completed")).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  if (loading) return <Spinner />;

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold">Correction Plans</h1><p className="text-sm text-slate-500 mt-1">The same remediation, verification, reassessment, and closure workflow is used for every audit type.</p></div>{canVerify && <button onClick={() => setEditing({})} className="flex gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />New Action</button>}</div>
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      <button onClick={() => setView("ongoing")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium", view === "ongoing" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>Ongoing correction plans</button>
      <button onClick={() => setView("completed")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium", view === "completed" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>Completed correction plans</button>
    </div>
    <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actions, gaps, root causes, evidence, or comments…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="border rounded-lg px-3 text-sm"><option value="">All statuses</option>{CORRECTION_PLAN_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div>
    {correctionAudits.length > 0 && <div className="space-y-2"><h2 className="text-sm font-semibold text-slate-700">Correction plan audits</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{correctionAudits.map((audit) => <Link key={audit.id} to={`/audits/${audit.id}`} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">{audit.name}</div><div className="mt-1 text-xs text-slate-500">{audit.framework_code || "—"} · {audit.audit_year || "—"}</div></div><StatusBadge status={audit.status} config={AUDIT_STATUS_CONFIG} /></div></Link>)}</div></div>}
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{["Corrective Action", "Primary / Supporting Owners", "Priority / Risk", "Target", "Progress", "Status", ""].map((header) => <th key={header} className="px-4 py-2 text-left font-medium text-slate-600">{header}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((plan) => {
      const normalizedStatus = normalizeCorrectionPlanStatus(plan.status);
      return <tr key={plan.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-medium">{plan.corrective_action}</div><div className="text-xs text-slate-400 max-w-md truncate">{plan.gap_description || plan.required_closure_evidence}</div></td><td className="px-4 py-3"><div>{ownerName(plan.primary_owner_id)}</div><div className="text-xs text-slate-400">{(plan.supporting_owner_ids || []).map(ownerName).join(", ")}</div></td><td className="px-4 py-3"><div className="flex gap-1"><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[plan.priority])}>{plan.priority}</span><span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_CONFIG[plan.risk])}>{plan.risk}</span></div></td><td className="px-4 py-3">{plan.target_date || "—"}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-slate-700 rounded-full" style={{ width: `${Math.min(100, plan.completion_percentage || 0)}%` }} /></div><span className="text-xs">{plan.completion_percentage || 0}%</span></div></td><td className="px-4 py-3"><StatusBadge status={normalizedStatus} config={STATUS_CONFIG} /></td><td className="px-4 py-3">{canManage && <button onClick={() => setEditing({ ...plan, status: normalizedStatus, closure_decision: normalizeClosureDecision(plan.closure_decision) })} className="text-xs border px-2 py-1 rounded">Open</button>}</td></tr>;
    })}</tbody></table>{!filtered.length && <div className="p-8 text-center text-sm text-slate-400">No correction plans found.</div>}</div>
    {editing && <PlanModal value={editing.id ? editing : null} data={data} canVerify={canVerify} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
  </div>;
}

function PlanModal({ value, data, canVerify, onClose, onDone }) {
  const [form, setForm] = useState(() => {
    const initial = { corrective_action: "", gap_description: "", root_cause: "", finding_id: "", audit_id: "", control_id: "", primary_owner_id: "", supporting_owner_ids: [], priority: "medium", risk: "medium", start_date: new Date().toISOString().slice(0, 10), target_date: "", milestones: [], completion_percentage: 0, required_closure_evidence: "", submitted_closure_evidence_url: "", validation_comments: "", escalation_level: 0, closure_decision: "Pending", status_reason: "", risk_acceptance_expiry: "", status: "Awaiting Owner Response", ...(value || {}) };
    initial.status = normalizeCorrectionPlanStatus(initial.status);
    initial.closure_decision = normalizeClosureDecision(initial.closure_decision);
    return initial;
  });
  const [closureFile, setClosureFile] = useState(null);
  const [milestonesText, setMilestonesText] = useState((value?.milestones || []).map((item) => item.title || item.description || String(item)).join("\n"));
  const [saving, setSaving] = useState(false);
  const change = (key, next) => setForm((previous) => ({ ...previous, [key]: next }));
  const controls = data.controls.filter((control) => !form.audit_id || control.audit_id === form.audit_id);
  const ownerStatuses = ["Awaiting Owner Response", "Open", "In Progress", "Pending Closure Evidence", "Submitted for Verification", "On Hold"];
  const selectableStatuses = canVerify ? CORRECTION_PLAN_STATUSES : ownerStatuses;

  const save = async () => {
    const effectiveStatus = statusFromVerificationDecision(form.status, form.closure_decision);
    if (!canVerify && !value) return alert("Only an auditor or compliance reviewer can create a correction plan.");
    if (!canVerify && (form.closure_decision !== "Pending" || !ownerStatuses.includes(effectiveStatus))) return alert("Only an auditor or compliance reviewer can record verification, rejection, closure, cancellation, or risk acceptance.");
    if (!form.corrective_action || !form.primary_owner_id || !form.target_date) return alert("Corrective action, primary owner, and target date are required.");
    if (["Submitted for Verification", "Closed"].includes(effectiveStatus) && !form.submitted_closure_evidence_url && !closureFile) return alert("Closure evidence is required before verification or closure.");
    if (effectiveStatus === "Closed" && !form.validation_comments.trim()) return alert("Validation comments are required for verified closure.");
    if (effectiveStatus === "Closed" && Number(form.completion_percentage) < 100) return alert("Completion must be 100% before closure.");
    if (["Revision Required", "On Hold", "Cancelled", "Risk Accepted"].includes(effectiveStatus) && !form.status_reason.trim()) return alert(`${effectiveStatus} requires a reason.`);
    if (effectiveStatus === "Risk Accepted" && !form.risk_acceptance_expiry) return alert("Risk acceptance requires an expiry date.");
    setSaving(true);
    try {
      let closureUrl = form.submitted_closure_evidence_url;
      if (closureFile) closureUrl = (await base44.integrations.Core.UploadFile({ file: closureFile })).file_url;
      const previousStatus = value ? normalizeCorrectionPlanStatus(value.status) : "";
      const statusHistory = [...(form.status_history || [])];
      if (!value || previousStatus !== effectiveStatus) statusHistory.push({ previous_status: previousStatus, status: effectiveStatus, changed_at: new Date().toISOString(), comment: form.status_reason || form.validation_comments || "Status updated" });
      const milestones = milestonesText.split(/\r?\n/).map((title) => title.trim()).filter(Boolean).map((title, index) => ({ title, display_order: index + 1 }));
      const completion = effectiveStatus === "Closed" ? 100 : Number(form.completion_percentage);
      const closureDecision = deriveClosureDecision(effectiveStatus, form.closure_decision);
      const payload = { ...form, status: effectiveStatus, milestones, submitted_closure_evidence_url: closureUrl, completion_percentage: completion, closure_decision: closureDecision, escalation_level: Number(form.escalation_level) || 0, status_history: statusHistory };
      if (!canVerify && value) {
        ["finding_id", "audit_id", "control_id", "primary_owner_id", "supporting_owner_ids", "priority", "risk", "start_date", "target_date", "required_closure_evidence", "escalation_level", "risk_acceptance_expiry"].forEach((key) => { payload[key] = value[key]; });
      }
      ["id", "created_date", "updated_date", "created_by_id", "is_sample"].forEach((key) => delete payload[key]);
      const record = value ? await base44.entities.CorrectionPlan.update(value.id, payload) : await base44.entities.CorrectionPlan.create(payload);
      if (!value || previousStatus !== effectiveStatus) await recordStatusTransition({ entityType: "CorrectionPlan", entityId: record.id, previousStatus, newStatus: effectiveStatus, reason: form.status_reason || form.validation_comments, auditId: form.audit_id });
      await synchronizeRelatedRecords({ record, form: payload, previousStatus, data });
      await logAudit({ action: value ? "correction_plan_updated" : "correction_plan_created", recordType: "CorrectionPlan", recordId: record.id, recordName: form.corrective_action, previousValue: value, newValue: payload, comment: form.status_reason || form.validation_comments });
      const owner = data.owners.find((candidate) => candidate.id === form.primary_owner_id);
      if (owner) await dispatchNotification({ recipientId: owner.id, recipientEmail: owner.work_email, type: effectiveStatus === "Closed" ? "approval" : "corrective_action", title: `${value ? "Corrective action updated" : "New corrective action"}: ${form.corrective_action}`, body: `Target: ${form.target_date}; status: ${effectiveStatus}; progress: ${completion}%.`, relatedRecordType: "CorrectionPlan", relatedRecordId: record.id, link: "/correction-plans" });
      onDone();
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto"><div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">{value ? "Corrective Action" : "New Corrective Action"}</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-6 space-y-3">
    <Area label="Gap description" value={form.gap_description} set={(next) => change("gap_description", next)} />
    <Area label="Root cause" value={form.root_cause} set={(next) => change("root_cause", next)} />
    <Area label="Corrective action *" value={form.corrective_action} set={(next) => change("corrective_action", next)} />
    <div className="grid md:grid-cols-3 gap-3"><Select disabled={!canVerify} label="Source finding" value={form.finding_id} set={(next) => { const finding = data.findings.find((item) => item.id === next); setForm((previous) => ({ ...previous, finding_id: next, audit_id: finding?.source_audit_id || previous.audit_id, control_id: finding?.control_id || previous.control_id, gap_description: previous.gap_description || finding?.description || "", primary_owner_id: previous.primary_owner_id || finding?.owner_id || "" })); }} options={data.findings.map((finding) => [finding.id, finding.title])} /><Select disabled={!canVerify} label="Source audit" value={form.audit_id} set={(next) => change("audit_id", next)} options={data.audits.map((audit) => [audit.id, audit.name])} /><Select disabled={!canVerify} label="Related control" value={form.control_id} set={(next) => change("control_id", next)} options={controls.map((control) => [control.control_id, `${control.control_number} — ${control.control_title}`])} /></div>
    <div className="grid md:grid-cols-2 gap-3"><Select disabled={!canVerify} label="Primary owner *" value={form.primary_owner_id} set={(next) => change("primary_owner_id", next)} options={data.owners.filter((owner) => owner.active).map((owner) => [owner.id, owner.full_name])} /><label className="text-xs font-medium text-slate-600">Supporting owners<select disabled={!canVerify} multiple value={form.supporting_owner_ids || []} onChange={(event) => change("supporting_owner_ids", Array.from(event.target.selectedOptions).map((option) => option.value))} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-24">{data.owners.filter((owner) => owner.active && owner.id !== form.primary_owner_id).map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label></div>
    <div className="grid md:grid-cols-5 gap-3"><Select disabled={!canVerify} label="Priority" value={form.priority} set={(next) => change("priority", next)} options={["low", "medium", "high", "critical"].map((item) => [item, item])} /><Select disabled={!canVerify} label="Risk" value={form.risk} set={(next) => change("risk", next)} options={["low", "medium", "high", "critical"].map((item) => [item, item])} /><Text disabled={!canVerify} type="date" label="Start date" value={form.start_date} set={(next) => change("start_date", next)} /><Text disabled={!canVerify} type="date" label="Target date *" value={form.target_date} set={(next) => change("target_date", next)} /><Text disabled={!canVerify} type="number" label="Escalation level" value={form.escalation_level} set={(next) => change("escalation_level", next)} /></div>
    <Area label="Milestones (one per line)" value={milestonesText} set={setMilestonesText} />
    <label className="block text-xs font-medium text-slate-600">Completion: {form.completion_percentage || 0}%<input type="range" min="0" max="100" value={form.completion_percentage || 0} onChange={(event) => change("completion_percentage", Number(event.target.value))} className="w-full mt-1" /></label>
    <Area disabled={!canVerify} label="Required closure evidence" value={form.required_closure_evidence} set={(next) => change("required_closure_evidence", next)} />
    <label className="block text-xs font-medium text-slate-600">Submitted closure evidence<input type="file" onChange={(event) => setClosureFile(event.target.files?.[0] || null)} className="w-full mt-1 text-sm" /></label>
    {form.submitted_closure_evidence_url && <a href={form.submitted_closure_evidence_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700">Current closure evidence</a>}
    <Area label="Validation comments" value={form.validation_comments} set={(next) => change("validation_comments", next)} />
    <div className="grid md:grid-cols-2 gap-3"><Select label="Status" value={form.status} set={(next) => change("status", next)} options={selectableStatuses.map((item) => [item, STATUS_CONFIG[item].label])} /><Select disabled={!canVerify} label="Verification decision" value={form.closure_decision} set={(next) => change("closure_decision", next)} options={CLOSURE_DECISIONS.map((item) => [item, item])} /></div>
    {["Revision Required", "On Hold", "Cancelled", "Risk Accepted"].includes(form.status) && <Area label="Status reason *" value={form.status_reason} set={(next) => change("status_reason", next)} />}
    {form.status === "Risk Accepted" && <Text type="date" label="Risk acceptance expiry *" value={form.risk_acceptance_expiry} set={(next) => change("risk_acceptance_expiry", next)} />}
    <p className="text-xs bg-blue-50 text-blue-800 rounded-lg p-3">Closing this plan closes the related finding and returns the control to Under Evaluation for auditor reassessment. It never marks the control Implemented automatically.</p>
    <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg text-sm disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />{saving ? "Saving…" : "Save Corrective Action"}</button>
  </div></div></div>;
}

async function synchronizeRelatedRecords({ record, form, previousStatus, data }) {
  if (form.finding_id) {
    const finding = data.findings.find((item) => item.id === form.finding_id);
    let findingStatus = null;
    if (["Open", "Awaiting Owner Response"].includes(form.status)) findingStatus = "Correction Plan Required";
    if (["In Progress", "Pending Closure Evidence", "Revision Required", "Overdue", "On Hold"].includes(form.status)) findingStatus = "Under Remediation";
    if (["Submitted for Verification", "Verified"].includes(form.status)) findingStatus = "Pending Verification";
    if (form.status === "Closed") findingStatus = "Closed";
    if (form.status === "Risk Accepted") findingStatus = "Risk Accepted";
    if (form.status === "Cancelled" && finding && finding.status !== "Closed") findingStatus = "Open";
    if (findingStatus) {
      const history = [...(finding?.status_history || []), { previous_status: finding?.status || "", status: findingStatus, changed_at: new Date().toISOString(), comment: `Correction plan ${record.id}: ${form.status}` }];
      await base44.entities.Finding.update(form.finding_id, { status: findingStatus, status_history: history, verification_result: form.status === "Closed" ? form.validation_comments : finding?.verification_result || "", closure_evidence_url: form.status === "Closed" ? form.submitted_closure_evidence_url : finding?.closure_evidence_url || "", risk_acceptance_expiry: form.status === "Risk Accepted" ? form.risk_acceptance_expiry : finding?.risk_acceptance_expiry || "" });
      if (!finding || finding.status !== findingStatus) await recordStatusTransition({ entityType: "Finding", entityId: form.finding_id, previousStatus: finding?.status || "", newStatus: findingStatus, reason: `Correction plan ${record.id}: ${form.status}`, auditId: form.audit_id });
    }
  }

  if (form.status === "Closed" && previousStatus !== "Closed" && form.audit_id && form.control_id) {
    const auditControl = data.controls.find((item) => item.audit_id === form.audit_id && item.control_id === form.control_id);
    if (auditControl) {
      await base44.entities.AuditControl.update(auditControl.id, {
        compliance_status: "Under Evaluation",
        is_closed: false,
        closure_date: "",
        evaluation_reason: `Correction plan ${record.id} closed. Control reassessment is required; no implementation decision was applied automatically.`,
        evaluated_at: new Date().toISOString(),
      });
      await recordStatusTransition({ entityType: "AuditControl", entityId: auditControl.id, previousStatus: auditControl.compliance_status, newStatus: "Under Evaluation", reason: `Correction plan ${record.id} closed; reassessment required`, auditId: form.audit_id, auditControlId: auditControl.id });
      await logAudit({ action: "control_reassessment_required", recordType: "AuditControl", recordId: auditControl.id, recordName: auditControl.control_title, previousValue: auditControl.compliance_status, newValue: "Under Evaluation", comment: `Triggered by closure of correction plan ${record.id}` });
    }
  }
}

function statusFromVerificationDecision(status, decision) {
  if (decision === "Verified" || status === "Verified") return "Closed";
  if (["Partially Verified", "Closure Evidence Rejected"].includes(decision)) return "Revision Required";
  if (decision === "Technical Validation Required") return "Submitted for Verification";
  if (decision === "Risk Accepted") return "Risk Accepted";
  if (decision === "Cancelled") return "Cancelled";
  return status;
}

function normalizeClosureDecision(value) {
  const legacy = { pending: "Pending", validated: "Verified", rejected: "Closure Evidence Rejected", closed: "Verified" };
  return legacy[value] || value || "Pending";
}

function deriveClosureDecision(status, selected) {
  if (status === "Closed" || status === "Verified") return "Verified";
  if (status === "Revision Required" && selected === "Pending") return "Partially Verified";
  if (status === "Risk Accepted") return "Risk Accepted";
  if (status === "Cancelled") return "Cancelled";
  return selected || "Pending";
}

function Text({ label, value, set, type = "text", disabled = false }) { return <label className="block text-xs font-medium text-slate-600">{label}<input type={type} value={value || ""} onChange={(event) => set(event.target.value)} disabled={disabled} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" /></label>; }
function Area({ label, value, set, disabled = false }) { return <label className="block text-xs font-medium text-slate-600">{label}<textarea value={value || ""} onChange={(event) => set(event.target.value)} disabled={disabled} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-20 disabled:bg-slate-50 disabled:text-slate-500" /></label>; }
function Select({ label, value, set, options, disabled = false }) { return <label className="block text-xs font-medium text-slate-600">{label}<select value={value || ""} onChange={(event) => set(event.target.value)} disabled={disabled} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"><option value="">—</option>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>; }
function Spinner() { return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }