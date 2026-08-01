import { createClientFromRequest } from "npm:@base44/sdk";

const CLOSED_REQUEST_STATES = new Set(["Received", "Partially Received", "Not Applicable", "Not Available", "Overdue"]);
const CLOSED_PLAN_STATES = new Set(["closed", "validated", "overdue"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const summary = { evidence_requests_overdue: 0, evidence_expired: 0, evidence_expiring_soon: 0, corrective_actions_overdue: 0 };

    const [requests, submissions, plans, owners] = await Promise.all([
      admin.entities.EvidenceRequest.list("-created_date", 2000),
      admin.entities.EvidenceSubmission.list("-created_date", 2000),
      admin.entities.CorrectionPlan.list("-created_date", 2000),
      admin.entities.Owner.list("full_name", 1000),
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

    for (const request of requests) {
      if (!request.due_date || request.exclude_from_overdue || CLOSED_REQUEST_STATES.has(request.status)) continue;
      if (request.due_date >= today) continue;
      const changedAt = now.toISOString();
      await admin.entities.EvidenceRequest.update(request.id, {
        status: "Overdue",
        status_history: [...(request.status_history || []), { status: "Overdue", changed_by: "system", changed_at: changedAt, comment: "Due date passed without an excluded or received status." }],
      });
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
      await admin.entities.EvidenceSubmission.update(submission.id, { validity_status: nextStatus });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "evidence_expiration", record_type: "EvidenceSubmission", record_id: submission.id, record_name: submission.display_title, previous_value: submission.validity_status || "", new_value: nextStatus, timestamp: now.toISOString() });
      const linkedRequests = requests.filter((request) => request.id === submission.evidence_request_id || (submission.linked_evidence_request_ids || []).includes(request.id));
      for (const linkedRequest of linkedRequests) {
        for (const ownerId of linkedRequest.assigned_owner_ids || []) {
          const owner = ownerById.get(ownerId);
          await admin.entities.Notification.create({ recipient_id: ownerId, recipient_email: owner?.work_email || "", channel: "in_app", delivery_mode: "end_of_day", type: "evidence_expiration", title: `${nextStatus}: ${submission.display_title}`, body: `Evidence expiry date: ${submission.expiry_date}. Affected request: ${linkedRequest.title}.`, related_record_type: "EvidenceSubmission", related_record_id: submission.id, link: `/evidence/${submission.id}`, is_read: false, delivery_status: "queued" });
        }
      }
      if (nextStatus === "Expired") summary.evidence_expired += 1;
      if (nextStatus === "Expiring Soon") summary.evidence_expiring_soon += 1;
    }

    for (const plan of plans) {
      if (!plan.target_date || CLOSED_PLAN_STATES.has(plan.status) || plan.target_date >= today) continue;
      await admin.entities.CorrectionPlan.update(plan.id, { status: "overdue", escalation_level: Math.max(1, Number(plan.escalation_level) || 0) });
      await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "correction_plan_overdue", record_type: "CorrectionPlan", record_id: plan.id, record_name: plan.corrective_action, previous_value: plan.status, new_value: "overdue", timestamp: now.toISOString() });
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
