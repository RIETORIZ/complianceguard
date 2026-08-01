import { base44 } from "@/api/base44Client";

// Status definitions for evidence request status (kept separate from compliance status)
export const EVIDENCE_STATUS_CONFIG = {
  "Requested": { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Requested" },
  "Received": { color: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Received" },
  "Partially Received": { color: "bg-amber-100 text-amber-800 border-amber-200", label: "Partially Received" },
  "Require Further Comments": { color: "bg-purple-100 text-purple-800 border-purple-200", label: "Require Further Comments" },
  "Not Applicable": { color: "bg-slate-100 text-slate-600 border-slate-200", label: "Not Applicable" },
  "Not Available": { color: "bg-rose-100 text-rose-800 border-rose-200", label: "Not Available" },
  "Overdue": { color: "bg-red-100 text-red-800 border-red-200", label: "Overdue" },
};

export const COMPLIANCE_STATUS_CONFIG = {
  "Under Evaluation": { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Under Evaluation" },
  "Implemented": { color: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Implemented" },
  "Partially Implemented": { color: "bg-amber-100 text-amber-800 border-amber-200", label: "Partially Implemented" },
  "Not Implemented": { color: "bg-red-100 text-red-800 border-red-200", label: "Not Implemented" },
  "Not Applicable": { color: "bg-slate-100 text-slate-500 border-slate-200", label: "Not Applicable" },
};

export const REVIEW_STATUS_CONFIG = {
  "Pending Review": { color: "bg-slate-100 text-slate-700", label: "Pending Review" },
  "Accepted": { color: "bg-emerald-100 text-emerald-800", label: "Accepted" },
  "Accepted with Observation": { color: "bg-teal-100 text-teal-800", label: "Accepted with Observation" },
  "Partially Sufficient": { color: "bg-orange-100 text-orange-800", label: "Partially Sufficient" },
  "Revision Required": { color: "bg-amber-100 text-amber-800", label: "Revision Required" },
  "Rejected": { color: "bg-red-100 text-red-800", label: "Rejected" },
  "Expired": { color: "bg-red-100 text-red-800", label: "Expired" },
  "Superseded": { color: "bg-slate-100 text-slate-500", label: "Superseded" },
  // Legacy aliases remain visible while existing records are migrated.
  "awaiting_review": { color: "bg-slate-100 text-slate-700", label: "Pending Review" },
  "accepted": { color: "bg-emerald-100 text-emerald-800", label: "Accepted" },
  "accepted_with_observation": { color: "bg-teal-100 text-teal-800", label: "Accepted with Observation" },
  "partially_sufficient": { color: "bg-orange-100 text-orange-800", label: "Partially Sufficient" },
  "rejected": { color: "bg-red-100 text-red-800", label: "Rejected" },
};

export const SEVERITY_CONFIG = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

// Default evidence conditions library (standard acceptance conditions)
export const DEFAULT_EVIDENCE_CONDITIONS = [
  "Meaningful file name",
  "Current and valid evidence",
  "Approved document",
  "Visible approval authority",
  "Visible version and approval date",
  "Full-screen screenshot",
  "Visible system name",
  "Visible date and time",
  "Correct organizational, system, or site scope",
  "Accepted file format",
  "Readable and uncorrupted file",
  "Sensitive information appropriately masked",
  "Required reporting period included",
  "Required configuration visible",
];

export { isFileNameMeaningful, suggestEvidenceName, computeOverdueStatus, computeEvidenceMetrics, computeComplianceMetrics, evidenceValidityStatus } from "./compliance-core";

// Immutable audit trail logging
export async function logAudit({ action, recordType, recordId = "", recordName = "", previousValue = null, newValue = null, comment = "", reason = "" }) {
  try {
    const me = await safeGetCurrentUser();
    await base44.entities.AuditTrail.create({
      user_id: me?.id || "system",
      user_name: me?.full_name || me?.email || "System",
      action,
      record_type: recordType,
      record_id: recordId,
      record_name: recordName,
      previous_value: previousValue ? JSON.stringify(previousValue) : "",
      new_value: newValue ? JSON.stringify(newValue) : "",
      comment: comment || "",
      reason: reason || "",
      timestamp: new Date().toISOString(),
      ip_address: "",
    });
  } catch (e) {
    // audit trail must never break the main flow
    console.error("Audit trail logging failed", e);
  }
}

// Canonical status transition record. This remains separate from the immutable audit log.
export async function recordStatusTransition({ entityType, entityId, previousStatus = "", newStatus, reason = "", auditId = "", auditControlId = "", changedAt = new Date().toISOString() }) {
  try {
    const me = await safeGetCurrentUser();
    await base44.entities.StatusHistory.create({
      entity_type: entityType,
      entity_id: entityId,
      audit_id: auditId || "",
      audit_control_id: auditControlId || "",
      previous_status: previousStatus || "",
      new_status: newStatus,
      changed_by: me?.id || "system",
      changed_at: changedAt,
      reason: reason || "",
    });
  } catch (e) {
    console.error("Status history logging failed", e);
  }
}

// Notification dispatch abstraction (dev adapter + in-app center)
export async function dispatchNotification({ recipientId, recipientEmail, type, title, body, relatedRecordType, relatedRecordId, link, deliveryMode = "immediate" }) {
  try {
    const modes = deliveryMode === "both" ? ["immediate", "end_of_day"] : deliveryMode === "none" ? ["in_app_only"] : [deliveryMode];
    for (const mode of modes) {
      const queued = mode === "end_of_day";
      await base44.entities.Notification.create({
        recipient_id: recipientId || "",
        recipient_email: recipientEmail || "",
        channel: "in_app",
        delivery_mode: queued ? "end_of_day" : "immediate",
        type,
        title,
        body,
        related_record_type: relatedRecordType || "",
        related_record_id: relatedRecordId || "",
        link: link || "",
        is_read: false,
        sent_at: queued ? "" : new Date().toISOString(),
        delivery_status: queued ? "queued" : "dev_logged",
      });
      if (recipientEmail && !queued && mode !== "in_app_only") console.log(`[DEV EMAIL immediate] To: ${recipientEmail} | ${title} | ${body}`);
    }
  } catch (e) {
    console.error("Notification dispatch failed", e);
  }
}

async function safeGetCurrentUser() {
  try {
    return await base44.auth.me();
  } catch {
    return null;
  }
}

