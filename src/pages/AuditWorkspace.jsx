import React, { useState, useEffect } from "react";
import { useParams, Link } from "@/lib/router";
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
          {canManageAudit && <div className="flex gap-2">
            {["Internal Audit", "Technical Assessment", "Correction Plan"].includes(audit.audit_type) && <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-sm border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"><Upload className="w-4 h-4" /> Import</button>}
            <button onClick={() => setShowAddControl(true)} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg"><Plus className="w-4 h-4" /> Add Control</button>
          </div>}
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
                        ownerName={ownerName} submissionsFor={submissionsFor} expectedEvidence={expectedEvidence} conditions={conditions} orgUnits={orgUnits} groups={groups}
                        canManageAudit={canManageAudit} canSubmitEvidence={canSubmitEvidence} canReviewEvidence={canReviewEvidence}
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
      {showAddControl && <AddControlModal onClose={() => setShowAddControl(false)} onAddCustom={addCustomControl} frameworkControls={frameworkControls.filter((c) => !c.parent_id && (["Internal Audit", "Technical Assessment", "Correction Plan"].includes(audit.audit_type) || c.framework_id === audit.framework_id) && !controls.find((x) => x.control_id === c.id))} onAddExisting={addFrameworkControl} />}

      {/* Import modal */}
      {showImport && <ImportSpreadsheetModal auditId={id} audit={audit} owners={owners} onClose={() => setShowImport(false)} onDone={load} />}

      {/* Evidence upload modal */}
      {showEvidence && <EvidenceUploadModal request={showEvidence} audit={audit} owners={owners} submissions={submissionsFor(showEvidence.id)} expected={expectedEvidence.find((e) => e.id === showEvidence.expected_evidence_id)} conditions={conditions.filter((c) => c.expected_evidence_id === showEvidence.expected_evidence_id && c.active !== false)} systems={systems} sites={sites} orgUnits={orgUnits} requests={requests} auditControls={controls} allSubmissions={submissions} onClose={() => setShowEvidence(null)} onDone={load} />}

      {/* Review modal */}
      {showReview && <EvidenceReviewModal request={showReview} audit={audit} submission={submissionsFor(showReview.id)[0]} mappings={mappings} requests={requests} auditControls={controls} submissions={submissions} expectedEvidence={expectedEvidence} conditions={conditions} onClose={() => setShowReview(null)} onDone={load} owners={owners} />}
    </div>
  );
}

function ControlDetail({ audit, auditControl, requests, owners, ownerName, submissionsFor, expectedEvidence, conditions, orgUnits, groups, canManageAudit, canSubmitEvidence, canReviewEvidence, onEvidenceSubmit, onShowReview, onShowEvidence, onUpdateCompliance }) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const expectedForControl = expectedEvidence.filter((item) => item.control_id === auditControl.control_id);
  return (
    <div className="px-5 py-4 bg-slate-50/30 border-t border-slate-50 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Compliance status:</span>
        <select disabled={!canReviewEvidence} value={auditControl.compliance_status} onChange={(e) => onUpdateCompliance(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 disabled:bg-slate-100">
          {Object.keys(COMPLIANCE_STATUS_CONFIG).map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <span className="text-[10px] text-slate-400 ml-2">Evidence receipt and compliance implementation are deliberately independent.</span>
      </div>
      {auditControl.auditor_comments && <div className="text-xs text-slate-600 bg-white rounded-lg p-2 border border-slate-100"><span className="font-semibold">Auditor comments:</span> {auditControl.auditor_comments}</div>}
      {expectedForControl.length > 0 && <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-2"><span className="font-semibold">Expected evidence:</span> {expectedForControl.map((item) => item.name).join('; ')}</div>}
      <div className="space-y-2">
        {requests.map((request) => {
          const versions = submissionsFor(request.id);
          const activeSubmission = versions.find((submission) => submission.is_active_version) || versions[0];
          const assignedUnits = [request.assigned_sector_id, request.assigned_department_id, request.assigned_division_id].filter(Boolean).map((unitId) => orgUnits.find((unit) => unit.id === unitId)?.name).filter(Boolean);
          const assignedGroups = (request.assigned_group_ids || []).map((groupId) => groups.find((group) => group.id === groupId)?.name).filter(Boolean);
          return (
            <div key={request.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-blue-500" /> {request.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{request.evidence_type || 'Evidence'}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={computeOverdueStatus(request)} config={EVIDENCE_STATUS_CONFIG} />
                    {activeSubmission && <StatusBadge status={activeSubmission.review_status || request.review_status} config={REVIEW_STATUS_CONFIG} />}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    Assigned: {[...(request.assigned_owner_ids || []).map(ownerName), ...assignedGroups, ...assignedUnits].filter((value) => value && value !== '—').join(', ') || '—'} · Due: {request.due_date || '—'} · {versions.length > 0 ? `${versions.length} version(s)` : 'No submission'}
                  </div>
                  {request.received_date && <div className="text-[11px] text-slate-400 mt-1">Received: {new Date(request.received_date).toLocaleString()}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  {canSubmitEvidence && <button onClick={() => onShowEvidence(request)} className="text-xs border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Upload className="w-3 h-3" /> Submit</button>}
                  {activeSubmission && canReviewEvidence && <button onClick={() => onShowReview(request)} className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Review</button>}
                  {activeSubmission && <Link to={`/evidence/${activeSubmission.id}`} className="text-xs border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 flex items-center gap-1 justify-center"><FileText className="w-3 h-3" /> Preview</Link>}
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && <div className="text-xs text-slate-400">No evidence requests yet.</div>}
      </div>
      {canManageAudit && <button onClick={() => setShowRequestForm(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"><Plus className="w-3.5 h-3.5" /> Request evidence</button>}
      {showRequestForm && <RequestForm audit={audit} auditControl={auditControl} owners={owners} expectedEvidence={expectedForControl} conditions={conditions} orgUnits={orgUnits} groups={groups} onClose={() => setShowRequestForm(false)} onDone={() => { setShowRequestForm(false); onEvidenceSubmit(); }} />}
    </div>
  );
}

function RequestForm({ audit, auditControl, owners, expectedEvidence, conditions, orgUnits, groups, onClose, onDone }) {
  const [form, setForm] = useState({ expected_evidence_id: '', title: '', evidence_type: '', description: '', due_date: '', owner_ids: [], group_ids: [], sector_id: '', department_id: '', division_id: '', notification_method: 'immediate', condition_text: '' });
  const [saving, setSaving] = useState(false);
  const departments = orgUnits.filter((unit) => unit.type === 'department' && (!form.sector_id || unit.parent_id === form.sector_id));
  const divisions = orgUnits.filter((unit) => unit.type === 'division' && (!form.department_id || unit.parent_id === form.department_id));
  const selectExpected = (expectedId) => {
    const expected = expectedEvidence.find((item) => item.id === expectedId);
    const expectedConditions = conditions.filter((condition) => condition.expected_evidence_id === expectedId && condition.active !== false);
    setForm((previous) => ({ ...previous, expected_evidence_id: expectedId, title: expected?.name || '', evidence_type: expected?.evidence_type || '', description: expected?.description || '', condition_text: expectedConditions.map((condition) => condition.name).join('\n') }));
  };
  const resolveRecipients = () => {
    const ids = new Set(form.owner_ids);
    const selectedGroups = groups.filter((group) => form.group_ids.includes(group.id));
    selectedGroups.forEach((group) => (group.member_ids || []).forEach((ownerId) => ids.add(ownerId)));
    owners.forEach((owner) => {
      if (form.division_id && owner.division_id === form.division_id) ids.add(owner.id);
      else if (form.department_id && owner.department_id === form.department_id) ids.add(owner.id);
      else if (form.sector_id && owner.sector_id === form.sector_id) ids.add(owner.id);
    });
    return Array.from(ids).filter((ownerId) => owners.find((owner) => owner.id === ownerId)?.active !== false);
  };
  const submit = async () => {
    if (!form.title || !form.due_date) return alert('Evidence title and due date are required.');
    setSaving(true);
    try {
      let expectedId = form.expected_evidence_id;
      if (!expectedId) {
        const expected = await base44.entities.ExpectedEvidence.create({ control_id: auditControl.control_id, framework_id: auditControl.framework_id || audit.framework_id || '', evidence_type: form.evidence_type || 'Custom Evidence', name: form.title, description: form.description, is_mandatory: true, allow_reuse: true });
        expectedId = expected.id;
        const conditionNames = form.condition_text.split(/\r?\n|;|\|/).map((value) => value.trim()).filter(Boolean);
        if (conditionNames.length) await base44.entities.EvidenceCondition.bulkCreate(conditionNames.map((name) => ({ expected_evidence_id: expectedId, control_id: auditControl.control_id, name, is_mandatory: true, active: true })));
      }
      const recipientIds = resolveRecipients();
      const request = await base44.entities.EvidenceRequest.create({
        audit_id: audit.id, audit_control_id: auditControl.id, control_id: auditControl.control_id, framework_id: auditControl.framework_id || audit.framework_id || '', expected_evidence_id: expectedId,
        title: form.title, evidence_type: form.evidence_type, description: form.description, status: 'Requested', review_status: 'awaiting_review',
        request_date: new Date().toISOString().slice(0, 10), due_date: form.due_date, assigned_owner_ids: recipientIds,
        assigned_group_ids: form.group_ids, assigned_sector_id: form.sector_id, assigned_department_id: form.department_id, assigned_division_id: form.division_id,
        notification_method: form.notification_method,
        status_history: [{ status: 'Requested', changed_by: 'auditor', changed_at: new Date().toISOString(), comment: 'Created' }],
      });
      await logAudit({ action: 'evidence_request_created', recordType: 'EvidenceRequest', recordId: request.id, recordName: form.title, newValue: request });
      for (const ownerId of recipientIds) {
        const owner = owners.find((record) => record.id === ownerId);
        await dispatchNotification({ recipientId: ownerId, recipientEmail: owner?.work_email, type: 'new_evidence_request', title: `New evidence request: ${form.title}`, body: `Evidence requested for ${audit.name} — ${auditControl.control_title}. Due: ${form.due_date}`, relatedRecordType: 'EvidenceRequest', relatedRecordId: request.id, link: `/audits/${audit.id}`, deliveryMode: form.notification_method });
      }
      onDone();
    } catch (error) { alert(`Failed: ${error.message}`); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mt-2 space-y-3">
      {expectedEvidence.length > 0 && <label className="block text-xs font-medium text-slate-600">Expected evidence library<select value={form.expected_evidence_id} onChange={(event) => selectExpected(event.target.value)} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-2.5 py-2"><option value="">Create custom expected evidence</option>{expectedEvidence.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="grid md:grid-cols-2 gap-2"><input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Evidence title" className="text-sm border border-slate-200 rounded-lg px-2.5 py-2" /><input value={form.evidence_type} onChange={(event) => setForm((previous) => ({ ...previous, evidence_type: event.target.value }))} placeholder="Evidence type" className="text-sm border border-slate-200 rounded-lg px-2.5 py-2" /></div>
      <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Why the evidence is required / evidence instructions" className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 h-16" />
      <textarea disabled={!!form.expected_evidence_id} value={form.condition_text} onChange={(event) => setForm((previous) => ({ ...previous, condition_text: event.target.value }))} placeholder="Acceptance conditions, one per line" className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 h-20 disabled:bg-slate-50" />
      <label className="block text-xs font-medium text-slate-600">Due date<input type="date" value={form.due_date} onChange={(event) => setForm((previous) => ({ ...previous, due_date: event.target.value }))} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-2.5 py-2" /></label>
      <div className="grid md:grid-cols-2 gap-2"><label className="text-xs font-medium text-slate-600">People<select multiple value={form.owner_ids} onChange={(event) => setForm((previous) => ({ ...previous, owner_ids: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-2 py-1 h-24">{owners.filter((owner) => owner.active).map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name} — {owner.work_email}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Predefined groups<select multiple value={form.group_ids} onChange={(event) => setForm((previous) => ({ ...previous, group_ids: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-2 py-1 h-24">{groups.filter((group) => group.active !== false).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
      <div className="grid md:grid-cols-3 gap-2"><label className="text-xs font-medium text-slate-600">Sector<select value={form.sector_id} onChange={(event) => setForm((previous) => ({ ...previous, sector_id: event.target.value, department_id: '', division_id: '' }))} className="w-full mt-1 text-sm border rounded-lg px-2 py-2"><option value="">None</option>{orgUnits.filter((unit) => unit.type === 'sector' && unit.active !== false).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Department<select value={form.department_id} onChange={(event) => setForm((previous) => ({ ...previous, department_id: event.target.value, division_id: '' }))} className="w-full mt-1 text-sm border rounded-lg px-2 py-2"><option value="">None</option>{departments.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Division<select value={form.division_id} onChange={(event) => setForm((previous) => ({ ...previous, division_id: event.target.value }))} className="w-full mt-1 text-sm border rounded-lg px-2 py-2"><option value="">None</option>{divisions.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label></div>
      <label className="flex items-center gap-2 text-xs text-slate-600">Notification method<select value={form.notification_method} onChange={(event) => setForm((previous) => ({ ...previous, notification_method: event.target.value }))} className="text-xs border rounded-lg px-2 py-1"><option value="immediate">Immediate</option><option value="end_of_day">End of day</option><option value="both">Both</option><option value="none">In application only</option></select></label>
      <div className="flex gap-2"><button onClick={submit} disabled={saving || !form.title || !form.due_date} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">{saving ? 'Creating…' : 'Create request'}</button><button onClick={onClose} className="text-xs text-slate-500 px-3 py-1.5">Cancel</button></div>
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

export function EvidenceUploadModal({ request, audit, owners, submissions, expected, conditions, systems, sites, orgUnits, requests, auditControls, allSubmissions, onClose, onDone }) {
  const conditionRows = conditions.length ? conditions : DEFAULT_EVIDENCE_CONDITIONS.map((name) => ({ id: name, name, is_mandatory: true }));
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState({
    display_title: request?.title || '', description: '', evidence_type: expected?.evidence_type || request?.evidence_type || '', owner_id: (request?.assigned_owner_ids || [])[0] || '', responsible_department_id: request?.assigned_department_id || '', related_system_id: '', related_asset: '', related_site_id: audit?.site_id || '', evidence_date: '', effective_date: '', review_date: '', expiry_date: '', document_version: '', approving_authority: '', confidentiality_classification: 'confidential', change_description: '',
  });
  const [checklist, setChecklist] = useState(conditionRows.map((condition) => ({ condition_id: condition.id || condition.name, condition: condition.name, mandatory: condition.is_mandatory !== false, passed: null })));
  const [uploading, setUploading] = useState(false);
  const [showReuse, setShowReuse] = useState(false);
  const [reuseRequestIds, setReuseRequestIds] = useState([]);

  const currentControl = auditControls.find((control) => control.id === request.audit_control_id);
  const poorName = file && !isFileNameMeaningful(file.name);
  const suggestedName = `${suggestEvidenceName({ frameworkCode: audit.framework_code, controlNumber: currentControl?.control_number || request?.control_number, evidenceType: request?.evidence_type, system: systems.find((system) => system.id === metadata.related_system_id)?.code || systems.find((system) => system.id === metadata.related_system_id)?.name || '', date: new Date().toISOString().slice(0, 10) })}${file?.name?.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : ''}`;
  const candidateRequests = requests.filter((candidate) => {
    if (candidate.id === request.id) return false;
    const sameFramework = !request.framework_id || candidate.framework_id === request.framework_id;
    const typeMatch = candidate.evidence_type && request.evidence_type && candidate.evidence_type.toLowerCase() === request.evidence_type.toLowerCase();
    const titleMatch = candidate.title && request.title && (candidate.title.toLowerCase().includes(request.title.toLowerCase()) || request.title.toLowerCase().includes(candidate.title.toLowerCase()));
    return sameFramework && (typeMatch || titleMatch);
  });

  const updateMetadata = (key, value) => setMetadata((previous) => ({ ...previous, [key]: value }));
  const setChecklistValue = (index, passed) => setChecklist((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, passed } : item));
  const validate = () => {
    if (!file) return 'Select an evidence file.';
    if (!metadata.display_title || !isFileNameMeaningful(metadata.display_title)) return 'Enter a meaningful evidence title or accept the suggested name.';
    if (file.size > 25 * 1024 * 1024) return 'The file exceeds the 25 MB upload limit.';
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const accepted = (expected?.accepted_formats || []).map((format) => format.toLowerCase().replace('.', ''));
    if (accepted.length && !accepted.includes(extension)) return `Accepted formats: ${accepted.join(', ')}.`;
    if (checklist.some((item) => item.passed === null)) return 'Complete every evidence-condition self-check with Yes or No.';
    if (!metadata.evidence_date) return 'Evidence date is required.';
    if (expected?.requires_formal_approval && !metadata.approving_authority) return 'The expected evidence requires a visible approving authority.';
    return '';
  };

  const createReuseMapping = async ({ submission, targetRequest, mappingType = 'reuse' }) => {
    const mapping = await base44.entities.EvidenceMapping.create({
      master_evidence_id: submission.master_evidence_id, evidence_submission_id: submission.id, evidence_request_id: targetRequest.id,
      audit_control_id: targetRequest.audit_control_id, control_id: targetRequest.control_id, mapping_type: mappingType,
      review_status: 'pending', created_at: new Date().toISOString(),
    });
    const receivedAt = new Date().toISOString();
    await base44.entities.EvidenceRequest.update(targetRequest.id, {
      status: 'Received', review_status: 'awaiting_review', submission_date: receivedAt.slice(0, 10), received_date: receivedAt,
      status_history: [...(targetRequest.status_history || []), { status: 'Received', changed_by: 'auditee', changed_at: receivedAt, comment: mappingType === 'reuse' ? `Master evidence ${submission.master_evidence_id} reused` : 'Evidence submitted' }],
    });
    return mapping;
  };

  const reuseDuplicate = async (duplicate) => {
    const mapping = await createReuseMapping({ submission: duplicate, targetRequest: request, mappingType: 'reuse' });
    await base44.entities.EvidenceSubmission.update(duplicate.id, {
      linked_audit_control_ids: Array.from(new Set([...(duplicate.linked_audit_control_ids || []), request.audit_control_id])),
      linked_evidence_request_ids: Array.from(new Set([...(duplicate.linked_evidence_request_ids || []), request.id])),
    });
    await logAudit({ action: 'evidence_reuse', recordType: 'EvidenceMapping', recordId: mapping.id, recordName: duplicate.display_title, comment: `Identical file reused for ${request.title}`, newValue: mapping });
    onDone(); onClose();
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) return alert(validationError);
    setUploading(true);
    try {
      const hash = await sha256File(file);
      const duplicate = allSubmissions.find((submission) => submission.file_hash && submission.file_hash === hash && submission.approval_status !== 'rejected');
      if (duplicate && window.confirm(`An identical file already exists as “${duplicate.display_title}”. Reuse the existing master evidence instead of uploading a duplicate?`)) {
        await reuseDuplicate(duplicate);
        return;
      }
      const { file_url: fileUrl } = await base44.integrations.Core.UploadFile({ file });
      const masterId = submissions[0]?.master_evidence_id || `EV-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
      const newVersion = Math.max(0, ...submissions.map((submission) => Number(submission.version) || 0)) + 1;
      const approvedActiveExists = submissions.some((submission) => submission.is_active_version && submission.approval_status === 'approved');
      if (!approvedActiveExists) {
        for (const previous of submissions.filter((submission) => submission.is_active_version)) await base44.entities.EvidenceSubmission.update(previous.id, { is_active_version: false, validity_status: 'Superseded', superseded_date: new Date().toISOString() });
      }
      const receivedAt = new Date().toISOString();
      const mandatoryPassed = checklist.filter((item) => item.mandatory).every((item) => item.passed === true);
      const targetRequests = reuseRequestIds.map((requestId) => requests.find((candidate) => candidate.id === requestId)).filter(Boolean);
      const submission = await base44.entities.EvidenceSubmission.create({
        evidence_request_id: request.id, master_evidence_id: masterId, display_title: metadata.display_title, description: metadata.description,
        evidence_type: metadata.evidence_type, original_file_name: file.name, file_url: fileUrl, file_type: file.name.split('.').pop()?.toLowerCase() || '', file_size: file.size, file_hash: hash,
        version: newVersion, is_active_version: !approvedActiveExists, upload_date: receivedAt, received_date: receivedAt,
        effective_date: metadata.effective_date, review_date: metadata.review_date, expiry_date: metadata.expiry_date, evidence_date: metadata.evidence_date,
        document_version: metadata.document_version, approving_authority: metadata.approving_authority, change_description: metadata.change_description,
        approval_status: 'pending', review_status: 'awaiting_review', validity_status: 'Under Review', malware_scan_status: 'pending',
        confidentiality_classification: metadata.confidentiality_classification, owner_id: metadata.owner_id,
        responsible_department_id: metadata.responsible_department_id, related_system_id: metadata.related_system_id, related_asset: metadata.related_asset, related_site_id: metadata.related_site_id,
        linked_audit_control_ids: [request.audit_control_id, ...targetRequests.map((target) => target.audit_control_id)],
        linked_evidence_request_ids: [request.id, ...targetRequests.map((target) => target.id)], checklist_completed: true, checklist_results: checklist,
      });
      const primaryMapping = await createReuseMapping({ submission, targetRequest: request, mappingType: 'primary' });
      for (const targetRequest of targetRequests) await createReuseMapping({ submission, targetRequest, mappingType: 'reuse' });
      const requestStatus = mandatoryPassed ? 'Received' : 'Partially Received';
      await base44.entities.EvidenceRequest.update(request.id, {
        status: requestStatus, review_status: 'awaiting_review', submission_date: receivedAt.slice(0, 10), received_date: receivedAt,
        status_history: [...(request.status_history || []), { status: requestStatus, changed_by: 'auditee', changed_at: receivedAt, comment: mandatoryPassed ? 'Complete evidence submitted' : 'Evidence submitted with mandatory checklist gaps' }],
      });
      await logAudit({ action: 'evidence_uploaded', recordType: 'EvidenceSubmission', recordId: submission.id, recordName: metadata.display_title, newValue: submission });
      await logAudit({ action: 'evidence_mapping', recordType: 'EvidenceMapping', recordId: primaryMapping.id, recordName: metadata.display_title, comment: `Mapped to ${1 + targetRequests.length} evidence request(s)`, newValue: primaryMapping });
      onDone(); onClose();
    } catch (error) { alert(`Upload failed: ${error.message}`); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><div><h2 className="font-semibold text-slate-900">Submit Evidence</h2><p className="text-xs text-slate-500">Review requirements, complete metadata and self-check conditions, then submit.</p></div><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900"><div className="font-semibold">{expected?.name || request.title}</div><div>{expected?.description || request.description || 'No additional description.'}</div><div className="mt-1">Accepted formats: {(expected?.accepted_formats || []).join(', ') || 'Configured organization formats'} · Validity: {expected?.validity_period_days ? `${expected.validity_period_days} days` : 'Not specified'} · Formal approval: {expected?.requires_formal_approval ? 'Required' : 'Not required'} · Reuse: {expected?.allow_reuse === false ? 'Restricted' : 'Allowed'}</div>{expected?.example && <div className="mt-1"><strong>Example:</strong> {expected.example}</div>}</div>
        <div className="grid md:grid-cols-2 gap-3">
          <FieldInput label="Evidence title *" value={metadata.display_title} onChange={(value) => updateMetadata('display_title', value)} placeholder={suggestedName} />
          <FieldInput label="Evidence type" value={metadata.evidence_type} onChange={(value) => updateMetadata('evidence_type', value)} />
        </div>
        <label className="block text-xs font-medium text-slate-600">Description<textarea value={metadata.description} onChange={(event) => updateMetadata('description', event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-16" /></label>
        <label className="block text-xs font-medium text-slate-600">File *<input type="file" accept={(expected?.accepted_formats || []).map((format) => `.${format.replace('.', '')}`).join(',')} onChange={(event) => setFile(event.target.files?.[0] || null)} className="w-full mt-1 text-sm" /></label>
        {poorName && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" /><div className="text-xs text-amber-800">The local filename <code>{file.name}</code> is not meaningful. The file is not blocked when a meaningful display title is supplied. <button onClick={() => updateMetadata('display_title', suggestedName)} className="underline font-semibold">Use suggested title</button></div></div>}
        <div className="grid md:grid-cols-3 gap-3"><FieldInput type="date" label="Evidence date *" value={metadata.evidence_date} onChange={(value) => updateMetadata('evidence_date', value)} /><FieldInput type="date" label="Effective date" value={metadata.effective_date} onChange={(value) => updateMetadata('effective_date', value)} /><FieldInput type="date" label="Review date" value={metadata.review_date} onChange={(value) => updateMetadata('review_date', value)} /><FieldInput type="date" label="Expiry date" value={metadata.expiry_date} onChange={(value) => updateMetadata('expiry_date', value)} /><FieldInput label="Document version" value={metadata.document_version} onChange={(value) => updateMetadata('document_version', value)} /><FieldInput label="Approving authority" value={metadata.approving_authority} onChange={(value) => updateMetadata('approving_authority', value)} /></div>
        <div className="grid md:grid-cols-3 gap-3"><SelectInput label="Evidence owner" value={metadata.owner_id} onChange={(value) => updateMetadata('owner_id', value)} options={owners.filter((owner) => owner.active).map((owner) => ({ value: owner.id, label: owner.full_name }))} /><SelectInput label="Responsible department" value={metadata.responsible_department_id} onChange={(value) => updateMetadata('responsible_department_id', value)} options={orgUnits.filter((unit) => unit.type === 'department').map((unit) => ({ value: unit.id, label: unit.name }))} /><SelectInput label="System" value={metadata.related_system_id} onChange={(value) => updateMetadata('related_system_id', value)} options={systems.map((system) => ({ value: system.id, label: system.name }))} /><SelectInput label="Site" value={metadata.related_site_id} onChange={(value) => updateMetadata('related_site_id', value)} options={sites.map((site) => ({ value: site.id, label: site.name }))} /><FieldInput label="Related asset" value={metadata.related_asset} onChange={(value) => updateMetadata('related_asset', value)} /><SelectInput label="Confidentiality" value={metadata.confidentiality_classification} onChange={(value) => updateMetadata('confidentiality_classification', value)} options={['public','internal','confidential','restricted'].map((value) => ({ value, label: value }))} /></div>
        {submissions.length > 0 && <FieldInput label="Change description for new version" value={metadata.change_description} onChange={(value) => updateMetadata('change_description', value)} />}
        <div><div className="text-xs font-medium text-slate-600 mb-2">Evidence-condition self-checklist *</div><div className="space-y-2 border rounded-lg p-3 max-h-56 overflow-y-auto">{checklist.map((item, index) => <div key={item.condition_id} className="flex items-center gap-3 text-xs"><span className="flex-1">{item.condition} {item.mandatory ? <strong className="text-red-500">*</strong> : <span className="text-slate-400">(optional)</span>}</span><label className="flex gap-1"><input type="radio" name={`condition-${index}`} checked={item.passed === true} onChange={() => setChecklistValue(index, true)} />Yes</label><label className="flex gap-1"><input type="radio" name={`condition-${index}`} checked={item.passed === false} onChange={() => setChecklistValue(index, false)} />No</label></div>)}</div><p className="text-[10px] text-slate-400 mt-1">This self-check does not replace auditor review. Mandatory “No” responses create a Partially Received request.</p></div>
        {submissions.length > 0 && <div className="bg-slate-50 rounded-lg p-3 text-xs"><div className="font-semibold flex gap-1"><History className="w-3.5 h-3.5" />Version history</div>{submissions.map((submission) => <div key={submission.id} className="flex justify-between py-1"><span>v{submission.version} — {submission.display_title}</span><span>{submission.is_active_version ? 'active approved/current' : submission.validity_status || 'archived'}</span></div>)}<p className="text-[10px] text-slate-400">A pending replacement does not supersede the active approved version until the auditor accepts it.</p></div>}
        {expected?.allow_reuse !== false && <div><button onClick={() => setShowReuse((value) => !value)} className="text-xs flex items-center gap-1 text-blue-700"><Link2 className="w-3.5 h-3.5" />Add this evidence to other controls</button>{showReuse && <div className="mt-2 border rounded-lg p-3 space-y-2"><p className="text-xs text-slate-500">Suggested matches use common framework and matching evidence type/name. Each mapping receives an independent review decision.</p>{candidateRequests.length ? candidateRequests.map((candidate) => <label key={candidate.id} className="flex gap-2 text-xs"><input type="checkbox" checked={reuseRequestIds.includes(candidate.id)} onChange={(event) => setReuseRequestIds((previous) => event.target.checked ? [...previous, candidate.id] : previous.filter((id) => id !== candidate.id))} /><span>{auditControls.find((control) => control.id === candidate.audit_control_id)?.control_number} — {candidate.title}</span></label>) : <div className="text-xs text-slate-400">No compatible requests identified.</div>}</div>}</div>}
      </div>
      <div className="px-6 py-4 border-t flex justify-end gap-2"><button onClick={onClose} className="text-sm px-4 py-2">Cancel</button><button onClick={submit} disabled={uploading} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">{uploading ? 'Uploading…' : 'Submit Evidence'}</button></div>
    </div></div>
  );
}

function EvidenceReviewModal({ request, audit, submission, mappings, requests, auditControls, submissions, expectedEvidence, conditions, onClose, onDone, owners }) {
  const [comments, setComments] = useState(submission?.review_comments || '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submissionMappings = mappings.filter((mapping) => mapping.evidence_submission_id === submission?.id);
  const [approvedReuseMappingIds, setApprovedReuseMappingIds] = useState(submissionMappings.filter((mapping) => mapping.mapping_type === 'primary').map((mapping) => mapping.id));
  const actions = [
    { value: 'accepted', label: 'Accept evidence', icon: CheckCircle2, color: 'text-emerald-600' },
    { value: 'accepted_with_observation', label: 'Accept with observation', icon: CheckCircle2, color: 'text-teal-600', requireComment: true },
    { value: 'rejected', label: 'Reject evidence', icon: FileX, color: 'text-red-600', requireReason: true },
    { value: 'clarification_requested', label: 'Request clarification', icon: MessageSquare, color: 'text-purple-600', requireReason: true },
    { value: 'further_comments_requested', label: 'Request further comments', icon: MessageSquare, color: 'text-purple-600', requireReason: true },
    { value: 'corrected_file_requested', label: 'Request corrected file', icon: RefreshCw, color: 'text-amber-600', requireReason: true },
    { value: 'updated_evidence_requested', label: 'Request updated evidence', icon: RefreshCw, color: 'text-amber-600', requireReason: true },
    { value: 'formal_approval_requested', label: 'Request formal approval', icon: ShieldCheck, color: 'text-blue-600', requireReason: true },
    { value: 'partially_sufficient', label: 'Mark partially sufficient', icon: AlertTriangle, color: 'text-orange-600', requireReason: true },
  ];

  const notifyOwners = async (actionLabel) => {
    for (const ownerId of request.assigned_owner_ids || []) {
      const owner = owners.find((record) => record.id === ownerId);
      await dispatchNotification({ recipientId: ownerId, recipientEmail: owner?.work_email, type: actionLabel.startsWith('Accept') ? 'approval' : 'revision_request', title: `${actionLabel}: ${submission.display_title}`, body: comments || reason || 'Evidence review action taken.', relatedRecordType: 'EvidenceRequest', relatedRecordId: request.id, link: `/audits/${audit.id}`, deliveryMode: request.notification_method || 'immediate' });
    }
  };

  const saveDecision = async (action, closeAfter = false) => {
    const actionDefinition = actions.find((item) => item.value === action);
    if (actionDefinition.requireReason && !reason.trim()) return alert('A reason is required when evidence is rejected or returned for revision.');
    if (actionDefinition.requireComment && !comments.trim()) return alert('An observation comment is required.');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const accepted = ['accepted', 'accepted_with_observation'].includes(action);
      if (accepted) {
        for (const previous of submissions.filter((item) => item.master_evidence_id === submission.master_evidence_id && item.id !== submission.id && item.is_active_version)) await base44.entities.EvidenceSubmission.update(previous.id, { is_active_version: false, validity_status: 'Superseded', superseded_date: now });
      }
      await base44.entities.EvidenceSubmission.update(submission.id, {
        review_status: action, review_comments: comments, rejection_reason: reason, reviewed_by_id: '',
        approval_status: accepted ? 'approved' : action === 'rejected' ? 'rejected' : 'pending',
        is_active_version: accepted ? true : submission.is_active_version,
        acceptance_date: accepted ? now : '', rejection_date: action === 'rejected' ? now : '',
        validity_status: accepted ? validityFromExpiry(submission.expiry_date) : action === 'rejected' ? 'Under Review' : submission.validity_status,
        review_history: [...(submission.review_history || []), { action, comments, reason, reviewed_at: now }],
      });
      const targetMappingIds = accepted ? approvedReuseMappingIds : submissionMappings.filter((mapping) => mapping.evidence_request_id === request.id).map((mapping) => mapping.id);
      for (const mapping of submissionMappings) {
        if (!targetMappingIds.includes(mapping.id)) continue;
        await base44.entities.EvidenceMapping.update(mapping.id, { review_status: accepted ? action : action === 'partially_sufficient' ? 'partially_sufficient' : action === 'rejected' ? 'rejected' : 'pending', review_comments: comments || reason, reviewed_at: now });
        const targetRequest = requests.find((candidate) => candidate.id === mapping.evidence_request_id);
        if (targetRequest) await base44.entities.EvidenceRequest.update(targetRequest.id, { review_status: action, review_comments: comments, rejection_reason: reason, status: accepted ? targetRequest.status : action === 'partially_sufficient' ? 'Partially Received' : 'Require Further Comments', acceptance_date: accepted ? now : '', rejection_date: action === 'rejected' ? now : '' });
      }
      await logAudit({ action: 'evidence_reviewed', recordType: 'EvidenceSubmission', recordId: submission.id, recordName: submission.display_title, previousValue: submission.review_status, newValue: action, comment: comments, reason });
      await notifyOwners(actionDefinition.label);
      if (closeAfter && accepted) await closeEligibleControls(targetMappingIds);
      else { onDone(); onClose(); }
    } catch (error) { alert(`Failed: ${error.message}`); }
    finally { setSaving(false); }
  };

  const controlEligibility = async (auditControlId) => {
    const controlRequests = requests.filter((candidate) => candidate.audit_control_id === auditControlId);
    if (!controlRequests.length) return { eligible: false, reason: 'No evidence requests' };
    const findingRecords = await base44.entities.Finding.filter({ audit_control_id: auditControlId });
    if (findingRecords.some((finding) => !['verified_closed', 'accepted'].includes(finding.status))) return { eligible: false, reason: 'Open finding' };
    for (const controlRequest of controlRequests) {
      if (controlRequest.status === 'Not Applicable') continue;
      const expectedItem = expectedEvidence.find((item) => item.id === controlRequest.expected_evidence_id);
      if (expectedItem && expectedItem.is_mandatory === false) continue;
      if (!['accepted', 'accepted_with_observation'].includes(controlRequest.review_status)) return { eligible: false, reason: `Unaccepted evidence: ${controlRequest.title}` };
      const acceptedSubmission = submissions.filter((item) => item.evidence_request_id === controlRequest.id || (item.linked_evidence_request_ids || []).includes(controlRequest.id)).find((item) => ['accepted', 'accepted_with_observation'].includes(item.review_status));
      if (!acceptedSubmission) return { eligible: false, reason: `No accepted file: ${controlRequest.title}` };
      if (acceptedSubmission.expiry_date && new Date(`${acceptedSubmission.expiry_date}T23:59:59`) < new Date()) return { eligible: false, reason: `Expired evidence: ${controlRequest.title}` };
      if (expectedItem?.requires_formal_approval && acceptedSubmission.approval_status !== 'approved') return { eligible: false, reason: `Approval missing: ${controlRequest.title}` };
      const mandatoryConditions = conditions.filter((condition) => condition.expected_evidence_id === controlRequest.expected_evidence_id && condition.is_mandatory !== false && condition.active !== false);
      const results = acceptedSubmission.checklist_results || [];
      if (mandatoryConditions.some((condition) => !results.find((result) => (result.condition_id === condition.id || result.condition === condition.name) && result.passed === true))) return { eligible: false, reason: `Mandatory condition failed: ${controlRequest.title}` };
    }
    return { eligible: true };
  };

  const closeEligibleControls = async (mappingIds = approvedReuseMappingIds) => {
    const selectedMappings = submissionMappings.filter((mapping) => mappingIds.includes(mapping.id));
    const candidateIds = Array.from(new Set([request.audit_control_id, ...selectedMappings.map((mapping) => mapping.audit_control_id)]));
    const closed = [];
    const open = [];
    for (const auditControlId of candidateIds) {
      const result = await controlEligibility(auditControlId);
      const control = auditControls.find((item) => item.id === auditControlId);
      if (result.eligible) {
        await base44.entities.AuditControl.update(auditControlId, { is_closed: true, closure_date: new Date().toISOString().slice(0, 10), compliance_status: 'Implemented' });
        await logAudit({ action: 'control_closure', recordType: 'AuditControl', recordId: auditControlId, recordName: control?.control_title || 'Control', comment: 'Closed after all mandatory evidence, conditions, validity, approvals and findings were evaluated.' });
        closed.push(control?.control_number || auditControlId);
      } else open.push(`${control?.control_number || auditControlId}: ${result.reason}`);
    }
    alert(`Closed ${closed.length} eligible control(s).${open.length ? `\nKept open:\n${open.join('\n')}` : ''}`);
    onDone(); onClose();
  };

  const createFinding = async (withCorrectionPlan = false) => {
    const finding = await base44.entities.Finding.create({
      title: `Finding from ${request.title}`, description: comments || reason || 'Finding from evidence review.', source_audit_id: audit.id, source_type: 'Evidence Review', framework_id: audit.framework_id, control_id: request.control_id, audit_control_id: request.audit_control_id, evidence_request_id: request.id, severity: 'medium', risk_rating: 'medium', regulatory_impact: '', owner_id: (request.assigned_owner_ids || [])[0] || '', department_id: request.assigned_department_id || '', due_date: '', auditor_comments: comments || reason, status: 'open', status_history: [{ status: 'open', changed_at: new Date().toISOString() }],
    });
    await logAudit({ action: 'finding_created', recordType: 'Finding', recordId: finding.id, recordName: finding.title, comment: 'Created from evidence review' });
    if (withCorrectionPlan) {
      const plan = await base44.entities.CorrectionPlan.create({ corrective_action: `Correct evidence deficiency: ${request.title}`, finding_id: finding.id, audit_id: audit.id, control_id: request.control_id, primary_owner_id: finding.owner_id, supporting_owner_ids: (request.assigned_owner_ids || []).slice(1), priority: 'medium', risk: 'medium', completion_percentage: 0, required_closure_evidence: request.title, validation_comments: '', escalation_level: 0, closure_decision: 'pending', status: 'open' });
      await logAudit({ action: 'correction_plan_created', recordType: 'CorrectionPlan', recordId: plan.id, recordName: plan.corrective_action, comment: 'Created from evidence review finding' });
    }
    alert(withCorrectionPlan ? 'Finding and correction-plan item created.' : 'Finding created.'); onDone(); onClose();
  };

  if (!submission) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-2xl w-full max-h-[94vh] overflow-y-auto">
      <div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">Review Evidence</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm"><div className="font-medium">{submission.display_title}</div><div className="text-xs text-slate-500">Master {submission.master_evidence_id} · v{submission.version} · {submission.original_file_name} · {submission.confidentiality_classification}</div><Link to={`/evidence/${submission.id}`} className="text-xs text-blue-600 underline mt-1 inline-block">Secure application preview</Link></div>
        <div className="grid md:grid-cols-2 gap-3 text-xs"><div><strong>Validity:</strong> {submission.expiry_date || 'No expiry'}</div><div><strong>Approval authority:</strong> {submission.approving_authority || 'Not supplied'}</div><div><strong>System:</strong> {submission.related_system_id || '—'}</div><div><strong>Site:</strong> {submission.related_site_id || '—'}</div></div>
        <div className="border rounded-lg p-3"><div className="text-xs font-semibold mb-2">Auditee checklist</div>{(submission.checklist_results || []).map((result, index) => <div key={index} className="text-xs flex justify-between py-0.5"><span>{result.condition}</span><span className={result.passed ? 'text-emerald-700' : 'text-red-700'}>{result.passed ? 'Yes' : 'No'}</span></div>)}</div>
        {submissionMappings.length > 0 && <div className="border rounded-lg p-3"><div className="text-xs font-semibold">Independent control mappings</div><p className="text-[10px] text-slate-400 mb-2">Select reuse mappings to approve. Unselected controls remain pending/open.</p>{submissionMappings.map((mapping) => { const targetRequest = requests.find((candidate) => candidate.id === mapping.evidence_request_id); const targetControl = auditControls.find((control) => control.id === mapping.audit_control_id); return <label key={mapping.id} className="flex items-center gap-2 text-xs py-1"><input type="checkbox" disabled={mapping.mapping_type === 'primary'} checked={approvedReuseMappingIds.includes(mapping.id)} onChange={(event) => setApprovedReuseMappingIds((previous) => event.target.checked ? [...previous, mapping.id] : previous.filter((id) => id !== mapping.id))} /><span>{targetControl?.control_number} — {targetRequest?.title} <em className="text-slate-400">({mapping.mapping_type}; {mapping.review_status})</em></span></label>; })}</div>}
        <label className="block text-xs font-medium text-slate-600">Reviewer comments<textarea value={comments} onChange={(event) => setComments(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm h-20" /></label>
        <label className="block text-xs font-medium text-slate-600">Reason for rejection/return<input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></label>
        <div className="grid grid-cols-1 gap-2">{actions.map((action) => <button key={action.value} onClick={() => saveDecision(action.value)} disabled={saving} className="flex items-center gap-2 text-sm border px-3 py-2 rounded-lg hover:bg-slate-50 text-left"><action.icon className={`w-4 h-4 ${action.color}`} />{action.label}{(action.requireReason || action.requireComment) && <span className="ml-auto text-[10px] text-red-500">explanation required</span>}</button>)}</div>
        <div className="pt-3 border-t space-y-2"><button onClick={() => saveDecision('accepted', true)} disabled={saving} className="w-full flex justify-center gap-2 text-sm bg-emerald-600 text-white py-2 rounded-lg"><CheckCircle2 className="w-4 h-4" />Approve evidence and close all eligible controls</button><div className="grid md:grid-cols-2 gap-2"><button onClick={() => createFinding(false)} className="text-sm border border-red-200 text-red-700 py-2 rounded-lg">Create finding</button><button onClick={() => createFinding(true)} className="text-sm border border-amber-200 text-amber-700 py-2 rounded-lg">Create finding + correction plan</button></div></div>
      </div>
    </div></div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }) { return <label className="block text-xs font-medium text-slate-600">{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>; }
function SelectInput({ label, value, onChange, options }) { return <label className="block text-xs font-medium text-slate-600">{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">—</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
async function sha256File(file) { const buffer = await file.arrayBuffer(); const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer); return Array.from(new Uint8Array(hashBuffer)).map((value) => value.toString(16).padStart(2, '0')).join(''); }
function validityFromExpiry(expiryDate) { if (!expiryDate) return 'Valid'; const expiry = new Date(`${expiryDate}T23:59:59`); const now = new Date(); if (expiry < now) return 'Expired'; return (expiry.getTime() - now.getTime()) / 86400000 <= 30 ? 'Expiring Soon' : 'Valid'; }
