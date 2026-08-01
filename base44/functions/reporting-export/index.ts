import { createClientFromRequest } from "npm:@base44/sdk";

const DATASETS: Record<string, string> = {
  audits: "Audit",
  frameworks: "Framework",
  domains: "Domain",
  controls: "Control",
  audit_controls: "AuditControl",
  expected_evidence: "ExpectedEvidence",
  evidence_conditions: "EvidenceCondition",
  evidence_requests: "EvidenceRequest",
  evidence_submissions: "EvidenceSubmission",
  evidence_mappings: "EvidenceMapping",
  owners: "Owner",
  owner_groups: "OwnerGroup",
  organizational_units: "OrgUnit",
  sites: "Site",
  systems: "System",
  findings: "Finding",
  correction_plans: "CorrectionPlan",
  audit_responses: "AuditResponse",
  notifications: "Notification",
  audit_trail: "AuditTrail",
  compliance_snapshots: "ComplianceSnapshot",
};

const AUDIT_TYPES = ["Self-Assessment", "External Regulatory Audit", "Corporate Compliance Assessment", "Internal Audit", "Technical Assessment", "Correction Plan"];
const EVIDENCE_STATUSES = ["Requested", "Received", "Partially Received", "Require Further Comments", "Not Applicable", "Not Available", "Overdue"];
const COMPLIANCE_STATUSES = ["Under Evaluation", "Implemented", "Partially Implemented", "Not Implemented", "Not Applicable"];
const ALLOWED_ROLES = new Set(["admin", "System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Executive Viewer"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.has(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { dataset, limit = 5000, updatedSince } = await req.json();
    const safeLimit = Math.min(Math.max(Number(limit) || 5000, 1), 10000);
    const admin = base44.asServiceRole;
    const exportedAt = new Date().toISOString();
    let entityName = DATASETS[dataset] || "ReportingLookup";
    let rows: any[];
    let stableKey = "id";
    let incrementalKey = "updated_date";

    if (dataset === "audit_types") {
      rows = AUDIT_TYPES.map((name, index) => ({ id: `AUDIT_TYPE_${index + 1}`, name, order: index + 1 }));
      incrementalKey = "";
    } else if (dataset === "evidence_statuses") {
      rows = EVIDENCE_STATUSES.map((name, index) => ({ id: `EVIDENCE_STATUS_${index + 1}`, name, order: index + 1 }));
      incrementalKey = "";
    } else if (dataset === "compliance_statuses") {
      rows = COMPLIANCE_STATUSES.map((name, index) => ({ id: `COMPLIANCE_STATUS_${index + 1}`, name, order: index + 1 }));
      incrementalKey = "";
    } else if (dataset === "status_histories") {
      entityName = "StatusHistory";
      rows = updatedSince ? await admin.entities.StatusHistory.filter({ changed_at: { $gte: updatedSince } }, "changed_at", safeLimit) : await admin.entities.StatusHistory.list("changed_at", safeLimit);
      stableKey = "id";
      incrementalKey = "changed_at";
    } else {
      const mappedEntity = DATASETS[dataset];
      if (!mappedEntity) {
        const valid = [...Object.keys(DATASETS), "audit_types", "evidence_statuses", "compliance_statuses", "status_histories"];
        return Response.json({ error: `Unknown dataset. Valid values: ${valid.join(", ")}` }, { status: 400 });
      }
      const entity = admin.entities[mappedEntity];
      rows = updatedSince ? await entity.filter({ updated_date: { $gte: updatedSince } }, "updated_date", safeLimit) : await entity.list("updated_date", safeLimit);
    }

    await admin.entities.AuditTrail.create({
      user_id: user.id,
      user_name: user.full_name || user.email || "",
      action: "reporting_export",
      record_type: entityName,
      record_id: "",
      record_name: dataset,
      comment: `Exported ${rows.length} rows`,
      timestamp: exportedAt,
    });

    return Response.json({ dataset, entity: entityName, exported_at: exportedAt, row_count: rows.length, stable_key: stableKey, incremental_key: incrementalKey, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("reporting-export", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});
