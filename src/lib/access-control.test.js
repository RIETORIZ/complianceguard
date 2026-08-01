import { describe, expect, it } from "vitest";
import { canAccessRecordByScope, canViewEvidence, hasPermission, normalizeRole } from "./access-control";

describe("role permissions", () => {
  it("maps legacy roles without broadening admin access", () => {
    expect(normalizeRole("admin")).toBe("System Administrator");
    expect(normalizeRole("user")).toBe("Auditee");
  });
  it("allows auditors to manage audits but not administration", () => {
    const auditor = { role: "Auditor" };
    expect(hasPermission(auditor, "audits_manage")).toBe(true);
    expect(hasPermission(auditor, "admin_view")).toBe(false);
  });
  it("keeps executive viewers read-only", () => {
    const executive = { role: "Executive Viewer" };
    expect(hasPermission(executive, "reports_view")).toBe(true);
    expect(hasPermission(executive, "audits_manage")).toBe(false);
  });
});

describe("scope and confidentiality", () => {
  const user = { id: "u1", role: "Department Manager", data: { owner_id: "o1", sector_id: "s1", department_id: "d1", division_id: "v1", site_ids: ["site1"], system_ids: ["sys1"], evidence_clearance: "confidential" } };
  it("denies mismatched department scope", () => expect(canAccessRecordByScope(user, { department_id: "d2" })).toBe(false));
  it("allows matching scope", () => expect(canAccessRecordByScope(user, { sector_id: "s1", department_id: "d1", division_id: "v1", site_id: "site1", system_id: "sys1" })).toBe(true));
  it("denies evidence above the user's clearance", () => expect(canViewEvidence(user, { confidentiality_classification: "restricted" }, { department_id: "d1", assigned_owner_ids: ["o1"] })).toBe(false));
  it("allows assigned evidence within clearance", () => expect(canViewEvidence(user, { confidentiality_classification: "confidential", owner_id: "o1" }, { department_id: "d1", assigned_owner_ids: ["o1"] })).toBe(true));
});
