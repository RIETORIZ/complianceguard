import { describe, expect, it } from "vitest";
import {
  deriveAuditWorkflow,
  getDefaultAuditName,
  normalizeReviewDecision,
  reviewDecisionToRequestStatus,
  validateComplianceDecision,
  validateAuditResponseType,
} from "./audit-workflow";

describe("unified audit workflow", () => {
  it("uses the same default naming rule with OTCC site specialization", () => {
    expect(getDefaultAuditName({ year: 2026, frameworkCode: "ECC" })).toBe("2026 ECC");
    expect(getDefaultAuditName({ year: 2026, frameworkCode: "OTCC", siteName: "Plant 1" })).toBe("2026 OTCC - Plant 1");
  });

  it("normalizes legacy evidence decisions", () => {
    expect(normalizeReviewDecision("accepted_with_observation")).toBe("Accepted with Observation");
    expect(reviewDecisionToRequestStatus("Rejected", "Received")).toBe("Requested");
  });

  it("does not allow evidence acceptance alone to implement a control", () => {
    const errors = validateComplianceDecision({
      complianceStatus: "Implemented",
      expectedEvidence: [{ id: "e1", name: "Approved policy", is_mandatory: true }],
      evidenceRequests: [{ id: "r1", expected_evidence_id: "e1", title: "Approved policy", review_decision: "Accepted" }],
      submissions: [],
      findings: [],
    });
    expect(errors).toContain("No current accepted submission exists for: Approved policy.");
  });


  it("requires the formal audit response to match the compliance decision", () => {
    expect(validateAuditResponseType({ responseType: "Control Accepted", complianceStatus: "Implemented" })).toEqual([]);
    expect(validateAuditResponseType({ responseType: "Control Accepted", complianceStatus: "Partially Implemented" })).toHaveLength(1);
  });

  it("does not report closure before the control is formally closed", () => {
    const result = deriveAuditWorkflow({
      controls: [{ compliance_status: "Implemented", is_closed: false }],
      requests: [{ status: "Received", review_decision: "Accepted" }],
      submissions: [{ review_decision: "Accepted" }],
      responses: [],
      findings: [],
      correctionPlans: [],
    });
    expect(result.currentStage.id).toBe("audit_response");
    expect(result.completionPercentage).toBeLessThan(100);
  });

  it("derives the same stage progression regardless of audit type", () => {
    const result = deriveAuditWorkflow({
      controls: [{ compliance_status: "Under Evaluation" }],
      requests: [{ status: "Received", review_decision: "Accepted" }],
      submissions: [{ review_decision: "Accepted" }],
    });
    expect(result.currentStage.id).toBe("compliance_evaluation");
  });
});
