export const UNIFIED_AUDIT_WORKFLOW = "Unified Compliance Workflow v1";

export const AUDIT_TYPES = [
  "Self-Assessment",
  "External Regulatory Audit",
  "Corporate Compliance Assessment",
  "Internal Audit",
  "Technical Assessment",
  "Correction Plan",
];

export const AUDIT_WORKFLOW_STAGES = [
  { id: "control_setup", label: "Controls", description: "Create or select the audit and add official or custom controls." },
  { id: "evidence_request", label: "Evidence Requests", description: "Define expected evidence, conditions, owners, due dates, and notifications." },
  { id: "evidence_submission", label: "Submission", description: "Auditees upload or reuse evidence, complete metadata, and confirm conditions." },
  { id: "evidence_review", label: "Evidence Review", description: "Auditors independently review each submission and each evidence mapping." },
  { id: "compliance_evaluation", label: "Evaluation", description: "Evaluate control implementation separately from evidence receipt or acceptance." },
  { id: "audit_response", label: "Audit Response", description: "Send the formal control response, required action, owner, and due date." },
  { id: "finding", label: "Finding", description: "Record observations or formal findings when material gaps remain." },
  { id: "correction_plan", label: "Correction Plan", description: "Assign corrective actions, milestones, owners, target dates, and closure evidence." },
  { id: "verification", label: "Verification", description: "Review remediation and closure evidence without automatically implementing the control." },
  { id: "closure", label: "Closure", description: "Reassess the control, close eligible records, and update reporting." },
];

export const EVIDENCE_REVIEW_DECISIONS = [
  "Pending Review",
  "Accepted",
  "Accepted with Observation",
  "Partially Sufficient",
  "Revision Required",
  "Rejected",
  "Expired",
  "Superseded",
];

export const FINDING_STATUSES = [
  "Draft",
  "Open",
  "Management Response Required",
  "Correction Plan Required",
  "Under Remediation",
  "Pending Verification",
  "Closed",
  "Risk Accepted",
  "Cancelled",
];

export const CORRECTION_PLAN_STATUSES = [
  "Draft",
  "Awaiting Owner Response",
  "Open",
  "In Progress",
  "Pending Closure Evidence",
  "Submitted for Verification",
  "Revision Required",
  "Verified",
  "Closed",
  "Overdue",
  "On Hold",
  "Cancelled",
  "Risk Accepted",
];

const LEGACY_REVIEW_DECISIONS = {
  awaiting_review: "Pending Review",
  pending: "Pending Review",
  accepted: "Accepted",
  accepted_with_observation: "Accepted with Observation",
  partially_sufficient: "Partially Sufficient",
  clarification_requested: "Revision Required",
  further_comments_requested: "Revision Required",
  corrected_file_requested: "Revision Required",
  updated_evidence_requested: "Revision Required",
  formal_approval_requested: "Revision Required",
  rejected: "Rejected",
  expired: "Expired",
  superseded: "Superseded",
};

const LEGACY_FINDING_STATUSES = {
  open: "Open",
  in_progress: "Under Remediation",
  remediated: "Pending Verification",
  verified_closed: "Closed",
  accepted: "Risk Accepted",
};

const LEGACY_PLAN_STATUSES = {
  open: "Open",
  in_progress: "In Progress",
  validated: "Verified",
  closed: "Closed",
  overdue: "Overdue",
};

export function normalizeReviewDecision(value) {
  if (!value) return "Pending Review";
  return LEGACY_REVIEW_DECISIONS[value] || value;
}

export function normalizeFindingStatus(value) {
  if (!value) return "Draft";
  return LEGACY_FINDING_STATUSES[value] || value;
}

export function normalizeCorrectionPlanStatus(value) {
  if (!value) return "Draft";
  return LEGACY_PLAN_STATUSES[value] || value;
}

export function isAcceptedReviewDecision(value) {
  return ["Accepted", "Accepted with Observation"].includes(normalizeReviewDecision(value));
}

export function isOpenFindingStatus(value) {
  return !["Closed", "Risk Accepted", "Cancelled"].includes(normalizeFindingStatus(value));
}

export function isClosedCorrectionPlanStatus(value) {
  return ["Closed", "Risk Accepted", "Cancelled"].includes(normalizeCorrectionPlanStatus(value));
}

export function getDefaultAuditName({ year = new Date().getFullYear(), frameworkCode, siteName = "" }) {
  const base = `${year} ${frameworkCode || "Audit"}`;
  return frameworkCode === "OTCC" && siteName ? `${base} - ${siteName}` : base;
}

export function reviewDecisionToRequestStatus(decision, currentStatus = "Received", action = "") {
  const normalized = normalizeReviewDecision(decision);
  if (action === "request_comments") return "Require Further Comments";
  if (normalized === "Partially Sufficient") return "Partially Received";
  if (["Revision Required", "Rejected", "Expired"].includes(normalized)) return "Requested";
  if (["Accepted", "Accepted with Observation", "Superseded"].includes(normalized)) return currentStatus === "Partially Received" ? "Partially Received" : "Received";
  return currentStatus;
}

export function validateComplianceDecision({
  complianceStatus,
  evidenceRequests = [],
  submissions = [],
  expectedEvidence = [],
  findings = [],
  reason = "",
}) {
  const errors = [];
  if (complianceStatus === "Under Evaluation") return errors;
  if (["Not Applicable", "Partially Implemented", "Not Implemented"].includes(complianceStatus) && !String(reason).trim()) {
    errors.push(`${complianceStatus} requires an evaluation reason.`);
  }
  if (complianceStatus === "Not Applicable") return errors;
  if (complianceStatus === "Implemented") {
    const mandatoryExpected = expectedEvidence.filter((item) => item.is_mandatory !== false);
    for (const expected of mandatoryExpected) {
      const request = evidenceRequests.find((item) => item.expected_evidence_id === expected.id);
      if (!request) {
        errors.push(`Mandatory evidence has not been requested: ${expected.name || expected.title || expected.id}.`);
        continue;
      }
      const decision = normalizeReviewDecision(request.review_decision || request.review_status);
      if (!isAcceptedReviewDecision(decision)) errors.push(`Mandatory evidence is not accepted: ${request.title}.`);
      const acceptedSubmission = submissions.find((submission) => {
        const linked = submission.evidence_request_id === request.id || (submission.linked_evidence_request_ids || []).includes(request.id);
        return linked && isAcceptedReviewDecision(submission.review_decision || submission.review_status) && !["Expired", "Superseded"].includes(submission.validity_status);
      });
      if (!acceptedSubmission) errors.push(`No current accepted submission exists for: ${request.title}.`);
    }
    if (findings.some((finding) => isOpenFindingStatus(finding.status))) errors.push("Open findings prevent an Implemented decision.");
  }
  return errors;
}


export function validateAuditResponseType({ responseType, complianceStatus }) {
  const requiredStatus = {
    "Control Accepted": "Implemented",
    "Accepted with Observation": "Implemented",
    "Additional Evidence Required": "Under Evaluation",
    "Further Comments Required": "Under Evaluation",
    "Evidence Rejected": "Under Evaluation",
    "Partially Implemented": "Partially Implemented",
    "Not Implemented": "Not Implemented",
    "Not Applicable Accepted": "Not Applicable",
    "Not Applicable Rejected": "Not Applicable",
  }[responseType];
  if (!requiredStatus || requiredStatus === complianceStatus) return [];
  return [`${responseType} requires the control compliance status to be ${requiredStatus}, not ${complianceStatus || "blank"}.`];
}

export function deriveAuditWorkflow({ controls = [], requests = [], submissions = [], responses = [], findings = [], correctionPlans = [] }) {
  let currentIndex = 0;
  if (controls.length) currentIndex = 1;
  if (requests.length) currentIndex = 2;
  if (submissions.length || requests.some((request) => ["Received", "Partially Received"].includes(request.status))) currentIndex = 3;
  if (requests.some((request) => normalizeReviewDecision(request.review_decision || request.review_status) !== "Pending Review")) currentIndex = 4;
  if (controls.some((control) => control.compliance_status !== "Under Evaluation")) currentIndex = 5;
  if (responses.length) currentIndex = 6;
  if (findings.length) currentIndex = 7;
  if (correctionPlans.length) currentIndex = 8;
  if (correctionPlans.some((plan) => ["Submitted for Verification", "Verified", "Closed", "Risk Accepted"].includes(normalizeCorrectionPlanStatus(plan.status)))) currentIndex = 9;
  const allControlsResolved = controls.length > 0 && controls.every((control) => control.is_closed === true);
  const allPlansClosed = correctionPlans.every((plan) => isClosedCorrectionPlanStatus(plan.status));
  const allFindingsClosed = findings.every((finding) => !isOpenFindingStatus(finding.status));
  if (allControlsResolved && allPlansClosed && allFindingsClosed) currentIndex = 9;
  return {
    currentIndex,
    currentStage: AUDIT_WORKFLOW_STAGES[currentIndex],
    completionPercentage: Math.round(((currentIndex + (allControlsResolved && allPlansClosed && allFindingsClosed ? 1 : 0)) / AUDIT_WORKFLOW_STAGES.length) * 100),
    stages: AUDIT_WORKFLOW_STAGES.map((stage, index) => ({ ...stage, state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming" })),
  };
}
