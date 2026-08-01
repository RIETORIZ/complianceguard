import { describe, expect, it } from "vitest";
import { isFileNameMeaningful, suggestEvidenceName, computeOverdueStatus, computeComplianceMetrics, evidenceValidityStatus } from "./compliance-core";

describe("evidence naming", () => {
  it("rejects random keysmash names", () => expect(isFileNameMeaningful("fakjsdbfjkvbaksjldbvkjlasd.png")).toBe(false));
  it("accepts descriptive names", () => expect(isFileNameMeaningful("ECC_1-1_Approved_Policy_2026.pdf")).toBe(true));
  it("suggests structured names", () => expect(suggestEvidenceName({ frameworkCode: "ECC", controlNumber: "1-X-X", evidenceType: "Approved Policy", system: "GRC", date: "2026" })).toContain("ECC_1-X-X_Approved_Policy_GRC_2026"));
});

describe("status separation and calculations", () => {
  it("does not mark received or partially received overdue", () => {
    expect(computeOverdueStatus({ status: "Received", due_date: "2020-01-01" })).toBe("Received");
    expect(computeOverdueStatus({ status: "Partially Received", due_date: "2020-01-01" })).toBe("Partially Received");
  });
  it("marks unanswered requests overdue", () => expect(computeOverdueStatus({ status: "Requested", due_date: "2020-01-01" })).toBe("Overdue"));
  it("calculates partial implementation as half weight", () => {
    const result = computeComplianceMetrics([
      { compliance_status: "Implemented" },
      { compliance_status: "Partially Implemented" },
      { compliance_status: "Not Implemented" },
      { compliance_status: "Not Applicable" },
    ]);
    expect(result.percentage).toBe(50);
  });
  it("calculates evidence validity", () => {
    expect(evidenceValidityStatus("2020-01-01", new Date("2026-08-01T00:00:00Z"))).toBe("Expired");
    expect(evidenceValidityStatus("2026-08-20", new Date("2026-08-01T00:00:00Z"))).toBe("Expiring Soon");
  });
});
