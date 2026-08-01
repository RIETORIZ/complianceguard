import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { seedDatabase } from "@/lib/seed";
import { Play, History, ShieldCheck, Database, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  { role: "System Administrator", desc: "Full platform configuration, user management, integrations", perms: "All CRUD, admin settings, user management" },
  { role: "Compliance Administrator", desc: "Manage frameworks, audits, owners, configuration", perms: "Create/edit frameworks, audits, owners, reports" },
  { role: "Compliance Officer", desc: "Oversee compliance program, assign audits", perms: "Create audits, request evidence, review, reports" },
  { role: "Auditor", desc: "Review evidence, set compliance status, findings", perms: "Review evidence, set compliance, create findings" },
  { role: "Auditee", desc: "Submit evidence against requests", perms: "Upload evidence, complete checklist, view own requests" },
  { role: "Control Owner", desc: "Own and remediate assigned controls", perms: "View assigned controls, submit evidence, update actions" },
  { role: "Department Manager", desc: "Oversight of department compliance", perms: "Read department audits, controls, findings" },
  { role: "Division Manager", desc: "Oversight of division compliance", perms: "Read division audits, controls, findings" },
  { role: "Sector Manager", desc: "Oversight of sector compliance", perms: "Read sector-wide compliance, dashboards" },
  { role: "External Auditor", desc: "Read-only access to assigned external audits", perms: "Read assigned audits, evidence (by confidentiality)" },
  { role: "Executive Viewer", desc: "Read-only dashboards and reports", perms: "Read dashboards, reports only" },
];

export default function Admin() {
  const [tab, setTab] = useState("seed");
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState([]);
  const [trails, setTrails] = useState([]);
  const [loadingTrails, setLoadingTrails] = useState(false);

  const runSeed = async () => {
    setSeeding(true);
    setProgress([]);
    try {
      await seedDatabase((msg) => setProgress((p) => [...p, msg]));
      setProgress((p) => [...p, "✓ Done. Refresh dashboards to see data."]);
    } catch (e) { setProgress((p) => [...p, "✗ Failed: " + e.message]); }
    finally { setSeeding(false); }
  };

  const migrateUnifiedWorkflow = async () => {
    setMigrating(true);
    try {
      const response = await base44.functions.invoke("migrate-unified-audit-workflow", {});
      const payload = response?.data || response;
      const summary = payload?.summary || {};
      alert(`Unified workflow migration completed.\nAudits: ${summary.audits || 0}\nEvidence requests: ${summary.evidence_requests || 0}\nSubmissions: ${summary.evidence_submissions || 0}\nMappings: ${summary.evidence_mappings || 0}\nFindings: ${summary.findings || 0}\nCorrection plans: ${summary.correction_plans || 0}`);
    } catch (error) {
      alert(`Workflow migration could not run: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const loadTrails = async () => {
    setLoadingTrails(true);
    try { setTrails(await base44.entities.AuditTrail.list("-timestamp", 100)); } catch (e) {}
    finally { setLoadingTrails(false); }
  };
  useEffect(() => { if (tab === "trail") loadTrails(); }, [tab]);

  const processOverdue = async () => {
    try {
      const response = await base44.functions.invoke("compliance-automation", {});
      const payload = response?.data || response;
      alert(`Compliance automation completed.\nEvidence overdue: ${payload?.summary?.evidence_requests_overdue || 0}\nEvidence expired: ${payload?.summary?.evidence_expired || 0}\nControls reopened: ${payload?.summary?.controls_reopened_due_to_expired_evidence || 0}\nCorrective actions overdue: ${payload?.summary?.corrective_actions_overdue || 0}`);
    } catch (error) {
      alert(`Automation could not run: ${error.message}`);
    }
  };

  const tabs = [
    { key: "seed", label: "Seed Data", icon: Database },
    { key: "trail", label: "Audit Trail", icon: History },
    { key: "roles", label: "Roles & Permissions", icon: ShieldCheck },
    { key: "security", label: "Security", icon: Lock },
    { key: "powerbi", label: "Power BI", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration, seed data, audit trail, security and reporting layer.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap", tab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700")}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "seed" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-2">Seed Demonstration Data</h3>
          <p className="text-sm text-slate-600 mb-4">Loads realistic data: 7 NCA frameworks, ECC controls/evidence/conditions, 2 OTCC site assessments, Internal Audit, Technical Assessment, Correction Plan, owners in every org tier, evidence in every request status, versioned evidence, reused evidence, overdue items, findings and corrective actions.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={runSeed} disabled={seeding} className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              <Play className="w-4 h-4" /> {seeding ? "Seeding…" : "Run Seed"}
            </button>
            <button onClick={migrateUnifiedWorkflow} disabled={migrating} className="flex items-center gap-2 border border-blue-200 text-blue-800 text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              <ShieldCheck className="w-4 h-4" /> {migrating ? "Migrating…" : "Apply Unified Workflow to Existing Audits"}
            </button>
            <a href="/samples/technical-assessment-import.csv" download className="text-sm border border-slate-200 px-3 py-2 rounded-lg">Technical import sample</a>
            <a href="/samples/correction-plan-import.csv" download className="text-sm border border-slate-200 px-3 py-2 rounded-lg">Correction-plan sample</a>
          </div>
          {progress.length > 0 && (
            <div className="mt-4 space-y-1">
              {progress.map((p, i) => (
                <div key={i} className={cn("text-xs flex items-center gap-1.5", p.startsWith("✓") ? "text-emerald-600" : p.startsWith("✗") ? "text-red-600" : "text-slate-500")}>
                  <CheckCircle2 className="w-3 h-3" /> {p}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "trail" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Immutable Audit Trail (last 100)</span>
            <button onClick={loadTrails} className="text-xs text-slate-500 hover:text-slate-900">Refresh</button>
          </div>
          {loadingTrails ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : (
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {trails.map((t) => (
                <div key={t.id} className="px-5 py-2.5 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900"><span className="font-mono text-xs text-slate-500">{t.action}</span> — {t.record_name || t.record_type}</div>
                    <div className="text-xs text-slate-500">{t.user_name || "system"} · {t.record_type} · {new Date(t.timestamp).toLocaleString()}</div>
                    {t.comment && <div className="text-xs text-slate-400 mt-0.5">{t.comment}</div>}
                    {t.previous_value && <div className="text-[10px] text-slate-400">prev: {t.previous_value?.slice(0, 80)}</div>}
                    {t.new_value && <div className="text-[10px] text-slate-400">new: {t.new_value?.slice(0, 80)}</div>}
                  </div>
                </div>
              ))}
              {trails.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No audit trail entries.</div>}
            </div>
          )}
        </div>
      )}

      {tab === "roles" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="px-4 py-2.5 text-left font-medium text-slate-600">Role</th><th className="px-4 py-2.5 text-left font-medium text-slate-600">Description</th><th className="px-4 py-2.5 text-left font-medium text-slate-600">Key Permissions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {ROLES.map((r) => (<tr key={r.role}><td className="px-4 py-2.5 font-medium text-slate-900">{r.role}</td><td className="px-4 py-2.5 text-slate-600">{r.desc}</td><td className="px-4 py-2.5 text-slate-600 text-xs">{r.perms}</td></tr>))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-sm text-slate-700">
          <h3 className="font-semibold text-slate-900">Security Considerations</h3>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>Authentication:</strong> Platform-managed secure auth (sessions, token rotation). Enterprise SSO via Google OAuth available.</li>
            <li><strong>Role-based access control:</strong> 11 roles enforced through interface permissions, entity row-level policies, protected regulatory fields, and backend evidence/reporting gateways.</li>
            <li><strong>Least privilege:</strong> Access scoped by audit, framework, sector, department, division, site, system, and evidence confidentiality classification.</li>
            <li><strong>File validation:</strong> File-type and size validation on upload; meaningful-name detection warns on poor file names.</li>
            <li><strong>Malware scanning:</strong> Integration point available for AV scanning on upload (configure in production).</li>
            <li><strong>Secure evidence access:</strong> The application releases a stored file URL only after the backend gateway verifies role, ownership, organizational scope, site/system scope, and confidentiality clearance. Preview attempts are audited. Short-lived storage-signed URLs remain a recommended production hardening item.</li>
            <li><strong>Audit trail:</strong> Immutable logging of authentication, audit changes, evidence actions, status changes, imports, reports (see Audit Trail tab).</li>
            <li><strong>Confidentiality classification:</strong> Each evidence file tagged public/internal/confidential/restricted.</li>
            <li><strong>Input validation & output encoding:</strong> Server-side validation on all entity writes; framework handles output encoding.</li>
            <li><strong>Separation of duties:</strong> Application permissions and evidence access are separate — a user may have app access but not evidence access.</li>
            <li><strong>No secrets in source:</strong> Credentials managed via environment configuration, never committed.</li>
          </ul>
          <div className="pt-3 border-t border-slate-100">
            <button onClick={processOverdue} className="flex items-center gap-2 text-xs border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"><AlertTriangle className="w-3.5 h-3.5" /> Run scheduled compliance automation now</button>
          </div>
        </div>
      )}

      {tab === "powerbi" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-sm text-slate-700">
          <h3 className="font-semibold text-slate-900">Power BI Reporting Layer</h3>
          <p>The platform's data model is designed for direct Power BI connectivity. All entities use stable string IDs and clear relational foreign keys.</p>
          <h4 className="font-medium text-slate-900 mt-3">Reporting Views / Tables</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {["Audits (with type, framework, site, status)", "Audit Types (lookup)", "Frameworks (lookup)", "Domains (hierarchy)", "Controls (with domain, framework)", "Expected Evidence (per control)", "Evidence Conditions (per evidence)", "Evidence Requests (status, dates, owners)", "Evidence Submissions (versioned, files)", "Evidence Statuses (request + review)", "Compliance Statuses (per control)", "Owners (with org hierarchy)", "Organizational Hierarchy (sector/dept/division)", "Sites", "Systems", "Findings (severity, status, source)", "Correction Plans (priority, progress, closure)", "Status Histories (audit trail)"].map((v) => (
              <div key={v} className="border border-slate-200 rounded-lg px-2 py-1.5">{v}</div>
            ))}
          </div>
          <h4 className="font-medium text-slate-900 mt-3">How to Connect Power BI</h4>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
            <li>In Power BI Desktop → Get Data → Web/OData.</li>
            <li>Call the authenticated <code>reporting-export</code> backend function using an authorized application user or service account.</li>
            <li>Request one supported dataset per query and load it into a star schema: facts (EvidenceRequest, EvidenceSubmission, EvidenceMapping, AuditControl, Finding, CorrectionPlan) and dimensions (Framework, Domain, Control, Owner, OrgUnit, Site, System, Audit).</li>
            <li>Join on the relational keys (e.g. EvidenceRequest.audit_control_id → AuditControl.id).</li>
            <li>Build measures for compliance %, overdue counts, evidence status distribution.</li>
          </ol>
          <p className="text-xs text-slate-400">The export response exposes stable <code>id</code> keys and <code>updated_date</code> for incremental refresh. Production refresh credentials should be held in the Power BI gateway or approved secret store, not in report files.</p>
        </div>
      )}
    </div>
  );
}