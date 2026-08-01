import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const [controls, audits, frameworks, domains, sites] = await Promise.all([
      admin.entities.AuditControl.list("-updated_date", 10000),
      admin.entities.Audit.list("-updated_date", 2000),
      admin.entities.Framework.list("code", 1000),
      admin.entities.Domain.list("name", 5000),
      admin.entities.Site.list("name", 1000),
    ]);
    const date = new Date().toISOString().slice(0, 10);
    const existing = await admin.entities.ComplianceSnapshot.filter({ snapshot_date: date });
    const existingKeys = new Set(existing.map((snapshot) => `${snapshot.scope_type}:${snapshot.scope_id || "organization"}`));
    const auditById = new Map(audits.map((audit) => [audit.id, audit]));
    const frameworkById = new Map(frameworks.map((framework) => [framework.id, framework]));
    const domainById = new Map(domains.map((domain) => [domain.id, domain]));
    const siteById = new Map(sites.map((site) => [site.id, site]));
    const groups = new Map<string, { scope_type: string; scope_id: string; scope_name: string; controls: any[] }>();
    groups.set("organization:organization", { scope_type: "organization", scope_id: "", scope_name: "Organization", controls });
    for (const control of controls) {
      const audit = auditById.get(control.audit_id);
      const frameworkId = control.framework_id || audit?.framework_id || "";
      if (frameworkId) add(groups, "framework", frameworkId, frameworkById.get(frameworkId)?.code || audit?.framework_code || frameworkId, control);
      if (control.domain_id) add(groups, "domain", control.domain_id, domainById.get(control.domain_id)?.name || control.domain_id, control);
      if (audit?.site_id) add(groups, "site", audit.site_id, siteById.get(audit.site_id)?.name || audit.site_id, control);
    }
    const created = [];
    for (const group of groups.values()) {
      const key = `${group.scope_type}:${group.scope_id || "organization"}`;
      if (existingKeys.has(key)) continue;
      const metrics = calculate(group.controls);
      const snapshot = await admin.entities.ComplianceSnapshot.create({ snapshot_date: date, scope_type: group.scope_type, scope_id: group.scope_id, scope_name: group.scope_name, ...metrics });
      created.push(snapshot.id);
    }
    await admin.entities.AuditTrail.create({ user_name: "Compliance Automation", action: "compliance_snapshot_created", record_type: "ComplianceSnapshot", record_id: "", record_name: date, comment: `Created ${created.length} daily snapshot records`, timestamp: new Date().toISOString() });
    return Response.json({ success: true, snapshot_date: date, created: created.length });
  } catch (error) {
    console.error("compliance-snapshot", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});

function add(groups: Map<string, any>, type: string, id: string, name: string, control: any) {
  const key = `${type}:${id}`;
  if (!groups.has(key)) groups.set(key, { scope_type: type, scope_id: id, scope_name: name, controls: [] });
  groups.get(key).controls.push(control);
}

function calculate(controls: any[]) {
  const implemented = controls.filter((control) => control.compliance_status === "Implemented").length;
  const partially_implemented = controls.filter((control) => control.compliance_status === "Partially Implemented").length;
  const not_implemented = controls.filter((control) => control.compliance_status === "Not Implemented").length;
  const under_evaluation = controls.filter((control) => control.compliance_status === "Under Evaluation").length;
  const not_applicable = controls.filter((control) => control.compliance_status === "Not Applicable").length;
  const applicable_total = controls.length - not_applicable;
  const compliance_percentage = applicable_total ? Math.round(((implemented + partially_implemented * 0.5) / applicable_total) * 100) : 0;
  return { implemented, partially_implemented, not_implemented, under_evaluation, not_applicable, applicable_total, compliance_percentage };
}
