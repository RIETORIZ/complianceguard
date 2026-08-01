import { createClientFromRequest } from "npm:@base44/sdk";

const WORKFLOW_PROFILE = "Unified Compliance Workflow v1";
const ALLOWED_ROLES = new Set(["admin", "System Administrator", "Compliance Administrator"]);
const REVIEW_MAP: Record<string, string> = {
  awaiting_review: "Pending Review", pending: "Pending Review", accepted: "Accepted",
  accepted_with_observation: "Accepted with Observation", partially_sufficient: "Partially Sufficient",
  clarification_requested: "Revision Required", further_comments_requested: "Revision Required",
  corrected_file_requested: "Revision Required", updated_evidence_requested: "Revision Required",
  formal_approval_requested: "Revision Required", rejected: "Rejected", expired: "Expired", superseded: "Superseded",
};
const FINDING_MAP: Record<string, string> = {
  open: "Open", in_progress: "Under Remediation", remediated: "Pending Verification",
  verified_closed: "Closed", accepted: "Risk Accepted",
};
const PLAN_MAP: Record<string, string> = {
  open: "Open", in_progress: "In Progress", validated: "Verified", closed: "Closed", overdue: "Overdue",
};
const CLOSURE_MAP: Record<string, string> = {
  pending: "Pending", validated: "Verified", rejected: "Closure Evidence Rejected", closed: "Verified",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.has(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const admin = base44.asServiceRole;
    const changedAt = new Date().toISOString();
    const summary = { audits: 0, evidence_requests: 0, evidence_submissions: 0, evidence_mappings: 0, findings: 0, correction_plans: 0 };

    const [audits, requests, submissions, mappings, findings, plans] = await Promise.all([
      admin.entities.Audit.list("-updated_date", 10000),
      admin.entities.EvidenceRequest.list("-updated_date", 10000),
      admin.entities.EvidenceSubmission.list("-updated_date", 10000),
      admin.entities.EvidenceMapping.list("-updated_date", 10000),
      admin.entities.Finding.list("-updated_date", 10000),
      admin.entities.CorrectionPlan.list("-updated_date", 10000),
    ]);

    for (const audit of audits) {
      if (audit.workflow_profile === WORKFLOW_PROFILE && Number(audit.workflow_version) === 1) continue;
      await admin.entities.Audit.update(audit.id, { workflow_profile: WORKFLOW_PROFILE, workflow_version: 1 });
      await status(admin, "AuditWorkflow", audit.id, audit.workflow_profile || "Legacy", WORKFLOW_PROFILE, "Applied unified workflow profile", audit.id, "", user.id, changedAt);
      summary.audits += 1;
    }

    for (const request of requests) {
      const decision = canonicalReview(request.review_decision || request.review_status);
      if (request.review_decision === decision) continue;
      await admin.entities.EvidenceRequest.update(request.id, { review_decision: decision });
      await status(admin, "EvidenceRequestReview", request.id, request.review_decision || request.review_status || "", decision, "Canonicalized evidence review decision", request.audit_id, request.audit_control_id, user.id, changedAt);
      summary.evidence_requests += 1;
    }

    for (const submission of submissions) {
      const decision = canonicalReview(submission.review_decision || submission.review_status);
      if (submission.review_decision === decision) continue;
      await admin.entities.EvidenceSubmission.update(submission.id, { review_decision: decision });
      await status(admin, "EvidenceSubmission", submission.id, submission.review_decision || submission.review_status || "", decision, "Canonicalized evidence review decision", "", "", user.id, changedAt);
      summary.evidence_submissions += 1;
    }

    for (const mapping of mappings) {
      const decision = canonicalReview(mapping.review_decision || mapping.review_status);
      const mappingStatus = mappingStatusForDecision(decision);
      if (mapping.review_decision === decision && mapping.mapping_status === mappingStatus) continue;
      await admin.entities.EvidenceMapping.update(mapping.id, { review_decision: decision, mapping_status: mappingStatus });
      await status(admin, "EvidenceMapping", mapping.id, mapping.review_decision || mapping.review_status || "", decision, "Canonicalized mapping review decision", "", mapping.audit_control_id || "", user.id, changedAt);
      summary.evidence_mappings += 1;
    }

    for (const finding of findings) {
      const next = FINDING_MAP[finding.status] || finding.status || "Draft";
      if (finding.status === next) continue;
      await admin.entities.Finding.update(finding.id, { status: next, status_history: [...(finding.status_history || []), { previous_status: finding.status || "", status: next, changed_at: changedAt, comment: "Unified workflow migration" }] });
      await status(admin, "Finding", finding.id, finding.status || "", next, "Unified workflow migration", finding.source_audit_id || "", finding.audit_control_id || "", user.id, changedAt);
      summary.findings += 1;
    }

    for (const plan of plans) {
      const nextStatus = PLAN_MAP[plan.status] || plan.status || "Awaiting Owner Response";
      const nextDecision = CLOSURE_MAP[plan.closure_decision] || plan.closure_decision || "Pending";
      if (plan.status === nextStatus && plan.closure_decision === nextDecision) continue;
      await admin.entities.CorrectionPlan.update(plan.id, { status: nextStatus, closure_decision: nextDecision, status_history: [...(plan.status_history || []), { previous_status: plan.status || "", status: nextStatus, changed_at: changedAt, comment: "Unified workflow migration" }] });
      await status(admin, "CorrectionPlan", plan.id, plan.status || "", nextStatus, "Unified workflow migration", plan.audit_id || "", "", user.id, changedAt);
      summary.correction_plans += 1;
    }

    await admin.entities.AuditTrail.create({
      user_id: user.id,
      user_name: user.full_name || user.email || "Administrator",
      action: "unified_workflow_migration",
      record_type: "System",
      record_id: "unified-workflow-v1",
      record_name: WORKFLOW_PROFILE,
      new_value: JSON.stringify(summary),
      comment: "Existing audit records normalized without changing any control compliance decision.",
      timestamp: changedAt,
    });
    return Response.json({ success: true, workflow_profile: WORKFLOW_PROFILE, migrated_at: changedAt, summary });
  } catch (error) {
    console.error("migrate-unified-audit-workflow", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});

function mappingStatusForDecision(decision: string) {
  if (["Accepted", "Accepted with Observation"].includes(decision)) return "Active";
  if (["Partially Sufficient", "Revision Required"].includes(decision)) return "Revision Required";
  if (["Rejected", "Expired", "Superseded"].includes(decision)) return decision;
  return "Pending";
}

function canonicalReview(value: string) {
  return REVIEW_MAP[value] || value || "Pending Review";
}

async function status(admin: any, entityType: string, entityId: string, previousStatus: string, newStatus: string, reason: string, auditId: string, auditControlId: string, changedBy: string, changedAt: string) {
  await admin.entities.StatusHistory.create({ entity_type: entityType, entity_id: entityId, audit_id: auditId || "", audit_control_id: auditControlId || "", previous_status: previousStatus || "", new_status: newStatus, changed_by: changedBy, changed_at: changedAt, reason });
}
