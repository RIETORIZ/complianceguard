import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { logAudit, dispatchNotification, computeOverdueStatus, EVIDENCE_STATUS_CONFIG, COMPLIANCE_STATUS_CONFIG, REVIEW_STATUS_CONFIG, isFileNameMeaningful, suggestEvidenceName, DEFAULT_EVIDENCE_CONDITIONS } from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { ImportSpreadsheetModal } from "@/components/ImportSpreadsheetModal";
import { ChevronRight, Plus, Upload, X, FileText, Link2, CheckCircle2, AlertTriangle, MessageSquare, FileX, RefreshCw, ShieldCheck, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/access-control";

export default function AuditWorkspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageAudit = hasPermission(user, "audits_manage");
  const canSubmitEvidence = hasPermission(user, "evidence_submit");
  const canReviewEvidence = hasPermission(user, "evidence_review");
  const [audit, setAudit] = useState(null);
  const [controls, setControls] = useState([]);
  const [requests, setRequests] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [owners, setOwners] = useState([]);
  const [domains, setDomains] = useState([]);
  const [frameworkControls, setFrameworkControls] = useState([]);
  const [expectedEvidence, setExpectedEvidence] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sites, setSites] = useState([]);
  const [systems, setSystems] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedControl, setExpandedControl] = useState(null);
  const [showAddControl, setShowAddControl] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEvidence, setShowEvidence] = useState(null);
  const [showReview, setShowReview] = useState(null);

  const load = async () => {
    try {
      const [a, ac, o, d, fc, ee, ec, ou, og, st, sy] = await Promise.all([
        base44.entities.Audit.get(id),
        base44.entities.AuditControl.filter({ audit_id: id }),
        base44.entities.Owner.list("full_name", 500),
        base44.entities.Domain.list("name", 500),
        base44.entities.Control.list("control_number", 1000),
        base44.entities.ExpectedEvidence.list("name", 1000),
        base44.entities.EvidenceCondition.list("name", 2000),
        base44.entities.OrgUnit.list("name", 500),
        base44.entities.OwnerGroup.list("name", 500),
        base44.entities.Site.list("name", 500),
        base44.entities.System.list("name", 500),
      ]);
      setAudit(a); setControls(ac); setOwners(o); setDomains(d); setFrameworkControls(fc); setExpectedEvidence(ee); setConditions(ec); setOrgUnits(ou); setGroups(og); setSites(st); setSystems(sy);
      const reqs = await base44.entities.EvidenceRequest.filter({ audit_id: id });
      setRequests(reqs);
      const subs = await base44.entities.EvidenceSubmission.filter({ evidence_request_id: { $in: reqs.map((r) => r.id) } });
      setSubmissions(subs);
      if (subs.length) setMappings(await base44.entities.EvidenceMapping.filter({ evidence_submission_id: { $in: subs.map((s) => s.id) } })); else setMappings([]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const unsub = base44.entities.EvidenceRequest.subscribe(() => load()); return unsub; }, [id]);

  const ownerName = (oid) => owners.find((o) => o.id === oid)?.full_name || "—";
  const requestsForControl = (acId) => requests.filter((r) => r.audit_control_id === acId);
  const submissionsFor = (reqId) => submissions.filter((s) => s.evidence_request_id === reqId).sort((a, b) => b.version - a.version);

  const addCustomControl = async (title, number, text) => {
    const ctrl = await base44.entities.Control.create({
      framework_id: audit.framework_id || "", title, control_number: number || "", official_text: "", custom_requirement_text: text, control_type: "custom", is_custom: true, priority: "medium", active: true,
    });
    const ac = await base44.entities.AuditControl.create({
      audit_id: id, control_id: ctrl.id, framework_id: audit.framework_id, control_number: number || "", control_title: title, compliance_status: "Under Evaluation",
    });
    await logAudit({ action: "control_added", recordType: "AuditControl", recordId: ac.id, recordName: title, newValue: ac });
    setShowAddControl(false);
    load();
  };

  const addFrameworkControl = async (controlId) => {
    const fc = frameworkControls.find((c) => c.id === controlId);
    if (!fc) return;
    const ac = await base44.entities.AuditControl.create({
      audit_id: id, control_id: fc.id, framework_id: fc.framework_id, domain_id: fc.domain_id, control_number: fc.control_number, control_title: fc.title, compliance_status: "Under Evaluation",
    });
    await logAudit({ action: "control_added", recordType: "AuditControl", recordId: ac.id, recordName: fc.title, newValue: ac });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (!audit) return <div className="text-center py-20 text-slate-500">Audit not found.</div>;

  const domainName = (domId) => domains.find((d) => d.id === domId)?.name || "—";
  const grouped = {};
  controls.forEach((c) => { const k = c.domain_id || "ungrouped"; grouped[k] = grouped[k] || []; grouped[k].push(c); });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link to="/audits" className="hover:text-slate-900">Audits</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 font-medium">{audit.name}</span>
      </div>

      {/* Audit header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{audit.framework_code}</div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{audit.name}</h1>
                <div className="text-sm text-slate-500">{audit.audit_type} · {audit.audit_year}</div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-sm border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"><Upload className="w-4 h-4" /> Import</button>
            <button onClick={() => setShowAddControl(true)} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg"><Plus className="w-4 h-4" /> Add Control</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div><div className="text-[10px] uppercase text-slate-400 font-semibold">Controls</div><div className="text-lg font-semibold text-slate-900">{controls.length}</div></div>
          <div><div className="text-[10px] uppercase text-slate-400 font-semibold">Evidence Requests</div><div className="text-lg font-semibold text-slate-900">{requests.length}</div></div>
          <div><div className="text-[10px] uppercase text-slate-400 font-semibold">Overdue</div><div className="text-lg font-semibold text-red-700">{requests.filter((r) => computeOverdueStatus(r) === "Overdue").length}</div></div>
          <div><div className="text-[10px] uppercase text-slate-400 font-semibold">Implemented</div><div className="text-lg font-semibold text-emerald-700">{controls.filter((c) => c.compliance_status === "Implemented").length}</div></div>
        </div>
      </div>

      {/* Drill-down: Audit → Domain → Control → Evidence */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck className="w-4 h-4" /> Drill-down: Audit → Domain → Control → Expected Evidence → Submission → Review
        </div>
        <div className="divide-y divide-slate-100">
          {Object.entries(grouped).map(([domId, ctrls]) => (
            <div key={domId}>
              <div className="px-5 py-2.5 bg-slate-50/50 text-xs font-semibold text-slate-600 uppercase tracking-wide">{domainName(domId)}</div>
              {ctrls.map((ac) => {
                const reqs = requestsForControl(ac.id);
                const isExpanded = expandedControl === ac.id;
                return (
                  <div key={ac.id} className="border-t border-slate-50">
                    <button onClick={() => setExpandedControl(isExpanded ? null : ac.id)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left">
                      <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{ac.control_number}</span>{ac.control_title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={ac.compliance_status} config={COMPLIANCE_STATUS_CONFIG} />
                          {reqs.length > 0 && <span className="text-xs text-slate-400">{reqs.length} evidence request(s)</span>}
                        </div>
                      </div>
                      {ac.is_closed && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">CLOSED</span>}
                    </button>
                    {isExpanded && (
                      <ControlDetail audit={audit} auditControl={ac} requests={reqs} owners={owners}
                        ownerName={ownerName} submissionsFor={submissionsFor}
                        onEvidenceSubmit={() => load()} onShowReview={(req) => setShowReview(req)}
                        onShowEvidence={(req) => setShowEvidence(req)}
                        onUpdateCompliance={async (status) => {
                          const prev = ac.compliance_status;
                          await base44.entities.AuditControl.update(ac.id, { compliance_status: status });
                          await logAudit({ action: "status_changed", recordType: "AuditControl", recordId: ac.id, recordName: ac.control_title, previousValue: prev, newValue: status, comment: "Compliance status updated by auditor" });
                          load();
                        }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {controls.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No controls yet. Add a control or import from spreadsheet.</div>}
        </div>
      </div>

      {/* Add control modal */}
      {showAddControl && <AddControlModal onClose={() => setShowAddControl(false)} onAddCustom={addCustomControl} frameworkControls={frameworkControls.filter((c) => !c.parent_id && c.framework_id === audit.framework_id && !controls.find((x) => x.control_id === c.id))} onAddExisting={addFrameworkControl} />}

      {/* Import modal */}
      {showImport && <ImportSpreadsheetModal auditId={id} audit={audit} owners={owners} onClose={() => setShowImport(false)} onDone={load} />}

      {/* Evidence upload modal */}
      {showEvidence && <EvidenceUploadModal request={showEvidence} audit={audit} owners={owners} submissions={submissionsFor(showEvidence.id)} onClose={() => setShowEvidence(null)} onDone={load} />}

      {/* Review modal */}
      {showReview && <EvidenceReviewModal request={showReview} audit={audit} submission={submissionsFor(showReview.id)[0]} onClose={() => setShowReview(null)} onDone={load} owners={owners} />}
    </div>
  );
}

function ControlDetail({ audit, auditControl, requests, owners, ownerName, submissionsFor, onEvidenceSubmit, onShowReview, onShowEvidence, onUpdateCompliance }) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  return (
    <div className="px-5 py-4 bg-slate-50/30 border-t border-slate-50 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Compliance status:</span>
        <select value={auditControl.compliance_status} onChange={(e) => onUpdateCompliance(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1">
          {Object.keys(COMPLIANCE_STATUS_CONFIG).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[10px] text-slate-400 ml-2">Evidence being received does NOT auto-set compliance — auditor must assess explicitly.</span>
      </div>
      {auditControl.auditor_comments && <div className="text-xs text-slate-600 bg-white rounded-lg p-2 border border-slate-100"><span className="font-semibold">Auditor comments:</span> {auditControl.auditor_comments}</div>}
      <div className="space-y-2">
        {requests.map((r) => {
          const subs = submissionsFor(r.id);
          const activeSub = subs.find((s) => s.is_active_version);
          return (
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> {r.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.evidence_type || "Evidence"}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={computeOverdueStatus(r)} config={EVIDENCE_STATUS_CONFIG} />
                    {activeSub && <StatusBadge status={activeSub.review_status} config={REVIEW_STATUS_CONFIG} />}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    Owner: {(r.assigned_owner_ids || []).map(ownerName).join(", ") || r.assigned_department_id || "—"} ·
                    Due: {r.due_date || "—"} ·
                    {subs.length > 0 && ` ${subs.length} version(s)`}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => onShowEvidence(r)} className="text-xs border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Upload className="w-3 h-3" /> Submit</button>
                  {activeSub && <button onClick={() => onShowReview(r)} className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Review</button>}
                  {activeSub && activeSub.file_url && <a href={activeSub.file_url} target="_blank" rel="noreferrer" className="text-xs border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 flex items-center gap-1 justify-center"><FileText className="w-3 h-3" /> Preview</a>}
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && <div className="text-xs text-slate-400">No evidence requests yet.</div>}
      </div>
      <button onClick={() => setShowRequestForm(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"><Plus className="w-3.5 h-3.5" /> Request evidence</button>
      {showRequestForm && <RequestForm audit={audit} auditControl={auditControl} owners={owners} onClose={() => setShowRequestForm(false)} onDone={() => { setShowRequestForm(false); onEvidenceSubmit(); }} />}
    </div>
  );
}

function RequestForm({ audit, auditControl, owners, onClose, onDone }) {
  const [form, setForm] = useState({ title: "", evidence_type: "", due_date: "", owner_ids: [], department_id: "", division_id: "", notification_method: "immediate" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const req = await base44.entities.EvidenceRequest.create({
        audit_id: audit.id, audit_control_id: auditControl.id, control_id: auditControl.control_id, framework_id: audit.framework_id,
        title: form.title, evidence_type: form.evidence_type, status: "Requested", review_status: "awaiting_review",
        request_date: new Date().toISOString().slice(0, 10), due_date: form.due_date, assigned_owner_ids: form.owner_ids,
        assigned_department_id: form.department_id, assigned_division_id: form.division_id, notification_method: form.notification_method,
        status_history: [{ status: "Requested", changed_by: "auditor", changed_at: new Date().toISOString(), comment: "Created" }],
      });
      await logAudit({ action: "evidence_request_created", recordType: "EvidenceRequest", recordId: req.id, recordName: form.title, newValue: req });
      for (const oid of form.owner_ids) {
        const owner = owners.find((o) => o.id === oid);
        await dispatchNotification({ recipientId: oid, recipientEmail: owner?.work_email, type: "new_evidence_request", title: `New evidence request: ${form.title}`, body: `Evidence requested for ${audit.name} — ${auditControl.control_title}. Due: ${form.due_date || "N/A"}`, relatedRecordType: "EvidenceRequest", relatedRecordId: req.id, link: `/audits/${audit.id}`, deliveryMode: form.notification_method === "end_of_day" ? "end_of_day" : "immediate" });
      }
      onDone();
    } catch (e) { alert("Failed: " + e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 mt-2 space-y-2">
      <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Evidence title" className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
      <input value={form.evidence_type} onChange={(e) => setForm((p) => ({ ...p, evidence_type: e.target.value }))} placeholder="Evidence type (e.g. Approved Policy)" className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
      <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
      <div className="flex gap-2">
        <select multiple value={form.owner_ids} onChange={(e) => setForm((p) => ({ ...p, owner_ids: Array.from(e.target.selectedOptions).map((o) => o.value) }))} className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 h-20">
          {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
        <div className="text-[10px] text-slate-400 self-center">Hold Ctrl/Cmd to multi-select (person/group)</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Notify:</span>
        <select value={form.notification_method} onChange={(e) => setForm((p) => ({ ...p, notification_method: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1">
          <option value="immediate">Immediate</option>
          <option value="end_of_day">End of day</option>
          <option value="both">Both</option>
          <option value="none">None</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !form.title} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">{saving ? "Creating…" : "Create request"}</button>
        <button onClick={onClose} className="text-xs text-slate-500 px-3 py-1.5">Cancel</button>
      </div>
    </div>
  );
}

function AddControlModal({ onClose, onAddCustom, onAddExisting, frameworkControls }) {
  const [mode, setMode] = useState("custom");
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Add Control</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode("custom")} className={cn("flex-1 text-sm py-2 rounded-lg border", mode === "custom" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200")}>Custom Control</button>
            <button onClick={() => setMode("existing")} className={cn("flex-1 text-sm py-2 rounded-lg border", mode === "existing" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200")}>From Framework</button>
          </div>
          {mode === "custom" ? (
            <>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Control title" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Control number (optional)" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Requirement text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 h-24" />
              <button onClick={() => onAddCustom(title, number, text)} disabled={!title} className="w-full text-sm bg-slate-900 text-white py-2 rounded-lg disabled:opacity-50">Add Custom Control</button>
            </>
          ) : (
            <>
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 h-40">
                <option value="">Select existing control…</option>
                {frameworkControls.map((c) => <option key={c.id} value={c.id}>{c.control_number} — {c.title}</option>)}
              </select>
              <button onClick={() => { onAddExisting(selected); }} disabled={!selected} className="w-full text-sm bg-slate-900 text-white py-2 rounded-lg disabled:opacity-50">Add Selected Control</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function EvidenceUploadModal({ request, audit, owners, submissions, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(request?.title || "");
  const [checklist, setChecklist] = useState(DEFAULT_EVIDENCE_CONDITIONS.map((c) => ({ condition: c, passed: false })));
  const [uploading, setUploading] = useState(false);
  const [showReuse, setShowReuse] = useState(false);

  const poorName = file && !isFileNameMeaningful(file.name);
  const suggestedName = suggestEvidenceName({ frameworkCode: audit.framework_code, controlNumber: request?.control_number, evidenceType: request?.evidence_type, system: "", date: String(new Date().getFullYear()) });

  const submit = async () => {
    setUploading(true);
    try {
      let fileUrl = "";
      let fileType = "";
      let fileSize = 0;
      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        fileType = file.name.split(".").pop();
        fileSize = file.size;
      }
      const masterId = submissions[0]?.master_evidence_id || `EV-${Date.now()}`;
      const newVersion = (submissions[0]?.version || 0) + 1;
      // mark previous versions inactive
      for (const s of submissions.filter((s) => s.is_active_version)) {
        await base44.entities.EvidenceSubmission.update(s.id, { is_active_version: false });
      }
      const sub = await base44.entities.EvidenceSubmission.create({
        evidence_request_id: request.id, master_evidence_id: masterId, display_title: title || suggestedName,
        original_file_name: file?.name || "", file_url: fileUrl, file_type: fileType, file_size: fileSize,
        version: newVersion, is_active_version: true, upload_date: new Date().toISOString(),
        received_date: new Date().toISOString(), approval_status: "pending", confidentiality_classification: "confidential",
        checklist_completed: true, checklist_results: checklist, linked_audit_control_ids: [],
      });
      await base44.entities.EvidenceRequest.update(request.id, {
        status: "Received", review_status: "awaiting_review", submission_date: new Date().toISOString().slice(0, 10),
        received_date: new Date().toISOString(),
        status_history: [...(request.status_history || []), { status: "Received", changed_by: "auditee", changed_at: new Date().toISOString(), comment: "Evidence submitted" }],
      });
      await logAudit({ action: "evidence_uploaded", recordType: "EvidenceSubmission", recordId: sub.id, recordName: title || suggestedName, newValue: sub });
      await logAudit({ action: "evidence_uploaded", recordType: "EvidenceRequest", recordId: request.id, recordName: request.title, comment: `Original file: ${file?.name || ""} → Title: ${title || suggestedName}` });
      onDone();
      onClose();
    } catch (e) { alert("Upload failed: " + e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Submit Evidence</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Evidence Title (meaningful name required)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestedName} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[10px] text-slate-400 mt-1">Suggested naming: Framework_Control_EvidenceType_System_Date e.g. ECC_1-X-X_Approved_Cybersecurity_Policy_2026.pdf</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">File</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="w-full mt-1 text-sm" />
            {poorName && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  The file name <code className="bg-amber-100 px-1 rounded">{file.name}</code> appears non-meaningful. This evidence may be rejected. Please provide a meaningful evidence title above, or use the suggested name.
                  <button onClick={() => setTitle(suggestedName)} className="underline ml-1 font-medium">Use suggested name</button>
                </div>
              </div>
            )}
          </div>
          {/* Self-checklist */}
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Evidence Condition Self-Checklist</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {checklist.map((c, i) => (
                <label key={i} className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={c.passed} onChange={(e) => setChecklist((p) => p.map((x, idx) => idx === i ? { ...x, passed: e.target.checked } : x))} />
                  {c.condition}
                </label>
              ))}
            </div>
          </div>
          {submissions.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <div className="font-semibold mb-1 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Version history</div>
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-0.5">
                  <span>v{s.version} — {s.display_title}</span>
                  <span className="text-slate-400">{s.is_active_version ? "active" : "archived"}</span>
                </div>
              ))}
              <div className="text-[10px] text-slate-400 mt-1">Uploading a new version preserves the previous one (no overwrite).</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
          <button onClick={() => setShowReuse(!showReuse)} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Add this evidence to other controls</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-slate-600 px-4 py-2">Cancel</button>
            <button onClick={submit} disabled={uploading || (!file && !title)} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">{uploading ? "Uploading…" : "Submit Evidence"}</button>
          </div>
        </div>
        {showReuse && (
          <div className="px-6 pb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              After submission, the auditor can reuse this evidence across multiple controls. Matching is based on evidence type, expected evidence name, common framework, system/site scope, and compatible acceptance conditions. Each linked control is reviewed independently.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceReviewModal({ request, audit, submission, onClose, onDone, owners }) {
  const [reviewStatus, setReviewStatus] = useState(submission?.review_status || "awaiting_review");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFinding, setShowFinding] = useState(false);

  const actions = [
    { value: "accepted", label: "Accept evidence", icon: CheckCircle2, color: "text-emerald-600", requireReason: false },
    { value: "accepted_with_observation", label: "Accept with observation", icon: CheckCircle2, color: "text-teal-600", requireReason: false },
    { value: "rejected", label: "Reject evidence", icon: FileX, color: "text-red-600", requireReason: true },
    { value: "clarification_requested", label: "Request clarification", icon: MessageSquare, color: "text-purple-600", requireReason: true },
    { value: "further_comments_requested", label: "Request further comments", icon: MessageSquare, color: "text-purple-600", requireReason: false },
    { value: "corrected_file_requested", label: "Request corrected file", icon: RefreshCw, color: "text-amber-600", requireReason: true },
    { value: "updated_evidence_requested", label: "Request updated evidence", icon: RefreshCw, color: "text-amber-600", requireReason: true },
    { value: "formal_approval_requested", label: "Request formal approval", icon: ShieldCheck, color: "text-blue-600", requireReason: false },
    { value: "partially_sufficient", label: "Mark partially sufficient", icon: AlertTriangle, color: "text-orange-600", requireReason: false },
  ];

  const apply = async (action) => {
    const act = actions.find((a) => a.value === action);
    if (act.requireReason && !reason) { alert("A reason is required for this action."); return; }
    setSaving(true);
    try {
      const updates = { review_status: action, review_comments: comments, rejection_reason: reason };
      if (action === "accepted" || action === "accepted_with_observation") { updates.approval_status = "approved"; updates.acceptance_date = new Date().toISOString(); }
      if (action === "rejected") { updates.approval_status = "rejected"; updates.rejection_date = new Date().toISOString(); }
      await base44.entities.EvidenceSubmission.update(submission.id, updates);
      const reqUpdates = { review_status: action, review_comments: comments, rejection_reason: reason };
      if (action === "rejected") reqUpdates.status = "Require Further Comments";
      if (action === "further_comments_requested") reqUpdates.status = "Require Further Comments";
      if (action === "clarification_requested") reqUpdates.status = "Require Further Comments";
      if (action === "partially_sufficient") reqUpdates.status = "Partially Received";
      await base44.entities.EvidenceRequest.update(request.id, reqUpdates);
      await logAudit({ action: "evidence_reviewed", recordType: "EvidenceSubmission", recordId: submission.id, recordName: submission.display_title, previousValue: submission.review_status, newValue: action, comment: comments, reason });
      // notify owner
      for (const oid of request.assigned_owner_ids || []) {
        const owner = owners.find((o) => o.id === oid);
        await dispatchNotification({ recipientId: oid, recipientEmail: owner?.work_email, type: action === "accepted" ? "approval" : "rejection", title: `Evidence ${act.label}: ${submission.display_title}`, body: comments || reason || "Evidence review action taken.", relatedRecordType: "EvidenceRequest", relatedRecordId: request.id, link: `/audits/${audit.id}` });
      }
      onDone();
      onClose();
    } catch (e) { alert("Failed: " + e.message); }
    finally { setSaving(false); }
  };

  const closeEligible = async () => {
    // approve evidence and close all eligible controls (where all mandatory evidence accepted)
    setSaving(true);
    try {
      const allReqs = await base44.entities.EvidenceRequest.filter({ audit_control_id: request.audit_control_id });
      const allAccepted = allReqs.every((r) => r.review_status === "accepted" || r.review_status === "accepted_with_observation" || r.status === "Not Applicable");
      if (!allAccepted) { alert("Not all evidence for this control is accepted. Cannot close yet."); setSaving(false); return; }
      await base44.entities.AuditControl.update(request.audit_control_id, { is_closed: true, closure_date: new Date().toISOString().slice(0, 10), compliance_status: "Implemented" });
      await logAudit({ action: "control_closure", recordType: "AuditControl", recordId: request.audit_control_id, recordName: "Control closure", comment: "Closed after all mandatory evidence approved" });
      onDone(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const createFinding = async () => {
    await base44.entities.Finding.create({
      title: `Finding from ${request.title}`, description: comments || "Finding from rejected evidence review.",
      source_audit_id: audit.id, source_type: "Evidence Review", framework_id: audit.framework_id, control_id: request.control_id,
      audit_control_id: request.audit_control_id, evidence_request_id: request.id, severity: "medium", risk_rating: "medium",
      regulatory_impact: "", owner_id: (request.assigned_owner_ids || [])[0] || "", department_id: request.assigned_department_id || "",
      due_date: "", auditor_comments: comments, status: "open",
    });
    await logAudit({ action: "finding_created", recordType: "Finding", recordName: request.title, comment: "Created from evidence review" });
    alert("Finding created.");
    onDone(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Review Evidence</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-slate-900">{submission?.display_title}</div>
            <div className="text-xs text-slate-500 mt-1">v{submission?.version} · {submission?.original_file_name} · {submission?.file_type}</div>
            {submission?.file_url && <a href={submission.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Preview evidence</a>}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Reviewer comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm h-20" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Reason (required for reject / return for revision)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {actions.map((a) => (
              <button key={a.value} onClick={() => apply(a.value)} disabled={saving} className="flex items-center gap-2 text-sm border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 text-left">
                <a.icon className={`w-4 h-4 ${a.color}`} /> {a.label} {a.requireReason && <span className="text-[10px] text-red-500 ml-auto">reason required</span>}
              </button>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button onClick={closeEligible} disabled={saving} className="w-full flex items-center justify-center gap-2 text-sm bg-emerald-600 text-white py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" /> Approve evidence & close eligible controls
            </button>
            <button onClick={() => createFinding()} className="w-full flex items-center justify-center gap-2 text-sm border border-red-200 text-red-700 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" /> Create finding from this evidence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}