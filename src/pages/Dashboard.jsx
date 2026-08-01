import React, { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  computeEvidenceMetrics,
  computeComplianceMetrics,
  computeOverdueStatus,
  EVIDENCE_STATUS_CONFIG,
  COMPLIANCE_STATUS_CONFIG,
} from "@/lib/compliance";
import { StatusBadge } from "@/components/compliance/StatusBadge";
import {
  ArrowRight,
  CheckCircle2,
  FileStack,
  Flag,
  ShieldCheck,
  TrendingUp,
  Activity,
  AlertTriangle,
  Clock,
  Users,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";

const COMPLIANCE_COLORS = {
  Implemented: "#10b981",
  "Partially Implemented": "#f59e0b",
  "Not Implemented": "#ef4444",
  "Under Evaluation": "#6366f1",
  "Not Applicable": "#94a3b8",
};

const SEVERITY_HEX = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const EVIDENCE_HEX = {
  Requested: "#6366f1",
  Received: "#10b981",
  "Partially Received": "#f59e0b",
  "Require Further Comments": "#a855f7",
  "Not Applicable": "#94a3b8",
  "Not Available": "#64748b",
  Overdue: "#ef4444",
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [
          audits,
          requests,
          controls,
          findings,
          plans,
          owners,
          submissions,
          domains,
          orgUnits,
          sites,
          frameworks,
          snapshots,
          trails,
        ] = await Promise.all([
          base44.entities.Audit.list("-created_date", 1000),
          base44.entities.EvidenceRequest.list("-created_date", 5000),
          base44.entities.AuditControl.list("-updated_date", 10000),
          base44.entities.Finding.list("-created_date", 5000),
          base44.entities.CorrectionPlan.list("-created_date", 5000),
          base44.entities.Owner.list("full_name", 2000),
          base44.entities.EvidenceSubmission.list("-created_date", 10000),
          base44.entities.Domain.list("name", 5000),
          base44.entities.OrgUnit.list("name", 2000),
          base44.entities.Site.list("name", 1000),
          base44.entities.Framework.list("code", 1000),
          base44.entities.ComplianceSnapshot.list("snapshot_date", 10000),
          base44.entities.AuditTrail.list("-timestamp", 100),
        ]);
        setData({
          audits, requests, controls, findings, plans, owners, submissions,
          domains, orgUnits, sites, frameworks, snapshots, trails,
        });
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);
  if (!data) return <Spinner />;

  const {
    audits, requests, controls, findings, plans, owners, submissions,
    domains, orgUnits, sites, frameworks, snapshots, trails,
  } = data;
  const evidenceMetrics = computeEvidenceMetrics(requests);
  evidenceMetrics.expiring_soon = submissions.filter(
    (s) =>
      s.validity_status === "Expiring Soon" ||
      (s.expiry_date && daysUntil(s.expiry_date) >= 0 && daysUntil(s.expiry_date) <= 30)
  ).length;
  const complianceMetrics = computeComplianceMetrics(controls);
  const openFindings = findings.filter((f) => !["verified_closed", "accepted"].includes(f.status));
  const overduePlans = plans.filter(
    (p) => p.status === "overdue" || (p.target_date && daysUntil(p.target_date) < 0 && p.status !== "closed")
  );
  const dueSoonPlans = plans.filter(
    (p) => p.status !== "closed" && p.target_date && daysUntil(p.target_date) >= 0 && daysUntil(p.target_date) <= 7
  );
  const closedRate = plans.length
    ? Math.round((plans.filter((p) => p.status === "closed").length / plans.length) * 100)
    : 0;
  const today = new Date().toISOString().slice(0, 10);
  const receivedToday = requests.filter((r) => r.received_date?.slice(0, 10) === today).length;
  const active = audits.filter((a) => a.status === "active").length;
  const planned = audits.filter((a) => a.status === "planned").length;
  const completed = audits.filter((a) => a.status === "completed").length;
  const averageCompletion = audits.length
    ? Math.round(audits.reduce((s, a) => s + (Number(a.completion_percentage) || 0), 0) / audits.length)
    : 0;
  const ownerName = (id) => owners.find((o) => o.id === id)?.full_name || "Unknown";
  const unitName = (id) => orgUnits.find((u) => u.id === id)?.name || "—";
  const auditById = new Map(audits.map((a) => [a.id, a]));
  const frameworkById = new Map(frameworks.map((f) => [f.id, f]));

  const requestsByOwner = countAssignments(requests, "assigned_owner_ids");
  const overdueByOwner = countAssignments(
    requests.filter((r) => computeOverdueStatus(r) === "Overdue"),
    "assigned_owner_ids"
  );
  const unassignedControls = controls.filter((c) => !(c.control_level_owners || []).length).length;
  const unassignedEvidence = requests.filter(
    (r) =>
      !(r.assigned_owner_ids || []).length &&
      !(r.assigned_group_ids || []).length &&
      !r.assigned_sector_id &&
      !r.assigned_department_id &&
      !r.assigned_division_id
  ).length;
  const inactiveWithAssignments = owners.filter(
    (owner) =>
      owner.active === false &&
      (requests.some((r) => (r.assigned_owner_ids || []).includes(owner.id)) ||
        controls.some((c) => (c.control_level_owners || []).includes(owner.id)) ||
        plans.some((p) => p.primary_owner_id === owner.id || (p.supporting_owner_ids || []).includes(owner.id)))
  );

  const byFramework = groupCompliance(controls, (c) =>
    frameworkById.get(c.framework_id)?.code || auditById.get(c.audit_id)?.framework_code || "Custom"
  );
  const byDomain = groupCompliance(controls, (c) =>
    domains.find((d) => d.id === c.domain_id)?.name || "Ungrouped"
  );
  const bySite = groupCompliance(controls, (c) =>
    sites.find((s) => s.id === auditById.get(c.audit_id)?.site_id)?.name || "Organization-wide"
  );
  const byDepartment = groupCompliance(
    controls.flatMap((c) =>
      (c.control_level_owners || []).map((ownerId) => ({
        ...c,
        department_key: unitName(owners.find((o) => o.id === ownerId)?.department_id),
      }))
    ),
    (c) => c.department_key || "Unassigned"
  );
  const controlsByDepartment = countBy(
    controls.flatMap((c) =>
      (c.control_level_owners || []).map((ownerId) =>
        unitName(owners.find((o) => o.id === ownerId)?.department_id)
      )
    )
  );
  const controlsByDivision = countBy(
    controls.flatMap((c) =>
      (c.control_level_owners || []).map((ownerId) =>
        unitName(owners.find((o) => o.id === ownerId)?.division_id)
      )
    )
  );
  const auditByType = countBy(audits.map((a) => a.audit_type));
  const auditByFramework = countBy(audits.map((a) => a.framework_code || "Custom"));
  const auditBySite = countBy(
    audits.map((a) => sites.find((s) => s.id === a.site_id)?.name || "Organization-wide")
  );
  const auditByYear = countBy(audits.map((a) => String(a.audit_year || "—")));
  const findingsBySeverity = countBy(findings.map((f) => f.severity));
  const findingsByType = countBy(
    findings.map((f) => auditById.get(f.source_audit_id)?.audit_type || f.source_type || "Other")
  );
  const findingsByFramework = countBy(
    findings.map((f) => frameworkById.get(f.framework_id)?.code || "Custom")
  );
  const findingsByDepartment = countBy(findings.map((f) => unitName(f.department_id)));
  const trend = snapshots
    .filter((s) => s.scope_type === "organization")
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .slice(-8);

  // Chart datasets
  const compliancePieData = Object.keys(COMPLIANCE_STATUS_CONFIG).map((status) => ({
    name: status,
    value: complianceMetrics.counts[status] || 0,
    fill: COMPLIANCE_COLORS[status] || "#cbd5e1",
  }));
  const severityBarData = Object.keys(findingsBySeverity).map((sev) => ({
    name: sev,
    value: findingsBySeverity[sev],
    fill: SEVERITY_HEX[sev] || "#94a3b8",
  }));
  const auditTypeBarData = Object.keys(auditByType).map((type) => ({
    name: type.length > 22 ? type.slice(0, 20) + "…" : type,
    value: auditByType[type],
  }));
  const trendData = trend.map((point) => ({
    date: point.snapshot_date,
    compliance: point.compliance_percentage,
  }));
  const complianceRadial = [{ name: "Compliance", value: complianceMetrics.percentage, fill: "#10b981" }];
  const completionRadial = [{ name: "Completion", value: averageCompletion, fill: "#6366f1" }];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time governance posture with drill-down to audits, evidence, ownership, findings, and corrective actions.
        </p>
      </motion.div>

      {/* Hero stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard delay={0} label="Active Audits" value={active} sub={`${planned} planned · ${completed} completed`} icon={ShieldCheck} gradient="from-indigo-500 to-blue-500" to="/audits" />
        <StatCard delay={0.05} label="Audit Completion" value={averageCompletion} suffix="%" sub={`${audits.length} total audits`} icon={TrendingUp} gradient="from-violet-500 to-purple-500" to="/audits" />
        <StatCard delay={0.1} label="Evidence Requests" value={requests.length} sub={`${evidenceMetrics.Overdue} overdue · ${receivedToday} received today`} icon={FileStack} gradient="from-cyan-500 to-teal-500" to="/audits" />
        <StatCard delay={0.15} label="Compliance" value={complianceMetrics.percentage} suffix="%" sub={`${complianceMetrics.counts.Implemented} implemented`} icon={CheckCircle2} gradient="from-emerald-500 to-green-500" to="/audits" />
        <StatCard delay={0.2} label="Open Findings" value={openFindings.length} sub={`${findings.length - openFindings.length} closed/accepted`} icon={Flag} gradient="from-rose-500 to-red-500" to="/findings" />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Compliance Status" subtitle="Distribution of audit controls" to="/audits" delay={0.1}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={compliancePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  isAnimationActive
                  animationDuration={900}
                >
                  {compliancePieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => <span className="text-[11px] text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Posture Gauges" subtitle="Compliance & completion" to="/audits" delay={0.15}>
          <div className="h-60 grid grid-cols-2 gap-2">
            <RadialGauge data={complianceRadial} label="Compliance" color="#10b981" />
            <RadialGauge data={completionRadial} label="Completion" color="#6366f1" />
          </div>
        </ChartCard>

        <ChartCard title="Compliance Trend" subtitle="Organization-wide history" to="/reports" delay={0.2}>
          <div className="h-60">
            {trendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="compliance"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#trendGrad)"
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-sm text-slate-400 max-w-[16rem]">
                  Daily trend snapshots will appear after the scheduled snapshot function runs.
                  <br />Current compliance is <span className="font-semibold text-emerald-600">{complianceMetrics.percentage}%</span>.
                </p>
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Audits by Type" subtitle="Distribution across assessment categories" to="/audits" delay={0.1}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={auditTypeBarData} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6366f1" isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Findings by Severity" subtitle="Risk-rated issue distribution" to="/findings" delay={0.15}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityBarData} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800}>
                  {severityBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Evidence overview */}
      <Section title="Evidence Overview" to="/audits" delay={0.15}>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {Object.keys(EVIDENCE_STATUS_CONFIG).map((status) => (
            <Metric key={status} label={status} value={evidenceMetrics[status] || 0} color={EVIDENCE_HEX[status]} />
          ))}
          <Metric label="Awaiting Review" value={evidenceMetrics.awaiting_review} color="#6366f1" />
          <Metric label="Accepted" value={evidenceMetrics.accepted} color="#10b981" />
          <Metric label="Rejected" value={evidenceMetrics.rejected} color="#ef4444" />
          <Metric label="Expiring Soon" value={evidenceMetrics.expiring_soon} color="#f59e0b" />
        </div>
      </Section>

      {/* Compliance + corrective actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Compliance Status" to="/audits" delay={0.1}>
          <div className="space-y-3">
            {Object.keys(COMPLIANCE_STATUS_CONFIG).map((status, i) => (
              <AnimatedProgress
                key={status}
                index={i}
                label={status}
                value={complianceMetrics.counts[status] || 0}
                total={controls.length}
                color={COMPLIANCE_COLORS[status]}
                badge={<StatusBadge status={status} config={COMPLIANCE_STATUS_CONFIG} />}
              />
            ))}
          </div>
        </Section>
        <Section title="Corrective Actions" to="/correction-plans" delay={0.15}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat icon={Clock} label="Open" value={plans.filter((p) => p.status !== "closed").length} color="text-indigo-600 bg-indigo-50" />
              <MiniStat icon={AlertTriangle} label="Overdue" value={overduePlans.length} color="text-red-600 bg-red-50" />
              <MiniStat icon={Clock} label="Due ≤ 7d" value={dueSoonPlans.length} color="text-amber-600 bg-amber-50" />
              <MiniStat icon={CheckCircle2} label="Closed rate" value={`${closedRate}%`} color="text-emerald-600 bg-emerald-50" />
            </div>
            <div className="text-xs text-slate-500">
              {plans.length} corrective-action items across {audits.length} audits.
            </div>
          </div>
        </Section>
      </div>

      {/* Compliance tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ComplianceTable title="Compliance by Framework" rows={byFramework} delay={0.1} />
        <ComplianceTable title="Compliance by Domain" rows={byDomain} delay={0.15} />
        <ComplianceTable title="Compliance by Department" rows={byDepartment} delay={0.2} />
        <ComplianceTable title="Compliance by Site" rows={bySite} delay={0.25} />
      </div>

      {/* Ownership health */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Requests by Owner" to="/owners" delay={0.1}>
          <Ranked values={requestsByOwner} label={ownerName} icon={Users} />
        </Section>
        <Section title="Overdue by Owner" to="/owners" delay={0.15}>
          <Ranked values={overdueByOwner} label={ownerName} danger icon={AlertTriangle} />
        </Section>
        <Section title="Assignment Health" to="/owners" delay={0.2}>
          <Rows
            rows={[
              ["Unassigned controls", unassignedControls],
              ["Unassigned evidence", unassignedEvidence],
              ["Inactive users with open assignments", inactiveWithAssignments.length],
            ]}
          />
          {inactiveWithAssignments.map((owner) => (
            <div key={owner.id} className="text-xs text-red-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {owner.full_name}
            </div>
          ))}
        </Section>
        <Section title="Controls by Department" to="/owners" delay={0.25}>
          <Ranked values={controlsByDepartment} />
        </Section>
        <Section title="Controls by Division" to="/owners" delay={0.3}>
          <Ranked values={controlsByDivision} />
        </Section>
        <Section title="Audit Distribution" to="/audits" delay={0.35}>
          <Rows
            rows={[
              ["By Framework", Object.keys(auditByFramework).length],
              ["By Site", Object.keys(auditBySite).length],
              ["By Year", Object.keys(auditByYear).length],
              ["By Type", Object.keys(auditByType).length],
            ]}
          />
        </Section>
      </div>

      {/* Findings breakdown */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Breakdown title="Findings by Audit Type" values={findingsByType} to="/findings" delay={0.1} />
        <Breakdown title="Findings by Framework" values={findingsByFramework} to="/findings" delay={0.15} />
        <Breakdown title="Findings by Department" values={findingsByDepartment} to="/findings" delay={0.2} />
        <Breakdown title="Findings by Severity" values={findingsBySeverity} to="/findings" severity delay={0.25} />
      </div>

      {/* Recent activity */}
      <Section title="Recent Activity" to="/admin" delay={0.15}>
        <div className="divide-y divide-slate-100">
          {trails.slice(0, 12).map((trail) => (
            <motion.div
              key={trail.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="py-2 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm">
                    <span className="font-mono text-xs text-indigo-600">{trail.action}</span> —{" "}
                    {trail.record_name || trail.record_type}
                  </div>
                  <div className="text-xs text-slate-400">
                    {trail.user_name || "system"} · {trail.comment || trail.reason || ""}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                {trail.timestamp ? new Date(trail.timestamp).toLocaleString() : "—"}
              </div>
            </motion.div>
          ))}
          {!trails.length && <div className="text-sm text-slate-400">No recent activity.</div>}
        </div>
      </Section>
    </div>
  );
}

function StatCard({ label, value, suffix = "", sub, icon: Icon, gradient, to, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
    >
      <Link
        to={to}
        className="block bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg hover:border-slate-300 transition-shadow overflow-hidden relative"
      >
        <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10`} />
        <div className="flex justify-between items-start relative">
          <div>
            <AnimatedNumber value={Number(value) || 0} suffix={suffix} />
            <div className="text-sm font-medium text-slate-700">{label}</div>
            <div className="text-[11px] text-slate-400 mt-1">{sub}</div>
          </div>
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const duration = 700;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <div className="text-2xl font-bold tracking-tight">{display}{suffix}</div>;
}

function ChartCard({ title, subtitle, children, to, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white border border-slate-200 rounded-2xl"
    >
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-800">
            Drill down <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

function RadialGauge({ data, label, color }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar background dataKey="value" cornerRadius={20} fill={color} isAnimationActive animationDuration={900} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xl font-bold" style={{ color }}>{data[0].value}%</div>
        </div>
      </div>
      <div className="text-xs font-medium text-slate-600 -mt-2">{label}</div>
    </div>
  );
}

function Section({ title, children, to, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white border border-slate-200 rounded-2xl"
    >
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {to && (
          <Link to={to} className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-800">
            Drill down <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function Metric({ label, value, color }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="border border-slate-200 rounded-xl p-2.5 text-center bg-slate-50/50">
      <div className="text-xl font-bold" style={{ color: color || "#0f172a" }}>{value}</div>
      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</div>
    </motion.div>
  );
}

function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <Icon className="w-4 h-4 mb-1.5" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function AnimatedProgress({ index, label, value, total, color, badge }) {
  const width = total ? Math.min(100, Math.round((Number(value) / total) * 100)) : 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <div className="flex justify-between text-xs mb-1 items-center">
        <span className="flex items-center gap-2">{badge || label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.8, delay: index * 0.05, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color || "#334155" }}
        />
      </div>
    </motion.div>
  );
}

function Breakdown({ title, values, to, severity = false, delay = 0 }) {
  return (
    <Section title={title} to={to} delay={delay}>
      <div className="space-y-2">
        {Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="flex justify-between text-sm items-center"
          >
            <span className="flex items-center gap-2 truncate">
              {severity && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SEVERITY_HEX[label] || "#cbd5e1" }} />}
              <span className="truncate">{label}</span>
            </span>
            <strong className="flex-shrink-0 ml-2">{value}</strong>
          </motion.div>
        ))}
        {!Object.keys(values).length && <div className="text-sm text-slate-400">No data.</div>}
      </div>
    </Section>
  );
}

function ComplianceTable({ title, rows, delay = 0 }) {
  return (
    <Section title={title} to="/audits" delay={delay}>
      <div className="space-y-2">
        {rows.slice(0, 10).map((row, i) => (
          <motion.div
            key={row.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="grid grid-cols-[1fr_auto_auto] gap-3 text-sm items-center"
          >
            <span className="truncate text-slate-700">{row.name}</span>
            <span className="text-slate-400 text-xs">{row.total} ctrl</span>
            <CompliancePill percentage={row.percentage} />
          </motion.div>
        ))}
        {!rows.length && <div className="text-sm text-slate-400">No assigned data.</div>}
      </div>
    </Section>
  );
}

function CompliancePill({ percentage }) {
  const color = percentage >= 75 ? "#10b981" : percentage >= 50 ? "#f59e0b" : percentage > 0 ? "#ef4444" : "#94a3b8";
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
      {percentage}%
    </span>
  );
}

function Ranked({ values, label = (v) => v, danger = false, icon: Icon }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries.length ? entries[0][1] : 1;
  return (
    <div className="space-y-2.5">
      {entries.map(([key, value], i) => (
        <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.03 }}>
          <div className="flex justify-between text-sm items-center mb-1">
            <span className="flex items-center gap-1.5 truncate">
              {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${danger ? "text-red-500" : "text-slate-400"}`} />}
              <span className="truncate">{label(key)}</span>
            </span>
            <strong className={danger ? "text-red-700" : ""}>{value}</strong>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.03 }}
              className={`h-full rounded-full ${danger ? "bg-red-500" : "bg-indigo-500"}`}
            />
          </div>
        </motion.div>
      ))}
      {!entries.length && <div className="text-sm text-slate-400">No data.</div>}
    </div>
  );
}

function Rows({ rows }) {
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-slate-600">{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function countBy(values) {
  return values.filter(Boolean).reduce((result, value) => ({ ...result, [value]: (result[value] || 0) + 1 }), {});
}
function countAssignments(rows, field) {
  const result = {};
  rows.forEach((row) => (row[field] || []).forEach((id) => { result[id] = (result[id] || 0) + 1; }));
  return result;
}
function groupCompliance(controls, nameFor) {
  const groups = {};
  controls.forEach((control) => {
    const name = nameFor(control);
    if (!groups[name]) groups[name] = [];
    groups[name].push(control);
  });
  return Object.entries(groups)
    .map(([name, items]) => ({ name, total: items.length, percentage: computeComplianceMetrics(items).percentage }))
    .sort((a, b) => b.percentage - a.percentage);
}
function daysUntil(date) {
  return (new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000;
}
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      <div className="text-sm text-slate-400">Loading compliance posture…</div>
    </div>
  );
}