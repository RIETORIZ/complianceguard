import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { computeEvidenceMetrics, computeComplianceMetrics, computeOverdueStatus, EVIDENCE_STATUS_CONFIG, COMPLIANCE_STATUS_CONFIG, SEVERITY_CONFIG } from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Clock, FileStack, Flag, ShieldCheck, TrendingUp, Users } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [audits, requests, controls, findings, plans, owners, submissions, domains, orgUnits, sites, frameworks, snapshots, trails] = await Promise.all([
          base44.entities.Audit.list("-created_date", 1000), base44.entities.EvidenceRequest.list("-created_date", 5000), base44.entities.AuditControl.list("-updated_date", 10000), base44.entities.Finding.list("-created_date", 5000), base44.entities.CorrectionPlan.list("-created_date", 5000), base44.entities.Owner.list("full_name", 2000), base44.entities.EvidenceSubmission.list("-created_date", 10000), base44.entities.Domain.list("name", 5000), base44.entities.OrgUnit.list("name", 2000), base44.entities.Site.list("name", 1000), base44.entities.Framework.list("code", 1000), base44.entities.ComplianceSnapshot.list("snapshot_date", 10000), base44.entities.AuditTrail.list("-timestamp", 100),
        ]);
        setData({ audits, requests, controls, findings, plans, owners, submissions, domains, orgUnits, sites, frameworks, snapshots, trails });
      } catch (error) { console.error(error); }
    })();
  }, []);
  if (!data) return <Spinner />;

  const { audits, requests, controls, findings, plans, owners, submissions, domains, orgUnits, sites, frameworks, snapshots, trails } = data;
  const evidenceMetrics = computeEvidenceMetrics(requests);
  evidenceMetrics.expiring_soon = submissions.filter((submission) => submission.validity_status === "Expiring Soon" || (submission.expiry_date && daysUntil(submission.expiry_date) >= 0 && daysUntil(submission.expiry_date) <= 30)).length;
  const complianceMetrics = computeComplianceMetrics(controls);
  const openFindings = findings.filter((finding) => !["verified_closed", "accepted"].includes(finding.status));
  const overduePlans = plans.filter((plan) => plan.status === "overdue" || (plan.target_date && daysUntil(plan.target_date) < 0 && plan.status !== "closed"));
  const dueSoonPlans = plans.filter((plan) => plan.status !== "closed" && plan.target_date && daysUntil(plan.target_date) >= 0 && daysUntil(plan.target_date) <= 7);
  const today = new Date().toISOString().slice(0, 10);
  const receivedToday = requests.filter((request) => request.received_date?.slice(0, 10) === today).length;
  const active = audits.filter((audit) => audit.status === "active").length;
  const planned = audits.filter((audit) => audit.status === "planned").length;
  const completed = audits.filter((audit) => audit.status === "completed").length;
  const averageCompletion = audits.length ? Math.round(audits.reduce((sum, audit) => sum + (Number(audit.completion_percentage) || 0), 0) / audits.length) : 0;
  const ownerName = (id) => owners.find((owner) => owner.id === id)?.full_name || "Unknown";
  const unitName = (id) => orgUnits.find((unit) => unit.id === id)?.name || "—";
  const auditById = new Map(audits.map((audit) => [audit.id, audit]));
  const frameworkById = new Map(frameworks.map((framework) => [framework.id, framework]));

  const requestsByOwner = countAssignments(requests, "assigned_owner_ids");
  const overdueByOwner = countAssignments(requests.filter((request) => computeOverdueStatus(request) === "Overdue"), "assigned_owner_ids");
  const unassignedControls = controls.filter((control) => !(control.control_level_owners || []).length).length;
  const unassignedEvidence = requests.filter((request) => !(request.assigned_owner_ids || []).length && !(request.assigned_group_ids || []).length && !request.assigned_sector_id && !request.assigned_department_id && !request.assigned_division_id).length;
  const inactiveWithAssignments = owners.filter((owner) => owner.active === false && (requests.some((request) => (request.assigned_owner_ids || []).includes(owner.id)) || controls.some((control) => (control.control_level_owners || []).includes(owner.id)) || plans.some((plan) => plan.primary_owner_id === owner.id || (plan.supporting_owner_ids || []).includes(owner.id))));

  const byFramework = groupCompliance(controls, (control) => frameworkById.get(control.framework_id)?.code || auditById.get(control.audit_id)?.framework_code || "Custom");
  const byDomain = groupCompliance(controls, (control) => domains.find((domain) => domain.id === control.domain_id)?.name || "Ungrouped");
  const bySite = groupCompliance(controls, (control) => sites.find((site) => site.id === auditById.get(control.audit_id)?.site_id)?.name || "Organization-wide");
  const byDepartment = groupCompliance(controls.flatMap((control) => (control.control_level_owners || []).map((ownerId) => ({ ...control, department_key: unitName(owners.find((owner) => owner.id === ownerId)?.department_id) }))), (control) => control.department_key || "Unassigned");
  const controlsByDepartment = countBy(controls.flatMap((control) => (control.control_level_owners || []).map((ownerId) => unitName(owners.find((owner) => owner.id === ownerId)?.department_id))));
  const controlsByDivision = countBy(controls.flatMap((control) => (control.control_level_owners || []).map((ownerId) => unitName(owners.find((owner) => owner.id === ownerId)?.division_id))));
  const auditByType = countBy(audits.map((audit) => audit.audit_type));
  const auditByFramework = countBy(audits.map((audit) => audit.framework_code || "Custom"));
  const auditBySite = countBy(audits.map((audit) => sites.find((site) => site.id === audit.site_id)?.name || "Organization-wide"));
  const auditByYear = countBy(audits.map((audit) => String(audit.audit_year || "—")));
  const findingsBySeverity = countBy(findings.map((finding) => finding.severity));
  const findingsByType = countBy(findings.map((finding) => auditById.get(finding.source_audit_id)?.audit_type || finding.source_type || "Other"));
  const findingsByFramework = countBy(findings.map((finding) => frameworkById.get(finding.framework_id)?.code || "Custom"));
  const findingsByDepartment = countBy(findings.map((finding) => unitName(finding.department_id)));
  const trend = snapshots.filter((snapshot) => snapshot.scope_type === "organization").sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)).slice(-8);

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div><h1 className="text-2xl font-bold">Compliance Dashboard</h1><p className="text-sm text-slate-500 mt-1">Current application data with drill-down to audits, evidence, ownership, findings, and corrective actions.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4"><Stat label="Active Audits" value={active} sub={`${planned} planned · ${completed} completed`} icon={ShieldCheck} to="/audits" /><Stat label="Audit Completion" value={`${averageCompletion}%`} sub={`${audits.length} total audits`} icon={TrendingUp} to="/audits" /><Stat label="Evidence Requests" value={requests.length} sub={`${evidenceMetrics.Overdue} overdue · ${receivedToday} received today`} icon={FileStack} to="/audits" /><Stat label="Compliance" value={`${complianceMetrics.percentage}%`} sub={`${complianceMetrics.counts.Implemented} implemented`} icon={CheckCircle2} to="/audits" /><Stat label="Open Findings" value={openFindings.length} sub={`${findings.length - openFindings.length} closed/accepted`} icon={Flag} to="/findings" /></div>

    <div className="grid lg:grid-cols-4 gap-4"><Breakdown title="Audits by Type" values={auditByType} to="/audits" /><Breakdown title="Audits by Framework" values={auditByFramework} to="/audits" /><Breakdown title="Audits by Site" values={auditBySite} to="/audits" /><Breakdown title="Audits by Year" values={auditByYear} to="/audits" /></div>

    <Section title="Evidence Overview" to="/audits"><div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">{Object.keys(EVIDENCE_STATUS_CONFIG).map((status) => <Metric key={status} label={status} value={evidenceMetrics[status] || 0} />)}<Metric label="Awaiting Review" value={evidenceMetrics.awaiting_review} /><Metric label="Accepted" value={evidenceMetrics.accepted} /><Metric label="Rejected" value={evidenceMetrics.rejected} /><Metric label="Expiring Soon" value={evidenceMetrics.expiring_soon} /></div></Section>

    <div className="grid lg:grid-cols-2 gap-6"><Section title="Compliance Status" to="/audits"><div className="space-y-3">{Object.keys(COMPLIANCE_STATUS_CONFIG).map((status) => <Progress key={status} label={status} value={complianceMetrics.counts[status] || 0} total={controls.length} badge={<StatusBadge status={status} config={COMPLIANCE_STATUS_CONFIG} />} />)}</div></Section><Section title="Compliance Trend" to="/reports">{trend.length ? <div className="space-y-2">{trend.map((point) => <Progress key={point.id} label={point.snapshot_date} value={point.compliance_percentage} total={100} suffix="%" />)}</div> : <div className="text-sm text-slate-400">Daily trend snapshots will appear after the scheduled snapshot function runs. Current compliance is {complianceMetrics.percentage}%.</div>}</Section></div>

    <div className="grid lg:grid-cols-2 gap-6"><ComplianceTable title="Compliance by Framework" rows={byFramework} /><ComplianceTable title="Compliance by Domain" rows={byDomain} /><ComplianceTable title="Compliance by Department" rows={byDepartment} /><ComplianceTable title="Compliance by Site" rows={bySite} /></div>

    <div className="grid lg:grid-cols-3 gap-6"><Section title="Requests by Owner" to="/owners"><Ranked values={requestsByOwner} label={ownerName} /></Section><Section title="Overdue by Owner" to="/owners"><Ranked values={overdueByOwner} label={ownerName} danger /></Section><Section title="Assignment Health" to="/owners"><Rows rows={[["Unassigned controls",unassignedControls],["Unassigned evidence",unassignedEvidence],["Inactive users with open assignments",inactiveWithAssignments.length]]} />{inactiveWithAssignments.map((owner) => <div key={owner.id} className="text-xs text-red-700 mt-1">{owner.full_name}</div>)}</Section><Section title="Controls by Department" to="/owners"><Ranked values={controlsByDepartment} /></Section><Section title="Controls by Division" to="/owners"><Ranked values={controlsByDivision} /></Section><Section title="Corrective Actions" to="/correction-plans"><Rows rows={[["Open",plans.filter((plan) => plan.status !== "closed").length],["Overdue",overduePlans.length],["Due within 7 days",dueSoonPlans.length],["Completion rate",`${plans.length ? Math.round(plans.filter((plan) => plan.status === "closed").length / plans.length * 100) : 0}%`]]} /></Section></div>

    <div className="grid lg:grid-cols-4 gap-4"><Breakdown title="Findings by Severity" values={findingsBySeverity} to="/findings" severity /><Breakdown title="Findings by Audit Type" values={findingsByType} to="/findings" /><Breakdown title="Findings by Framework" values={findingsByFramework} to="/findings" /><Breakdown title="Findings by Department" values={findingsByDepartment} to="/findings" /></div>

    <Section title="Recent Activity" to="/admin"><div className="divide-y">{trails.slice(0, 12).map((trail) => <div key={trail.id} className="py-2 flex items-start justify-between gap-3"><div><div className="text-sm"><span className="font-mono text-xs text-slate-500">{trail.action}</span> — {trail.record_name || trail.record_type}</div><div className="text-xs text-slate-400">{trail.user_name || "system"} · {trail.comment || trail.reason || ""}</div></div><div className="text-[10px] text-slate-400 whitespace-nowrap">{trail.timestamp ? new Date(trail.timestamp).toLocaleString() : "—"}</div></div>)}{!trails.length && <div className="text-sm text-slate-400">No recent activity.</div>}</div></Section>
  </div>;
}

function Stat({ label, value, sub, icon: Icon, to }) { return <Link to={to} className="bg-white border rounded-xl p-4 hover:shadow"><div className="flex justify-between"><div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-slate-500">{label}</div><div className="text-[11px] text-slate-400 mt-1">{sub}</div></div><Icon className="w-5 h-5 text-slate-500" /></div></Link>; }
function Section({ title, children, to }) { return <div className="bg-white border rounded-xl"><div className="px-5 py-3 border-b flex justify-between"><h3 className="text-sm font-semibold">{title}</h3>{to && <Link to={to} className="text-xs text-slate-500 flex items-center gap-1">Drill down <ArrowRight className="w-3 h-3" /></Link>}</div><div className="p-5">{children}</div></div>; }
function Metric({ label, value }) { return <div className="border rounded-lg p-2 text-center"><div className="text-xl font-bold">{value}</div><div className="text-[10px] text-slate-500 leading-tight">{label}</div></div>; }
function Breakdown({ title, values, to, severity }) { return <Section title={title} to={to}><div className="space-y-2">{Object.entries(values).sort((a,b) => b[1]-a[1]).slice(0,8).map(([label,value]) => <div key={label} className="flex justify-between text-sm"><span className="flex items-center gap-2">{severity && <span className={`w-2 h-2 rounded-full ${(SEVERITY_CONFIG[label] || "bg-slate-100").split(" ")[0]}`} />}{label}</span><strong>{value}</strong></div>)}{!Object.keys(values).length && <div className="text-sm text-slate-400">No data.</div>}</div></Section>; }
function Progress({ label, value, total, suffix = "", badge }) { const width = total ? Math.min(100, Math.round(Number(value) / total * 100)) : 0; return <div><div className="flex justify-between text-xs mb-1"><span>{badge || label}</span><span>{value}{suffix}</span></div><div className="h-2 bg-slate-100 rounded"><div className="h-full bg-slate-700 rounded" style={{ width: `${width}%` }} /></div></div>; }
function ComplianceTable({ title, rows }) { return <Section title={title} to="/audits"><div className="space-y-2">{rows.slice(0,10).map((row) => <div key={row.name} className="grid grid-cols-[1fr_auto_auto] gap-3 text-sm"><span className="truncate">{row.name}</span><span>{row.total} controls</span><strong>{row.percentage}%</strong></div>)}{!rows.length && <div className="text-sm text-slate-400">No assigned data.</div>}</div></Section>; }
function Ranked({ values, label = (value) => value, danger }) { return <div className="space-y-2">{Object.entries(values).sort((a,b) => b[1]-a[1]).slice(0,8).map(([key,value]) => <div key={key} className="flex justify-between text-sm"><span>{label(key)}</span><strong className={danger ? "text-red-700" : ""}>{value}</strong></div>)}{!Object.keys(values).length && <div className="text-sm text-slate-400">No data.</div>}</div>; }
function Rows({ rows }) { return <div className="space-y-2">{rows.map(([label,value]) => <div key={label} className="flex justify-between text-sm"><span>{label}</span><strong>{value}</strong></div>)}</div>; }
function countBy(values) { return values.filter(Boolean).reduce((result,value) => ({ ...result, [value]: (result[value] || 0) + 1 }), {}); }
function countAssignments(rows, field) { const result = {}; rows.forEach((row) => (row[field] || []).forEach((id) => { result[id] = (result[id] || 0) + 1; })); return result; }
function groupCompliance(controls, nameFor) { const groups = {}; controls.forEach((control) => { const name = nameFor(control); if (!groups[name]) groups[name] = []; groups[name].push(control); }); return Object.entries(groups).map(([name,items]) => ({ name, total: items.length, percentage: computeComplianceMetrics(items).percentage })).sort((a,b) => b.percentage-a.percentage); }
function daysUntil(date) { return (new Date(`${date}T23:59:59`) - new Date()) / 86400000; }
function Spinner() { return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
