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
  notifications: "Notification",
  audit_trail: "AuditTrail",
};

const ALLOWED_ROLES = new Set(["admin", "System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Executive Viewer"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.has(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { dataset, limit = 5000, updatedSince } = await req.json();
    const entityName = DATASETS[dataset];
    if (!entityName) return Response.json({ error: `Unknown dataset. Valid values: ${Object.keys(DATASETS).join(", ")}` }, { status: 400 });
    const safeLimit = Math.min(Math.max(Number(limit) || 5000, 1), 10000);
    const admin = base44.asServiceRole;
    const entity = admin.entities[entityName];
    const rows = updatedSince ? await entity.filter({ updated_date: { $gte: updatedSince } }, "updated_date", safeLimit) : await entity.list("updated_date", safeLimit);
    const exportedAt = new Date().toISOString();
    await admin.entities.AuditTrail.create({ user_id: user.id, user_name: user.full_name || user.email || "", action: "reporting_export", record_type: entityName, record_id: "", record_name: dataset, comment: `Exported ${rows.length} rows`, timestamp: exportedAt });
    return Response.json({
      dataset,
      entity: entityName,
      exported_at: exportedAt,
      row_count: rows.length,
      stable_key: "id",
      incremental_key: "updated_date",
      rows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("reporting-export", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});
