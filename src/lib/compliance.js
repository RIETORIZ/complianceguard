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
  "awaiting_review": { color: "bg-slate-100 text-slate-700", label: "Awaiting Review" },
  "accepted": { color: "bg-emerald-100 text-emerald-800", label: "Accepted" },
  "accepted_with_observation": { color: "bg-teal-100 text-teal-800", label: "Accepted w/ Observation" },
  "rejected": { color: "bg-red-100 text-red-800", label: "Rejected" },
  "clarification_requested": { color: "bg-purple-100 text-purple-800", label: "Clarification Requested" },
  "further_comments_requested": { color: "bg-purple-100 text-purple-800", label: "Further Comments Requested" },
  "corrected_file_requested": { color: "bg-amber-100 text-amber-800", label: "Corrected File Requested" },
  "updated_evidence_requested": { color: "bg-amber-100 text-amber-800", label: "Updated Evidence Requested" },
  "formal_approval_requested": { color: "bg-blue-100 text-blue-800", label: "Formal Approval Requested" },
  "partially_sufficient": { color: "bg-orange-100 text-orange-800", label: "Partially Sufficient" },
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

// Detect non-meaningful file names (random gibberish)
export function isFileNameMeaningful(fileName) {
  if (!fileName) return false;
  const base = fileName.replace(/\.[^/.]+$/, "");
  // too short or too long random
  if (base.length < 5) return false;
  // low vowel ratio + high randomness heuristic
  const vowels = (base.match(/[aeiouAEIOU]/g) || []).length;
  const vowelRatio = vowels / base.length;
  // counts consecutive consonant clusters > 4 as suspicious
  const hasLongConsonantCluster = /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(base);
  // no spaces, low vowels, looks like random keysmash
  if (base.length >= 15 && vowelRatio < 0.15 && hasLongConsonantCluster) return false;
  if (hasLongConsonantCluster && vowelRatio < 0.2 && !base.includes(" ") && !base.includes("_") && !base.includes("-")) return false;
  return true;
}

// Suggest a meaningful name from components
export function suggestEvidenceName({ frameworkCode, controlNumber, evidenceType, system, date }) {
  const parts = [];
  if (frameworkCode) parts.push(frameworkCode);
  if (controlNumber) parts.push(controlNumber.replace(/[^a-zA-Z0-9-]/g, "-"));
  if (evidenceType) parts.push(evidenceType.replace(/[^a-zA-Z0-9]/g, "_"));
  if (system) parts.push(system.replace(/[^a-zA-Z0-9]/g, "_"));
  const dt = date || new Date().toISOString().slice(0, 4);
  parts.push(dt);
  return parts.join("_");
}

// Compute overdue status for an evidence request without mutating DB
export function computeOverdueStatus(req) {
  const closedStates = ["Received", "Not Applicable", "Not Available"];
  if (req.exclude_from_overdue || closedStates.includes(req.status)) return req.status;
  if (req.due_date) {
    const due = new Date(req.due_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (due < now && !["Received", "Partially Received"].includes(req.status)) {
      return "Overdue";
    }
  }
  return req.status;
}

// Immutable audit trail logging
export async function logAudit({ action, recordType, recordId, recordName, previousValue, newValue, comment, reason }) {
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

// Notification dispatch abstraction (dev adapter + in-app center)
export async function dispatchNotification({ recipientId, recipientEmail, type, title, body, relatedRecordType, relatedRecordId, link, deliveryMode = "immediate" }) {
  try {
    // In-app notification always created
    await base44.entities.Notification.create({
      recipient_id: recipientId || "",
      recipient_email: recipientEmail || "",
      channel: "in_app",
      delivery_mode: deliveryMode,
      type,
      title,
      body,
      related_record_type: relatedRecordType || "",
      related_record_id: relatedRecordId || "",
      link: link || "",
      is_read: false,
      sent_at: new Date().toISOString(),
      delivery_status: "dev_logged",
    });
    // Email adapter: dev mode logs; production adapter would send real email
    if (recipientEmail) {
      console.log(`[DEV EMAIL ${deliveryMode}] To: ${recipientEmail} | ${title} | ${body}`);
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

// Compute dashboard metrics from raw records (no hardcoded values)
export function computeEvidenceMetrics(requests) {
  const counts = { Requested: 0, Received: 0, "Partially Received": 0, "Require Further Comments": 0, "Not Applicable": 0, "Not Available": 0, Overdue: 0, awaiting_review: 0, accepted: 0, rejected: 0, expiring_soon: 0 };
  const now = new Date();
  requests.forEach((r) => {
    const status = computeOverdueStatus(r);
    if (counts[status] !== undefined) counts[status]++;
    if (r.review_status === "awaiting_review" && (status === "Received" || status === "Partially Received")) counts.awaiting_review++;
    if (r.review_status === "accepted" || r.review_status === "accepted_with_observation") counts.accepted++;
    if (r.review_status === "rejected") counts.rejected++;
  });
  return counts;
}

export function computeComplianceMetrics(controls) {
  const counts = { "Under Evaluation": 0, "Implemented": 0, "Partially Implemented": 0, "Not Implemented": 0, "Not Applicable": 0 };
  let total = 0;
  let implemented = 0;
  controls.forEach((c) => {
    if (counts[c.compliance_status] !== undefined) counts[c.compliance_status]++;
    if (c.compliance_status !== "Not Applicable") {
      total++;
      if (c.compliance_status === "Implemented") implemented++;
      else if (c.compliance_status === "Partially Implemented") implemented += 0.5;
    }
  });
  const percentage = total > 0 ? Math.round((implemented / total) * 100) : 0;
  return { counts, percentage, total };
}