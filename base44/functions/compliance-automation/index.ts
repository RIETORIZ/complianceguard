import { createClientFromRequest } from "npm:@base44/sdk";

const CLOSED_REQUEST_STATES = new Set(["Received", "Partially Received", "Not Applicable", "Not Available", "Overdue"]);
const CLOSED_PLAN_STATES = new Set(["Closed", "Cancelled", "Risk Accepted", "Overdue", "closed", "validated", "overdue"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const summary = { evidence_requests_overdue: 0, evidence_expired: 0, evidence_expiring_soon: 0, controls_reopened_due_to_expired_evidence: 0, corrective_actions_overdue: 0 };

    const [requests, submissions, mappings, auditControls, audits, plans, owners] = await Promise.all([
      admin.entities.EvidenceRequest.list("-created_date", 2000),
      admin.entities.EvidenceSubmission.list("-created_date", 2000),
      admin.entities.EvidenceMapping.list("-created_date", 5000),
      admin.entities.AuditControl.list("-created_date", 5000),
      admin.entities.Audit.list("-created_date", 2000),
      admin.entities.CorrectionPlan.list("-created_date", 2000),
      admin.entities.Owner.list("full_name", 1000),
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const auditControlById = new Map(auditControls.map((control) => [control.id, control]));
    const auditById = new Map(audits.map((audit) => [audit.id, audit]));

    for (const request of requests) {
      if (!request.due_date || request.exclude_from_overdue || CLOSED_REQUEST_STATES.has(request.status)) continue;
      if (request.due_date >= today) continue;
      const changedAt = now.toISOString();
      await admin.entities.EvidenceRequest.update(request.id, {
        status: "Overdue",
        status_history: [...(request.status_history || []), { status: "Overdue", changed_by: "system", changed_at: changedAt, comment: "Due date passed without an excluded or received status." }],
      });
      await admin.entities.StatusHistory.create({ entity_type: "EvidenceRequest", entity_id: request.id, audit_id: request.audit_id || "", audit_control_id: request.audit_control_id || "", previous_status: request.status || "", new_status: "Overdue", changed_by: "system", changed_at: changedAt, reason: "Due date passed without an excluded or received status." });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "status_changed", record_type: "EvidenceRequest", record_id: request.id, record_name: request.title, previous_value: request.status, new_value: "Overdue", comment: "Automated overdue processing", timestamp: changedAt });
      for (const ownerId of request.assigned_owner_ids || []) {
        const owner = ownerById.get(ownerId);
        await admin.entities.Notification.create({ recipient_id: ownerId, recipient_email: owner?.work_email || "", channel: "in_app", delivery_mode: request.notification_method === "end_of_day" ? "end_of_day" : "immediate", type: "overdue", title: `Overdue evidence request: ${request.title}`, body: `The evidence request was due on ${request.due_date}.`, related_record_type: "EvidenceRequest", related_record_id: request.id, link: `/audits/${request.audit_id}`, is_read: false, sent_at: request.notification_method === "end_of_day" ? "" : changedAt, delivery_status: request.notification_method === "end_of_day" ? "queued" : "dev_logged" });
      }
      summary.evidence_requests_overdue += 1;
    }

    for (const submission of submissions) {
      if (!submission.expiry_date || submission.validity_status === "Superseded") continue;
      const expiry = new Date(`${submission.expiry_date}T23:59:59Z`);
      const days = (expiry.getTime() - now.getTime()) / 86400000;
      const nextStatus = days < 0 ? "Expired" : days <= 30 ? "Expiring Soon" : "Valid";
      if (nextStatus === submission.validity_status) continue;
      const changedAt = now.toISOString();
      const submissionUpdate: Record<string, unknown> = { validity_status: nextStatus };
      if (nextStatus === "Expired") {
        submissionUpdate.review_decision = "Expired";
        submissionUpdate.review_status = "updated_evidence_requested";
      }
      await admin.entities.EvidenceSubmission.update(submission.id, submissionUpdate);
      await admin.entities.StatusHistory.create({ entity_type: "EvidenceSubmissionValidity", entity_id: submission.id, audit_id: "", audit_control_id: "", previous_status: submission.validity_status || "", new_status: nextStatus, changed_by: "system", changed_at: changedAt, reason: `Evidence expiry date reached: ${submission.expiry_date}` });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "evidence_expiration", record_type: "EvidenceSubmission", record_id: submission.id, record_name: submission.display_title, previous_value: submission.validity_status || "", new_value: nextStatus, timestamp: changedAt });

      const submissionMappings = mappings.filter((mapping) => mapping.evidence_submission_id === submission.id);
      const linkedRequestIds = new Set([submission.evidence_request_id, ...(submission.linked_evidence_request_ids || []), ...submissionMappings.map((mapping) => mapping.evidence_request_id)].filter(Boolean));
      const linkedRequests = requests.filter((request) => linkedRequestIds.has(request.id));
      const recipients = new Set<string>();

      if (nextStatus === "Expired") {
        for (const mapping of submissionMappings) {
          const previousDecision = canonicalReview(mapping.review_decision || mapping.review_status);
          if (previousDecision !== "Expired") {
            await admin.entities.EvidenceMapping.update(mapping.id, { review_decision: "Expired", review_status: "updated_evidence_requested", mapping_status: "Expired" });
            await admin.entities.StatusHistory.create({ entity_type: "EvidenceMapping", entity_id: mapping.id, audit_id: "", audit_control_id: mapping.audit_control_id || "", previous_status: previousDecision, new_status: "Expired", changed_by: "system", changed_at: changedAt, reason: `Mapped evidence expired on ${submission.expiry_date}` });
          }
        }
      }

      const reopenedControlIds = new Set<string>();
      for (const linkedRequest of linkedRequests) {
        for (const ownerId of linkedRequest.assigned_owner_ids || []) recipients.add(ownerId);
        const hasCurrentAcceptedReplacement = nextStatus === "Expired" && submissions.some((candidate) => {
          if (candidate.id === submission.id) return false;
          const supportsRequest = candidate.evidence_request_id === linkedRequest.id
            || (candidate.linked_evidence_request_ids || []).includes(linkedRequest.id)
            || mappings.some((mapping) => mapping.evidence_submission_id === candidate.id && mapping.evidence_request_id === linkedRequest.id);
          return supportsRequest
            && isAcceptedDecision(candidate.review_decision || candidate.review_status)
            && !["Expired", "Superseded"].includes(candidate.validity_status);
        });

        if (nextStatus === "Expired" && !hasCurrentAcceptedReplacement) {
          const previousRequestDecision = canonicalReview(linkedRequest.review_decision || linkedRequest.review_status);
          await admin.entities.EvidenceRequest.update(linkedRequest.id, {
            status: "Requested",
            review_decision: "Expired",
            review_status: "updated_evidence_requested",
            status_history: [...(linkedRequest.status_history || []), { status: "Requested", changed_by: "system", changed_at: changedAt, comment: `Supporting evidence expired on ${submission.expiry_date}; replacement required.` }],
          });
          if (linkedRequest.status !== "Requested") await admin.entities.StatusHistory.create({ entity_type: "EvidenceRequest", entity_id: linkedRequest.id, audit_id: linkedRequest.audit_id || "", audit_control_id: linkedRequest.audit_control_id || "", previous_status: linkedRequest.status || "", new_status: "Requested", changed_by: "system", changed_at: changedAt, reason: `Supporting evidence expired on ${submission.expiry_date}; replacement required.` });
          if (previousRequestDecision !== "Expired") await admin.entities.StatusHistory.create({ entity_type: "EvidenceRequestReview", entity_id: linkedRequest.id, audit_id: linkedRequest.audit_id || "", audit_control_id: linkedRequest.audit_control_id || "", previous_status: previousRequestDecision, new_status: "Expired", changed_by: "system", changed_at: changedAt, reason: `Supporting evidence expired on ${submission.expiry_date}` });

          const control = auditControlById.get(linkedRequest.audit_control_id);
          if (control && !reopenedControlIds.has(control.id) && control.compliance_status !== "Not Applicable" && (control.compliance_status !== "Under Evaluation" || control.is_closed)) {
            reopenedControlIds.add(control.id);
            await admin.entities.AuditControl.update(control.id, { compliance_status: "Under Evaluation", is_closed: false, closure_date: "", evaluation_reason: `Evidence ${submission.display_title || submission.id} expired on ${submission.expiry_date}; replacement evidence and reassessment are required.`, evaluated_at: changedAt, evaluated_by_id: "system" });
            await admin.entities.StatusHistory.create({ entity_type: "AuditControl", entity_id: control.id, audit_id: control.audit_id || linkedRequest.audit_id || "", audit_control_id: control.id, previous_status: control.compliance_status || "", new_status: "Under Evaluation", changed_by: "system", changed_at: changedAt, reason: `Accepted evidence expired without a current accepted replacement.` });
            await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "control_reopened_expired_evidence", record_type: "AuditControl", record_id: control.id, record_name: control.control_title || control.control_number, previous_value: control.compliance_status || "", new_value: "Under Evaluation", comment: `Evidence ${submission.display_title || submission.id} expired.`, timestamp: changedAt });
            for (const ownerId of control.control_level_owners || []) recipients.add(ownerId);
            const audit = auditById.get(control.audit_id || linkedRequest.audit_id);
            if (audit?.lead_auditor_id) recipients.add(audit.lead_auditor_id);
            for (const ownerId of audit?.audit_level_owners || []) recipients.add(ownerId);
            summary.controls_reopened_due_to_expired_evidence += 1;
          }
        }
      }

      for (const ownerId of recipients) {
        const owner = ownerById.get(ownerId);
        await admin.entities.Notification.create({ recipient_id: ownerId, recipient_email: owner?.work_email || "", channel: "in_app", delivery_mode: "end_of_day", type: "evidence_expiration", title: `${nextStatus}: ${submission.display_title}`, body: nextStatus === "Expired" ? `Evidence expired on ${submission.expiry_date}. Unsupported linked requests were reopened and affected controls require reassessment.` : `Evidence expiry date: ${submission.expiry_date}.`, related_record_type: "EvidenceSubmission", related_record_id: submission.id, link: `/evidence/${submission.id}`, is_read: false, delivery_status: "queued" });
      }
      if (nextStatus === "Expired") summary.evidence_expired += 1;
      if (nextStatus === "Expiring Soon") summary.evidence_expiring_soon += 1;
    }

    for (const plan of plans) {
      if (!plan.target_date || CLOSED_PLAN_STATES.has(plan.status) || plan.target_date >= today) continue;
      await admin.entities.CorrectionPlan.update(plan.id, { status: "Overdue", status_history: [...(plan.status_history || []), { previous_status: plan.status, status: "Overdue", changed_at: now.toISOString(), comment: "Target date passed before closure." }], escalation_level: Math.max(1, Number(plan.escalation_level) || 0) });
      await admin.entities.StatusHistory.create({ entity_type: "CorrectionPlan", entity_id: plan.id, audit_id: plan.audit_id || "", audit_control_id: "", previous_status: plan.status || "", new_status: "Overdue", changed_by: "system", changed_at: now.toISOString(), reason: "Target date passed before closure." });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "correction_plan_overdue", record_type: "CorrectionPlan", record_id: plan.id, record_name: plan.corrective_action, previous_value: plan.status, new_value: "Overdue", timestamp: now.toISOString() });
      const owner = ownerById.get(plan.primary_owner_id);
      await admin.entities.Notification.create({ recipient_id: plan.primary_owner_id || "", recipient_email: owner?.work_email || "", channel: "in_app", delivery_mode: "immediate", type: "overdue_corrective_action", title: `Overdue corrective action: ${plan.corrective_action}`, body: `Target date was ${plan.target_date}. Escalation level is now ${Math.max(1, Number(plan.escalation_level) || 0)}.`, related_record_type: "CorrectionPlan", related_record_id: plan.id, link: "/correction-plans", is_read: false, sent_at: now.toISOString(), delivery_status: "dev_logged" });
      summary.corrective_actions_overdue += 1;
    }

    return Response.json({ success: true, processed_at: now.toISOString(), summary });
  } catch (error) {
    console.error("compliance-automation", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});


function canonicalReview(value: string) {
  const legacy: Record<string, string> = { awaiting_review: "Pending Review", accepted: "Accepted", accepted_with_observation: "Accepted with Observation", partially_sufficient: "Partially Sufficient", clarification_requested: "Revision Required", further_comments_requested: "Revision Required", corrected_file_requested: "Revision Required", updated_evidence_requested: "Revision Required", formal_approval_requested: "Revision Required", rejected: "Rejected", expired: "Expired", superseded: "Superseded" };
  return legacy[value] || value || "Pending Review";
}

function isAcceptedDecision(value: string) {
  return ["Accepted", "Accepted with Observation"].includes(canonicalReview(value));
}
