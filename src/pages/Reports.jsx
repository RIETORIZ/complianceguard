import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit, computeOverdueStatus } from "@/lib/compliance";
import { FileText, Download, Database, Printer } from "lucide-react";
import { isAcceptedReviewDecision, isOpenFindingStatus, isClosedCorrectionPlanStatus, normalizeReviewDecision, normalizeFindingStatus, normalizeCorrectionPlanStatus } from "@/lib/audit-workflow";

export default function Reports() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [report, setReport] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    base44.entities.Audit.list("-created_date", 500).then(setAudits).catch(console.error).finally(() => setLoading(false));
  }, []);

  const generateReport = async (auditId) => {
    setGenerating(auditId);
    try {
      const audit = await base44.entities.Audit.get(auditId);
      const [controls, requests, findings, plans, owners, domains, framework] = await Promise.all([
        base44.entities.AuditControl.filter({ audit_id: auditId }),
        base44.entities.EvidenceRequest.filter({ audit_id: auditId }),
        base44.entities.Finding.filter({ source_audit_id: auditId }),
        base44.entities.CorrectionPlan.filter({ audit_id: auditId }),
        base44.entities.Owner.list("full_name", 1000),
        audit.framework_id ? base44.entities.Domain.filter({ framework_id: audit.framework_id }) : base44.entities.Domain.list("name", 1000),
        audit.framework_id ? base44.entities.Framework.get(audit.framework_id) : null,
      ]);
      const submissions = requests.length ? await base44.entities.EvidenceSubmission.filter({ evidence_request_id: { $in: requests.map((request) => request.id) } }) : [];
      const mappings = submissions.length ? await base44.entities.EvidenceMapping.filter({ evidence_submission_id: { $in: submissions.map((submission) => submission.id) } }) : [];
      const html = buildAuditReport({ audit, framework, domains, controls, requests, submissions, mappings, findings, plans, owners, origin: window.location.origin });
      await logAudit({ action: "report_generated", recordType: "Audit", recordId: auditId, recordName: audit.name, comment: "Presentation-style HTML/PDF report generated", newValue: { controls: controls.length, requests: requests.length, findings: findings.length, generated_at: new Date().toISOString() } });
      setReport({ html, audit });
    } catch (error) { alert(`Report generation failed: ${error.message}`); }
    finally { setGenerating(null); }
  };

  const downloadReport = () => {
    const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(report.audit.name)}-audit-report.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => iframeRef.current?.contentWindow?.print();

  if (loading) return <Spinner />;
  return <div className="space-y-6 max-w-6xl mx-auto">
    <div><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="text-sm text-slate-500 mt-1">Generate presentation-style HTML reports and print them securely to PDF. Every control receives a dedicated page.</p></div>
    {!report ? <AuditSelector audits={audits} generating={generating} onGenerate={generateReport} /> : <div className="space-y-3"><div className="flex items-center justify-between flex-wrap gap-2"><button onClick={() => setReport(null)} className="text-sm text-slate-600">← Back to reports</button><div className="flex gap-2"><button onClick={printReport} className="flex items-center gap-1.5 text-sm border px-3 py-2 rounded-lg"><Printer className="w-4 h-4" />Print / Save PDF</button><button onClick={downloadReport} className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-2 rounded-lg"><Download className="w-4 h-4" />Download HTML</button></div></div><iframe ref={iframeRef} srcDoc={report.html} className="w-full h-[75vh] bg-white border rounded-xl" title="Audit Report" sandbox="allow-popups allow-popups-to-escape-sandbox" /></div>}
    <PowerBiModel />
  </div>;
}

function AuditSelector({ audits, generating, onGenerate }) { return <div className="bg-white rounded-xl border overflow-hidden"><div className="px-5 py-3 border-b text-sm font-medium">Select an audit</div><div className="divide-y">{audits.map((audit) => <div key={audit.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50"><div><div className="text-sm font-medium">{audit.name}</div><div className="text-xs text-slate-500">{audit.audit_type} · {audit.framework_code} · {audit.status}</div></div><button onClick={() => onGenerate(audit.id)} disabled={!!generating} className="flex gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"><FileText className="w-4 h-4" />{generating === audit.id ? "Generating…" : "Generate"}</button></div>)}{!audits.length && <div className="p-8 text-center text-sm text-slate-400">No audits available.</div>}</div></div>; }

function PowerBiModel() { const datasets = ["audits", "audit_types", "frameworks", "domains", "controls", "audit_controls", "expected_evidence", "evidence_conditions", "evidence_requests", "evidence_statuses", "evidence_submissions", "evidence_mappings", "compliance_statuses", "status_histories", "compliance_snapshots", "owners", "owner_groups", "organizational_units", "sites", "systems", "findings", "correction_plans", "audit_responses", "notifications", "audit_trail"]; return <div className="bg-white rounded-xl border p-5"><div className="flex items-center gap-2 mb-3"><Database className="w-5 h-5" /><h3 className="font-semibold">Power BI Reporting API</h3></div><p className="text-sm text-slate-600">Use the authenticated <code>reporting-export</code> backend function with a dataset name. Responses include <code>id</code> as the stable key, <code>updated_date</code> for incremental refresh, export timestamp, row count, and rows.</p><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">{datasets.map((dataset) => <div key={dataset} className="border rounded-lg px-2 py-1.5 text-xs font-mono">{dataset}</div>)}</div><div className="mt-3 text-xs bg-slate-50 rounded-lg p-3"><strong>Core relationships:</strong> Framework → Domain → Control → ExpectedEvidence → EvidenceCondition; Audit → AuditControl → EvidenceRequest → EvidenceSubmission → EvidenceMapping; Finding → CorrectionPlan; Owner → OrgUnit/Site/System.</div></div>; }

function buildAuditReport({ audit, framework, domains, controls, requests, submissions, mappings, findings, plans, owners, origin }) {
  const ownerName = (id) => owners.find((owner) => owner.id === id)?.full_name || "—";
  const requestsFor = (auditControlId) => requests.filter((request) => request.audit_control_id === auditControlId);
  const submissionsFor = (requestId) => submissions.filter((submission) => submission.evidence_request_id === requestId || mappings.some((mapping) => mapping.evidence_request_id === requestId && mapping.evidence_submission_id === submission.id)).sort((a, b) => Number(b.version) - Number(a.version));
  const included = controls.filter((control) => control.compliance_status !== "Not Applicable");
  const score = included.reduce((sum, control) => sum + (control.compliance_status === "Implemented" ? 1 : control.compliance_status === "Partially Implemented" ? 0.5 : 0), 0);
  const compliance = included.length ? Math.round(score / included.length * 100) : 0;
  const overdue = requests.filter((request) => computeOverdueStatus(request) === "Overdue");
  const accepted = requests.filter((request) => isAcceptedReviewDecision(request.review_decision || request.review_status));
  const byDomain = Object.groupBy ? Object.groupBy(controls, (control) => control.domain_id || "ungrouped") : controls.reduce((groups, control) => ({ ...groups, [control.domain_id || "ungrouped"]: [...(groups[control.domain_id || "ungrouped"] || []), control] }), {});
  const highRisks = findings.filter((finding) => ["high", "critical"].includes(finding.risk_rating));
  const controlPages = controls.map((control) => {
    const controlRequests = requestsFor(control.id);
    const controlFinding = findings.filter((finding) => finding.audit_control_id === control.id);
    const controlPlans = plans.filter((plan) => plan.control_id === control.control_id);
    const evidenceRows = controlRequests.map((request) => {
      const files = submissionsFor(request.id);
      const links = files.map((submission) => `<a href="${escapeAttribute(`${origin}/evidence/${submission.id}`)}">${escapeHtml(submission.display_title)} (v${escapeHtml(submission.version)})</a>`).join("<br>") || "—";
      return `<tr><td>${escapeHtml(request.title)}</td><td>${escapeHtml(computeOverdueStatus(request))}</td><td>${escapeHtml(normalizeReviewDecision(request.review_decision || request.review_status))}</td><td>${escapeHtml(request.request_date || "—")}</td><td>${escapeHtml(request.due_date || "—")}</td><td>${escapeHtml(formatDate(request.received_date))}</td><td>${links}</td></tr>`;
    }).join("");
    return `<section class="page control-page"><div class="eyebrow">Control assessment</div><h1>${escapeHtml(control.control_number || "Custom")} — ${escapeHtml(control.control_title)}</h1><div class="grid"><div><strong>Audit</strong><br>${escapeHtml(audit.name)}</div><div><strong>Framework</strong><br>${escapeHtml(audit.framework_code || "Custom")}</div><div><strong>Domain</strong><br>${escapeHtml(domains.find((domain) => domain.id === control.domain_id)?.name || "—")}</div><div><strong>Compliance status</strong><br>${escapeHtml(control.compliance_status)}</div><div><strong>Control owners</strong><br>${escapeHtml((control.control_level_owners || []).map(ownerName).join(", ") || "—")}</div><div><strong>Control closure</strong><br>${control.is_closed ? `Closed ${escapeHtml(control.closure_date || "")}` : "Open"}</div></div><h2>Control description</h2><p>${escapeHtml(control.control_title)}</p><h2>Evidence requests and files</h2>${evidenceRows ? `<table><thead><tr><th>Evidence</th><th>Request status</th><th>Review</th><th>Requested</th><th>Due</th><th>Received</th><th>Secure preview</th></tr></thead><tbody>${evidenceRows}</tbody></table>` : "<p>No evidence requests.</p>"}<p><strong>Evidence folder:</strong> <a href="${escapeAttribute(`${origin}/audits/${audit.id}#control-${control.id}`)}">Open control workspace</a></p><h2>Auditor comments</h2><p>${escapeHtml(control.auditor_comments || "—")}</p><h2>Findings and corrective actions</h2>${controlFinding.length ? controlFinding.map((finding) => `<p><strong>${escapeHtml(finding.title)}</strong> — ${escapeHtml(finding.severity)} / ${escapeHtml(normalizeFindingStatus(finding.status))}</p>`).join("") : "<p>No finding.</p>"}${controlPlans.length ? controlPlans.map((plan) => `<p><strong>${escapeHtml(plan.corrective_action)}</strong> — ${escapeHtml(normalizeCorrectionPlanStatus(plan.status))} / ${escapeHtml(plan.completion_percentage)}%</p>`).join("") : "<p>No corrective action.</p>"}</section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${escapeHtml(audit.name)} — Audit Report</title><style>${REPORT_CSS}</style></head><body><section class="cover page"><div><div class="eyebrow">Compliance Management Tool</div><h1>${escapeHtml(audit.name)}</h1><p>${escapeHtml(audit.audit_type)} · ${escapeHtml(framework?.code || audit.framework_code || "Custom")} · ${escapeHtml(audit.audit_year)}</p><p>Generated ${escapeHtml(new Date().toLocaleString())}</p></div></section><section class="page"><h1>1. Executive Summary</h1><p>The assessment covered ${controls.length} controls and ${requests.length} evidence requests. Compliance is ${compliance}% using implemented controls at full weight and partially implemented controls at half weight.</p><div class="stats"><div><b>${compliance}%</b><span>Compliance</span></div><div><b>${accepted.length}/${requests.length}</b><span>Accepted evidence</span></div><div><b>${overdue.length}</b><span>Overdue</span></div><div><b>${findings.length}</b><span>Findings</span></div></div><h1>2. Audit Scope</h1><p>${escapeHtml(audit.scope || "Not documented")}</p><h1>3. Overall Compliance Result</h1>${statusTable(controls)}<h1>4. Compliance by Domain</h1><table><thead><tr><th>Domain</th><th>Controls</th><th>Implemented</th><th>Partial</th><th>Score</th></tr></thead><tbody>${Object.entries(byDomain).map(([domainId, domainControls]) => { const applicable = domainControls.filter((control) => control.compliance_status !== "Not Applicable"); const weighted = applicable.reduce((sum, control) => sum + (control.compliance_status === "Implemented" ? 1 : control.compliance_status === "Partially Implemented" ? 0.5 : 0), 0); return `<tr><td>${escapeHtml(domains.find((domain) => domain.id === domainId)?.name || "—")}</td><td>${domainControls.length}</td><td>${domainControls.filter((control) => control.compliance_status === "Implemented").length}</td><td>${domainControls.filter((control) => control.compliance_status === "Partially Implemented").length}</td><td>${applicable.length ? Math.round(weighted / applicable.length * 100) : 0}%</td></tr>`; }).join("")}</tbody></table><h1>5. Evidence Submission Summary</h1>${evidenceSummary(requests)}<h1>6. Overdue Evidence Summary</h1>${overdue.length ? `<ul>${overdue.map((request) => `<li>${escapeHtml(request.title)} — due ${escapeHtml(request.due_date)}</li>`).join("")}</ul>` : "<p>No overdue evidence.</p>"}</section>${controlPages}<section class="page"><h1>8. Findings Summary</h1>${findingsTable(findings)}<h1>9. Correction-Plan Summary</h1>${plansTable(plans)}<h1>10. Key Risks</h1>${highRisks.length ? `<ul>${highRisks.map((finding) => `<li>${escapeHtml(finding.title)} — ${escapeHtml(finding.risk_rating)}</li>`).join("")}</ul>` : "<p>No open high or critical risk recorded.</p>"}<h1>11. Recommendations</h1><ol><li>Resolve overdue evidence and validate the correct organizational, site, and system scope.</li><li>Prioritize high and critical findings and overdue corrective actions.</li><li>Renew expiring evidence before dependent controls lose support.</li><li>Retain independent review decisions when one master evidence file supports multiple controls.</li></ol><h1>12. Audit Conclusion</h1><p>${escapeHtml(audit.name)} achieved ${compliance}% weighted compliance. ${overdue.length} evidence request(s) are overdue, ${findings.filter((finding) => isOpenFindingStatus(finding.status)).length} finding(s) remain open, and ${plans.filter((plan) => !isClosedCorrectionPlanStatus(plan.status)).length} corrective action(s) remain open.</p><footer>Secure preview links require authenticated, authorized access and enforce evidence confidentiality. Report generation is recorded in the immutable audit trail.</footer></section></body></html>`;
}

function statusTable(controls) { const statuses = ["Implemented", "Partially Implemented", "Not Implemented", "Not Applicable", "Under Evaluation"]; return `<table><thead><tr>${statuses.map((status) => `<th>${status}</th>`).join("")}</tr></thead><tbody><tr>${statuses.map((status) => `<td>${controls.filter((control) => control.compliance_status === status).length}</td>`).join("")}</tr></tbody></table>`; }
function evidenceSummary(requests) { const statuses = ["Requested", "Received", "Partially Received", "Require Further Comments", "Not Applicable", "Not Available", "Overdue"]; return `<table><thead><tr>${statuses.map((status) => `<th>${status}</th>`).join("")}</tr></thead><tbody><tr>${statuses.map((status) => `<td>${requests.filter((request) => computeOverdueStatus(request) === status).length}</td>`).join("")}</tr></tbody></table>`; }
function findingsTable(findings) { return findings.length ? `<table><thead><tr><th>Finding</th><th>Severity</th><th>Risk</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${findings.map((finding) => `<tr><td>${escapeHtml(finding.title)}</td><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.risk_rating)}</td><td>${escapeHtml(finding.owner_id || "—")}</td><td>${escapeHtml(finding.due_date || "—")}</td><td>${escapeHtml(normalizeFindingStatus(finding.status))}</td></tr>`).join("")}</tbody></table>` : "<p>No findings.</p>"; }
function plansTable(plans) { return plans.length ? `<table><thead><tr><th>Corrective action</th><th>Priority</th><th>Risk</th><th>Target</th><th>Progress</th><th>Status</th></tr></thead><tbody>${plans.map((plan) => `<tr><td>${escapeHtml(plan.corrective_action)}</td><td>${escapeHtml(plan.priority)}</td><td>${escapeHtml(plan.risk)}</td><td>${escapeHtml(plan.target_date || "—")}</td><td>${escapeHtml(plan.completion_percentage)}%</td><td>${escapeHtml(normalizeCorrectionPlanStatus(plan.status))}</td></tr>`).join("")}</tbody></table>` : "<p>No corrective actions.</p>"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value); }
function formatDate(value) { return value ? new Date(value).toLocaleDateString() : "—"; }
function safeFileName(value) { return String(value || "audit").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, ""); }
function Spinner() { return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }

const REPORT_CSS = `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:12px;line-height:1.45}.page{page-break-before:always;min-height:260mm;padding:10mm}.page:first-child{page-break-before:auto}.cover{background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;text-align:center}.cover h1{font-size:34px;margin:15px 0}.eyebrow{text-transform:uppercase;letter-spacing:2px;font-size:10px;color:#64748b}.cover .eyebrow{color:#94a3b8}h1{font-size:22px;border-bottom:2px solid #0f172a;padding-bottom:6px;margin:20px 0 10px}h2{font-size:14px;margin:18px 0 6px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.stats div{background:#f1f5f9;padding:12px;border-radius:8px;text-align:center}.stats b{font-size:22px;display:block}.stats span{font-size:10px;color:#64748b}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px;border-radius:8px}table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:10px}th,td{border:1px solid #dbe3ec;padding:5px;vertical-align:top;text-align:left}th{background:#eef2f7}a{color:#145da0;word-break:break-all}footer{margin-top:40px;color:#64748b;font-size:9px;border-top:1px solid #dbe3ec;padding-top:8px}@media print{a{color:#000;text-decoration:none}.page{padding:0}}`;
