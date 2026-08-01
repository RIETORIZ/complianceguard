import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { computeEvidenceMetrics, computeComplianceMetrics, computeOverdueStatus, EVIDENCE_STATUS_CONFIG, COMPLIANCE_STATUS_CONFIG, SEVERITY_CONFIG } from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import { ShieldCheck, FileStack, Flag, ClipboardList, TrendingUp, AlertTriangle, CheckCircle2, Clock, Users, ArrowRight } from "lucide-react";

function StatCard({ label, value, icon: Icon, color, to, sub }) {
  const content = (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          <div className="text-sm text-slate-500 mt-1">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function SectionCard({ title, children, to, actionLabel }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {to && (
          <Link to={to} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
            {actionLabel || "View all"} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState([]);
  const [requests, setRequests] = useState([]);
  const [controls, setControls] = useState([]);
  const [findings, setFindings] = useState([]);
  const [actions, setActions] = useState([]);
  const [owners, setOwners] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, c, f, cp, o] = await Promise.all([
          base44.entities.Audit.list("-created_date", 200),
          base44.entities.EvidenceRequest.list("-created_date", 500),
          base44.entities.AuditControl.list("-created_date", 500),
          base44.entities.Finding.list("-created_date", 200),
          base44.entities.CorrectionPlan.list("-created_date", 200),
          base44.entities.Owner.list("-created_date", 200),
        ]);
        setAudits(a); setRequests(r); setControls(c); setFindings(f); setActions(cp); setOwners(o);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  const activeAudits = audits.filter((a) => a.status === "active").length;
  const plannedAudits = audits.filter((a) => a.status === "planned").length;
  const completedAudits = audits.filter((a) => a.status === "completed").length;
  const evMetrics = computeEvidenceMetrics(requests);
  const compMetrics = computeComplianceMetrics(controls);
  const openFindings = findings.filter((f) => !["verified_closed", "accepted"].includes(f.status)).length;
  const closedFindings = findings.length - openFindings;
  const overdueActions = actions.filter((a) => a.status === "overdue" || (a.target_date && new Date(a.target_date) < new Date() && a.status !== "closed")).length;
  const actionsDueSoon = actions.filter((a) => {
    if (a.status === "closed") return false;
    if (!a.target_date) return false;
    const days = (new Date(a.target_date) - new Date()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const completionRate = actions.length > 0 ? Math.round(actions.filter((a) => a.status === "closed").length / actions.length * 100) : 0;

  const auditsByType = {};
  audits.forEach((a) => { auditsByType[a.audit_type] = (auditsByType[a.audit_type] || 0) + 1; });
  const auditsByFramework = {};
  audits.forEach((a) => { auditsByFramework[a.framework_code || "—"] = (auditsByFramework[a.framework_code || "—"] || 0) + 1; });

  const findingsBySeverity = {};
  findings.forEach((f) => { findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1; });

  const requestsByOwner = {};
  requests.forEach((r) => {
    (r.assigned_owner_ids || []).forEach((oid) => { requestsByOwner[oid] = (requestsByOwner[oid] || 0) + 1; });
  });
  const overdueByOwner = {};
  requests.forEach((r) => {
    if (computeOverdueStatus(r) === "Overdue") {
      (r.assigned_owner_ids || []).forEach((oid) => { overdueByOwner[oid] = (overdueByOwner[oid] || 0) + 1; });
    }
  });

  const ownerName = (id) => owners.find((o) => o.id === id)?.full_name || "Unknown";
  const unassignedControls = controls.filter((c) => !c.control_level_owners || c.control_level_owners.length === 0).length;
  const unassignedEvidence = requests.filter((r) => (!r.assigned_owner_ids || r.assigned_owner_ids.length === 0) && !r.assigned_department_id && !r.assigned_division_id).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time overview of audits, evidence, compliance status, findings and corrective actions.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Audits" value={activeAudits} icon={ShieldCheck} color="bg-blue-100 text-blue-700" to="/audits" sub={`${plannedAudits} planned · ${completedAudits} completed`} />
        <StatCard label="Evidence Requests" value={requests.length} icon={FileStack} color="bg-purple-100 text-purple-700" to="/audits" sub={`${evMetrics.Overdue} overdue · ${evMetrics.awaiting_review} awaiting review`} />
        <StatCard label="Compliance" value={`${compMetrics.percentage}%`} icon={TrendingUp} color="bg-emerald-100 text-emerald-700" to="/audits" sub={`${compMetrics.counts.Implemented} implemented of ${compMetrics.total}`} />
        <StatCard label="Open Findings" value={openFindings} icon={Flag} color="bg-red-100 text-red-700" to="/findings" sub={`${closedFindings} closed`} />
      </div>

      {/* Audit overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Audits by Type" to="/audits">
          <div className="space-y-2.5">
            {Object.entries(auditsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{type}</span>
                <span className="text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
            {Object.keys(auditsByType).length === 0 && <p className="text-sm text-slate-400">No audits yet</p>}
          </div>
        </SectionCard>
        <SectionCard title="Audits by Framework" to="/frameworks">
          <div className="space-y-2.5">
            {Object.entries(auditsByFramework).map(([fw, count]) => (
              <div key={fw} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{fw}</span>
                <span className="text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
            {Object.keys(auditsByFramework).length === 0 && <p className="text-sm text-slate-400">No frameworks yet</p>}
          </div>
        </SectionCard>
        <SectionCard title="Findings by Severity" to="/findings">
          <div className="space-y-2.5">
            {["critical", "high", "medium", "low"].map((sev) => (
              <div key={sev} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${SEVERITY_CONFIG[sev].split(" ")[0]}`} />
                  <span className="text-sm text-slate-700 capitalize">{sev}</span>
                </span>
                <span className="text-sm font-semibold text-slate-900">{findingsBySeverity[sev] || 0}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Evidence overview */}
      <SectionCard title="Evidence Request Status Overview" to="/audits">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.keys(EVIDENCE_STATUS_CONFIG).map((s) => (
            <div key={s} className="border border-slate-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-900">{evMetrics[s]}</div>
              <div className="text-[11px] text-slate-500 mt-1">{s}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
          <div className="text-center"><div className="text-lg font-semibold text-slate-900">{evMetrics.awaiting_review}</div><div className="text-[11px] text-slate-500">Awaiting Review</div></div>
          <div className="text-center"><div className="text-lg font-semibold text-emerald-700">{evMetrics.accepted}</div><div className="text-[11px] text-slate-500">Accepted</div></div>
          <div className="text-center"><div className="text-lg font-semibold text-red-700">{evMetrics.rejected}</div><div className="text-[11px] text-slate-500">Rejected</div></div>
          <div className="text-center"><div className="text-lg font-semibold text-amber-700">{evMetrics.expiring_soon}</div><div className="text-[11px] text-slate-500">Expiring Soon</div></div>
        </div>
      </SectionCard>

      {/* Compliance overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Compliance Status Distribution" to="/audits">
          <div className="space-y-3">
            {Object.keys(COMPLIANCE_STATUS_CONFIG).map((s) => {
              const count = compMetrics.counts[s] || 0;
              const pct = compMetrics.total > 0 ? Math.round((count / compMetrics.total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <StatusBadge status={s} config={COMPLIANCE_STATUS_CONFIG} />
                    <span className="text-slate-600">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard title="Correction Plans" to="/correction-plans">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard label="Open Actions" value={actions.filter((a) => a.status !== "closed").length} icon={ClipboardList} color="bg-amber-100 text-amber-700" />
            <StatCard label="Overdue" value={overdueActions} icon={AlertTriangle} color="bg-red-100 text-red-700" />
            <StatCard label="Due ≤7 days" value={actionsDueSoon} icon={Clock} color="bg-orange-100 text-orange-700" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} icon={CheckCircle2} color="bg-emerald-100 text-emerald-700" />
          </div>
        </SectionCard>
      </div>

      {/* Ownership overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Owners by Requests" to="/owners">
          <div className="space-y-2.5">
            {Object.entries(requestsByOwner).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([oid, count]) => (
              <div key={oid} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-slate-400" />{ownerName(oid)}</span>
                <span className="text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
            {Object.keys(requestsByOwner).length === 0 && <p className="text-sm text-slate-400">No assignments yet</p>}
          </div>
        </SectionCard>
        <SectionCard title="Overdue by Owner & Unassigned" to="/owners">
          <div className="space-y-2.5">
            {Object.entries(overdueByOwner).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([oid, count]) => (
              <div key={oid} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{ownerName(oid)}</span>
                <span className="text-sm font-semibold text-red-700">{count} overdue</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-600">Unassigned controls</span>
              <span className="text-sm font-semibold text-slate-900">{unassignedControls}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Unassigned evidence</span>
              <span className="text-sm font-semibold text-slate-900">{unassignedEvidence}</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}