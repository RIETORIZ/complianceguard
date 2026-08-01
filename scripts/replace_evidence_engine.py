from pathlib import Path
p = Path('src/pages/AuditWorkspace.jsx')
text = p.read_text()
start = text.index('export function EvidenceUploadModal(')
new = r'''export function EvidenceUploadModal({ request, audit, owners, submissions, expected, conditions, systems, sites, orgUnits, requests, auditControls, allSubmissions, onClose, onDone }) {
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
function validityFromExpiry(expiryDate) { if (!expiryDate) return 'Valid'; const expiry = new Date(`${expiryDate}T23:59:59`); if (expiry < new Date()) return 'Expired'; return (expiry - new Date()) / 86400000 <= 30 ? 'Expiring Soon' : 'Valid'; }
'''
p.write_text(text[:start] + new)
