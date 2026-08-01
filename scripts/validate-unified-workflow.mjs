import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AUDIT_TYPES,
  AUDIT_WORKFLOW_STAGES,
  CORRECTION_PLAN_STATUSES,
  EVIDENCE_REVIEW_DECISIONS,
  FINDING_STATUSES,
  UNIFIED_AUDIT_WORKFLOW,
  deriveAuditWorkflow,
  getDefaultAuditName,
  validateComplianceDecision,
  validateAuditResponseType,
} from "../src/lib/audit-workflow.js";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const schema = async (name) => JSON.parse(await read(`base44/entities/${name}.jsonc`));
const enumFor = (entity, field) => entity.properties?.[field]?.enum || [];

assert.equal(UNIFIED_AUDIT_WORKFLOW, "Unified Compliance Workflow v1");
assert.deepEqual(AUDIT_TYPES, [
  "Self-Assessment",
  "External Regulatory Audit",
  "Corporate Compliance Assessment",
  "Internal Audit",
  "Technical Assessment",
  "Correction Plan",
]);
assert.equal(AUDIT_WORKFLOW_STAGES.length, 10, "The unified workflow must retain all ten control-to-closure stages.");
assert.equal(new Set(AUDIT_WORKFLOW_STAGES.map((stage) => stage.id)).size, 10, "Workflow stage IDs must be unique.");

assert.equal(getDefaultAuditName({ year: 2026, frameworkCode: "ECC" }), "2026 ECC");
assert.equal(getDefaultAuditName({ year: 2026, frameworkCode: "OTCC", siteName: "Jubail" }), "2026 OTCC - Jubail");

const evidenceRequest = await schema("EvidenceRequest");
const evidenceSubmission = await schema("EvidenceSubmission");
const evidenceMapping = await schema("EvidenceMapping");
const auditControl = await schema("AuditControl");
const finding = await schema("Finding");
const correctionPlan = await schema("CorrectionPlan");
const audit = await schema("Audit");

assert.deepEqual(enumFor(audit, "audit_type"), AUDIT_TYPES, "Every audit type must use the same shared workflow implementation.");
assert.deepEqual(enumFor(evidenceRequest, "review_decision"), EVIDENCE_REVIEW_DECISIONS);
assert.deepEqual(enumFor(evidenceSubmission, "review_decision"), EVIDENCE_REVIEW_DECISIONS);
assert.deepEqual(enumFor(evidenceMapping, "review_decision"), EVIDENCE_REVIEW_DECISIONS);
assert.deepEqual(enumFor(evidenceMapping, "mapping_status"), ["Pending", "Active", "Revision Required", "Rejected", "Expired", "Superseded"]);
assert.deepEqual(enumFor(auditControl, "compliance_status"), ["Under Evaluation", "Implemented", "Partially Implemented", "Not Implemented", "Not Applicable"]);
assert.deepEqual(enumFor(finding, "status"), FINDING_STATUSES);
assert.deepEqual(enumFor(correctionPlan, "status"), CORRECTION_PLAN_STATUSES);

const acceptedEvidenceDoesNotImplement = validateComplianceDecision({
  complianceStatus: "Implemented",
  expectedEvidence: [{ id: "expected-1", name: "Approved policy", is_mandatory: true }],
  evidenceRequests: [{ id: "request-1", expected_evidence_id: "expected-1", title: "Approved policy", review_decision: "Accepted" }],
  submissions: [],
  findings: [],
});
assert.ok(acceptedEvidenceDoesNotImplement.length > 0, "Evidence acceptance alone must not make a control Implemented.");
assert.deepEqual(validateAuditResponseType({ responseType: "Control Accepted", complianceStatus: "Implemented" }), []);
assert.ok(validateAuditResponseType({ responseType: "Control Accepted", complianceStatus: "Partially Implemented" }).length > 0, "A formal response must match the independent compliance decision.");

const completed = deriveAuditWorkflow({
  controls: [{ compliance_status: "Implemented", is_closed: true }],
  requests: [{ status: "Received", review_decision: "Accepted" }],
  submissions: [{ review_decision: "Accepted" }],
  responses: [{ response_type: "Control Accepted" }],
  findings: [],
  correctionPlans: [],
});
assert.equal(completed.currentStage.id, "closure");
assert.equal(completed.completionPercentage, 100);

const evaluatedButNotResponded = deriveAuditWorkflow({
  controls: [{ compliance_status: "Implemented", is_closed: false }],
  requests: [{ status: "Received", review_decision: "Accepted" }],
  submissions: [{ review_decision: "Accepted" }],
  responses: [],
  findings: [],
  correctionPlans: [],
});
assert.equal(evaluatedButNotResponded.currentStage.id, "audit_response", "An Implemented evaluation must not skip the formal audit-response stage.");
assert.ok(evaluatedButNotResponded.completionPercentage < 100);

const auditsSource = await read("src/pages/Audits.jsx");
assert.match(auditsSource, /AUDIT_TYPES\.map/, "Audit creation must draw from the shared audit-type registry.");
assert.match(auditsSource, /workflow_profile:\s*UNIFIED_AUDIT_WORKFLOW/, "New audits must be assigned the unified workflow profile.");
assert.match(auditsSource, /fw\.code === "OTCC"/, "The OTCC per-site naming/creation rule must be preserved.");

const workspaceSource = await read("src/pages/AuditWorkspace.jsx");
assert.match(workspaceSource, /Accepting evidence does not mark the control Implemented/, "The UI must explain the evidence/compliance separation.");
assert.match(workspaceSource, /validateComplianceDecision/, "Compliance evaluation must pass the shared invariant validator.");
assert.match(workspaceSource, /AuditResponse\.create/, "The formal audit-response stage must persist a response record.");
assert.match(workspaceSource, /deriveAuditWorkflow/, "Every audit workspace must render the shared workflow.");

const plansSource = await read("src/pages/CorrectionPlans.jsx");
assert.match(plansSource, /compliance_status:\s*"Under Evaluation"/, "Closing remediation must return the control to reassessment, not auto-implement it.");
assert.doesNotMatch(plansSource, /compliance_status:\s*"Implemented"/, "Correction-plan closure must not auto-implement a control.");
assert.match(plansSource, /const canVerify = hasPermission\(user, "evidence_review"\)/, "Correction-plan verification must be separated from owner progress updates.");
assert.match(plansSource, /Only an auditor or compliance reviewer can record verification/, "Owners must not be able to self-verify or self-close remediation.");

const automationSource = await read("base44/functions/compliance-automation/index.ts");
assert.match(automationSource, /controls_reopened_due_to_expired_evidence/, "Evidence-expiration automation must report affected controls.");
assert.match(automationSource, /hasCurrentAcceptedReplacement/, "Expired evidence must not reopen controls when a current accepted replacement exists.");
assert.match(automationSource, /mapping_status:\s*"Expired"/, "Expired shared evidence must invalidate each affected control mapping.");
assert.match(automationSource, /compliance_status:\s*"Under Evaluation"/, "Unsupported controls must return to independent compliance reassessment after evidence expires.");

console.log(JSON.stringify({
  result: "passed",
  audit_types: AUDIT_TYPES.length,
  workflow_stages: AUDIT_WORKFLOW_STAGES.length,
  evidence_review_decisions: EVIDENCE_REVIEW_DECISIONS.length,
  finding_statuses: FINDING_STATUSES.length,
  correction_plan_statuses: CORRECTION_PLAN_STATUSES.length,
}, null, 2));
