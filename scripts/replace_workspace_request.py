from pathlib import Path
p = Path('src/pages/AuditWorkspace.jsx')
text = p.read_text()
start = text.index('function ControlDetail(')
end = text.index('function AddControlModal(')
new = r'''function ControlDetail({ audit, auditControl, requests, owners, ownerName, submissionsFor, expectedEvidence, conditions, orgUnits, groups, canManageAudit, canSubmitEvidence, canReviewEvidence, onEvidenceSubmit, onShowReview, onShowEvidence, onUpdateCompliance }) {
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

'''
p.write_text(text[:start] + new + text[end:])
