import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { logAudit, computeOverdueStatus } from "@/lib/compliance";
import { FileText, Download, Database, History, Play, AlertTriangle, CheckCircle2, ShieldCheck, Lock, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Reports() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [reportHtml, setReportHtml] = useState(null);

  const load = async () => {
    try { setAudits(await base44.entities.Audit.list("-created_date", 200)); } catch (e) {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generateReport = async (auditId) => {
    setGenerating(auditId);
    try {
      const [audit, controls, requests, submissions, findings, plans, framework, domains, owners] = await Promise.all([
        base44.entities.Audit.get(auditId),
        base44.entities.AuditControl.filter({ audit_id: auditId }),
        base44.entities.EvidenceRequest.filter({ audit_id: auditId }),
        base44.entities.EvidenceSubmission.filter({ evidence_request_id: { $in: (await base44.entities.EvidenceRequest.filter({ audit_id: auditId })).map((r) => r.id) } }),
        base44.entities.Finding.filter({ source_audit_id: auditId }),
        base44.entities.CorrectionPlan.filter({ audit_id: auditId }),
        audit.framework_id ? base44.entities.Framework.get(audit.framework_id) : null,
        base44.entities.Domain.filter({ framework_id: audit.framework_id }),
        base44.entities.Owner.list("-created_date", 200),
      ]);
      const ownerName = (id) => owners.find((o) => o.id === id)?.full_name || "—";
      const reqsFor = (acId) => requests.filter((r) => r.audit_control_id === acId);
      const subsFor = (reqId) => submissions.filter((s) => s.evidence_request_id === reqId).sort((a, b) => b.version - a.version);
      const implemented = controls.filter((c) => c.compliance_status === "Implemented").length;
      const total = controls.filter((c) => c.compliance_status !== "Not Applicable").length;
      const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;
      const overdueReqs = requests.filter((r) => computeOverdueStatus(r) === "Overdue");

      // group controls by domain
      const byDomain = {};
      controls.forEach((c) => { const k = c.domain_id || "ungrouped"; byDomain[k] = byDomain[k] || []; byDomain[k].push(c); });

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${audit.name} — Audit Report</title>
<style>
body{font-family:system-ui,sans-serif;color:#1e293b;max-width:900px;margin:0 auto;padding:40px;line-height:1.6}
h1{font-size:28px;border-bottom:3px solid #0f172a;padding-bottom:10px}
h2{font-size:20px;margin-top:32px;border-bottom:1px solid #cbd5e1;padding-bottom:6px}
h3{font-size:15px;margin-top:24px}
.cover{text-align:center;padding:80px 0;background:#0f172a;color:#fff;margin:-40px -40px 30px}
.cover h1{border:none;color:#fff;font-size:34px}
.cover .sub{color:#94a3b8;margin-top:8px}
.page-break{page-break-before:always}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.stat{display:inline-block;margin-right:24px;text-align:center}
.stat .num{font-size:24px;font-weight:700}
.stat .lbl{font-size:11px;color:#64748b}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}
th{background:#f1f5f9}
.control-card{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:12px 0}
</style></head><body>
<div class="cover"><h1>${audit.name}</h1><div class="sub">${audit.audit_type} · ${framework?.code || ""} · ${audit.audit_year}</div><div class="sub">Generated ${new Date().toLocaleString()}</div></div>
<h2>1. Executive Summary</h2>
<p>This report presents the findings of the ${audit.name} assessment against the ${framework?.name || audit.framework_code} framework. The audit covered ${controls.length} controls with ${requests.length} evidence requests.</p>
<div><span class="stat"><div class="num">${pct}%</div><div class="lbl">Overall Compliance</div></span>
<span class="stat"><div class="num">${implemented}/${total}</div><div class="lbl">Implemented</div></span>
<span class="stat"><div class="num">${overdueReqs.length}</div><div class="lbl">Overdue</div></span>
<span class="stat"><div class="num">${findings.length}</div><div class="lbl">Findings</div></span></div>
<h2>2. Audit Scope</h2><p>${audit.scope || "—"}</p>
<h2>3. Overall Compliance Result</h2><p>Overall compliance: <strong>${pct}%</strong></p>
<h2>4. Compliance by Domain</h2>
<table><tr><th>Domain</th><th>Controls</th><th>Implemented</th><th>Compliance</th></tr>
${Object.entries(byDomain).map(([dId, ctrls]) => { const dn = domains.find((d) => d.id === dId)?.name || "—"; const imp = ctrls.filter((c) => c.compliance_status === "Implemented").length; const t = ctrls.filter((c) => c.compliance_status !== "Not Applicable").length; return `<tr><td>${dn}</td><td>${ctrls.length}</td><td>${imp}</td><td>${t > 0 ? Math.round(imp / t * 100) : 0}%</td></tr>`; }).join("")}</table>
<h2>5. Evidence Submission Summary</h2>
<table><tr><th>Evidence</th><th>Status</th><th>Review</th><th>Owner</th><th>Due</th></tr>
${requests.map((r) => `<tr><td>${r.title}</td><td>${computeOverdueStatus(r)}</td><td>${r.review_status}</td><td>${(r.assigned_owner_ids || []).map(ownerName).join(", ")}</td><td>${r.due_date || "—"}</td></tr>`).join("")}</table>
<h2>6. Overdue Evidence Summary</h2>
${overdueReqs.length === 0 ? "<p>No overdue evidence.</p>" : `<ul>${overdueReqs.map((r) => `<li>${r.title} — due ${r.due_date}</li>`).join("")}</ul>`}
<div class="page-break"></div>
<h2>7. Control Details</h2>
${controls.map((c, i) => { const rqs = reqsFor(c.id); return `<div class="control-card"><h3>${c.control_number || ""} ${c.control_title}</h3>
<p><strong>Compliance:</strong> ${c.compliance_status} · <strong>Owners:</strong> ${(c.control_level_owners || []).map(ownerName).join(", ") || "—"} · <strong>Due:</strong> ${c.due_date || "—"}</p>
${c.auditor_comments ? `<p><em>Auditor comments:</em> ${c.auditor_comments}</p>` : ""}
${rqs.length ? `<table><tr><th>Evidence</th><th>Status</th><th>Received</th><th>Files</th></tr>${rqs.map((r) => { const ss = subsFor(r.id); return `<tr><td>${r.title}</td><td>${computeOverdueStatus(r)}</td><td>${r.received_date ? new Date(r.received_date).toLocaleDateString() : "—"}</td><td>${ss.map((s) => `<a href="${s.file_url}" target="_blank">${s.display_title} (v${s.version})</a>`).join(", ") || "—"}</td></tr>`; }).join("")}</table>` : "<p>No evidence requests.</p>"}
${findings.find((f) => f.audit_control_id === c.id) ? `<p><strong>Finding:</strong> ${findings.find((f) => f.audit_control_id === c.id).title} (${findings.find((f) => f.audit_control_id === c.id).status})</p>` : ""}
${plans.find((p) => p.control_id === c.control_id) ? `<p><strong>Corrective action:</strong> ${plans.find((p) => p.control_id === c.control_id).corrective_action} (${plans.find((p) => p.control_id === c.control_id).status}, ${plans.find((p) => p.control_id === c.control_id).completion_percentage}%)</p>` : ""}
</div>`; }).join("")}
<h2>8. Findings Summary</h2>
${findings.length === 0 ? "<p>No findings.</p>" : `<table><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Due</th></tr>${findings.map((f) => `<tr><td>${f.title}</td><td>${f.severity}</td><td>${f.status}</td><td>${f.due_date || "—"}</td></tr>`).join("")}</table>`}
<h2>9. Correction Plan Summary</h2>
${plans.length === 0 ? "<p>No corrective actions.</p>" : `<table><tr><th>Action</th><th>Priority</th><th>Progress</th><th>Status</th></tr>${plans.map((p) => `<tr><td>${p.corrective_action}</td><td>${p.priority}</td><td>${p.completion_percentage}%</td><td>${p.status}</td></tr>`).join("")}</table>`}
<h2>10. Key Risks</h2><ul>${findings.filter((f) => f.risk_rating === "high" || f.risk_rating === "critical").map((f) => `<li>${f.title} (${f.risk_rating})</li>`).join("") || "<li>No high-risk findings.</li>"}</ul>
<h2>11. Recommendations</h2><p>Address all overdue evidence requests, remediate high-severity findings, and complete corrective actions before target dates.</p>
<h2>12. Audit Conclusion</h2><p>The ${audit.name} assessment achieved ${pct}% overall compliance. ${overdueReqs.length > 0 ? `${overdueReqs.length} evidence items are overdue and require immediate attention. ` : ""}${findings.length} findings were identified and require remediation.</p>
<p style="margin-top:40px;color:#94a3b8;font-size:11px">Generated by Compliance Management Tool. Evidence preview links are access-controlled; unauthorized users cannot view restricted evidence.</p>
</body></html>`;
      await logAudit({ action: "report_generated", recordType: "Audit", recordId: auditId, recordName: audit.name, comment: "HTML audit report generated" });
      setReportHtml(html);
    } catch (e) { alert("Report generation failed: " + e.message); }
    finally { setGenerating(null); }
  };

  const downloadReport = () => {
    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-report.html"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Generate presentation-style audit reports (HTML/PDF). Extensible to PPTX. Evidence preview links are access-controlled.</p>
      </div>

      {!reportHtml ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">Select an audit to generate its report</div>
          <div className="divide-y divide-slate-100">
            {audits.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-500">{a.audit_type} · {a.framework_code}</div>
                </div>
                <button onClick={() => generateReport(a.id)} disabled={generating} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <FileText className="w-4 h-4" /> {generating === a.id ? "Generating…" : "Generate"}
                </button>
              </div>
            ))}
            {audits.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No audits available.</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setReportHtml(null)} className="text-sm text-slate-600 hover:text-slate-900">← Back to reports</button>
            <button onClick={downloadReport} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg"><Download className="w-4 h-4" /> Download HTML</button>
          </div>
          <iframe srcDoc={reportHtml} className="w-full h-[70vh] bg-white border border-slate-200 rounded-xl" title="Audit Report" />
        </div>
      )}

      {/* Power BI reporting model */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3"><Database className="w-5 h-5 text-slate-700" /><h3 className="font-semibold text-slate-900">Power BI Reporting Model</h3></div>
        <p className="text-sm text-slate-600 mb-3">The platform exposes all entities as stable-ID relational tables. Connect Power BI via the Base44 API/OData endpoint using your app's API key. Recommended star schema:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {["Framework", "Domain", "Control", "ExpectedEvidence", "EvidenceCondition", "Audit", "AuditControl", "EvidenceRequest", "EvidenceSubmission", "Finding", "CorrectionPlan", "Owner", "OrgUnit", "Site", "System", "Notification", "AuditTrail"].map((t) => (
            <div key={t} className="border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono">{t}</div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <strong>Relational keys:</strong> Framework.id → Domain.framework_id → Control.(framework_id, domain_id) → ExpectedEvidence.control_id → EvidenceCondition.expected_evidence_id. Audit.id → AuditControl.audit_id → EvidenceRequest.audit_control_id → EvidenceSubmission.evidence_request_id. Owner.id ↔ OrgUnit (sector/department/division). All tables include id, created_date, updated_date, created_by_id.
        </div>
      </div>
    </div>
  );
}