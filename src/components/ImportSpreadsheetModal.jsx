import React, { useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { base44 } from "@/api/base44Client";
import { logAudit, dispatchNotification } from "@/lib/compliance";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

const FIELD_DEFS = [
  { key: "control_number", label: "Control / Requirement Number" },
  { key: "control", label: "Control / Requirement Description", required: true },
  { key: "evidence", label: "Requested Evidence", required: true },
  { key: "evidence_conditions", label: "Evidence Conditions" },
  { key: "owner", label: "Owner" },
  { key: "department", label: "Department" },
  { key: "due_date", label: "Due Date" },
  { key: "priority", label: "Priority" },
  { key: "severity", label: "Severity / Risk" },
  { key: "recommendation", label: "Recommendation" },
  { key: "corrective_action", label: "Corrective Action" },
];

export function ImportSpreadsheetModal({ auditId, audit, owners, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [step, setStep] = useState(1);
  const [mapping, setMapping] = useState(Object.fromEntries(FIELD_DEFS.map((f) => [f.key, ""])));
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  const autoMap = (headers) => {
    const next = Object.fromEntries(FIELD_DEFS.map((f) => [f.key, ""]));
    const tests = {
      control_number: ["control number", "requirement number", "control id", "reference"],
      control: ["control description", "requirement description", "requirement", "control"],
      evidence: ["requested evidence", "expected evidence", "evidence"],
      evidence_conditions: ["acceptance criteria", "evidence conditions", "conditions"],
      owner: ["owner", "assignee", "responsible"],
      department: ["department", "dept"],
      due_date: ["due date", "target date", "deadline"],
      priority: ["priority"], severity: ["severity", "risk"],
      recommendation: ["recommendation"], corrective_action: ["corrective action", "remediation", "action"],
    };
    for (const [key, candidates] of Object.entries(tests)) {
      next[key] = headers.find((h) => candidates.some((c) => String(h).trim().toLowerCase() === c)) ||
        headers.find((h) => candidates.some((c) => String(h).toLowerCase().includes(c))) || "";
    }
    return next;
  };

  const handleFile = async (selected) => {
    if (!selected) return;
    setFile(selected); setErrors([]); setWarnings([]);
    try {
      let matrix;
      if (selected.name.toLowerCase().endsWith(".csv")) {
        const text = await selected.text();
        matrix = parseCsv(text);
      } else {
        matrix = await readXlsxFile(selected);
      }
      if (!matrix?.length || matrix.length < 2) throw new Error("No data rows were found in the first worksheet.");
      const headers = matrix[0].map((value, index) => String(value || `Column ${index + 1}`).trim());
      const parsed = matrix.slice(1).filter((row) => row.some((value) => String(value ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])));
      if (!parsed.length) throw new Error("The worksheet contains headers but no data rows.");
      setColumns(headers); setRows(parsed); setMapping(autoMap(headers)); setStep(2);
    } catch (error) {
      setErrors([`Unable to parse the file: ${error.message}`]);
    }
  };

  const validate = () => {
    const nextErrors = [];
    const nextWarnings = [];
    if (!mapping.control) nextErrors.push("Map the control/requirement description column.");
    if (!mapping.evidence) nextErrors.push("Map the requested-evidence column.");
    if (!mapping.control || !mapping.evidence) { setErrors(nextErrors); return false; }
    const seen = new Map();
    rows.forEach((row, index) => {
      const line = index + 2;
      const control = String(row[mapping.control] ?? "").trim();
      const evidence = String(row[mapping.evidence] ?? "").trim();
      const number = mapping.control_number ? String(row[mapping.control_number] ?? "").trim() : "";
      const duplicateKey = `${number}|${control}`.toLowerCase();
      if (!control) nextErrors.push(`Row ${line}: control/requirement is blank.`);
      if (!evidence) nextErrors.push(`Row ${line}: requested evidence is blank.`);
      if (control && seen.has(duplicateKey)) nextErrors.push(`Row ${line}: duplicate requirement (first seen on row ${seen.get(duplicateKey)}).`);
      if (control) seen.set(duplicateKey, line);
      if (mapping.priority && row[mapping.priority] && !["low", "medium", "high", "critical"].includes(String(row[mapping.priority]).toLowerCase())) nextWarnings.push(`Row ${line}: unknown priority will default to medium.`);
      if (mapping.severity && row[mapping.severity] && !["low", "medium", "high", "critical"].includes(String(row[mapping.severity]).toLowerCase())) nextWarnings.push(`Row ${line}: unknown severity will default to medium.`);
    });
    setErrors(nextErrors); setWarnings(nextWarnings);
    return nextErrors.length === 0;
  };

  const doImport = async () => {
    if (!validate()) return;
    setImporting(true);
    try {
      const orgUnits = await base44.entities.OrgUnit.list("name", 500);
      let created = 0;
      for (const row of rows) {
        const title = String(row[mapping.control] || "").trim();
        const number = mapping.control_number ? String(row[mapping.control_number] || "").trim() : "";
        const evidenceName = String(row[mapping.evidence] || "").trim();
        const priorityRaw = mapping.priority ? String(row[mapping.priority] || "").toLowerCase() : "medium";
        const severityRaw = mapping.severity ? String(row[mapping.severity] || "").toLowerCase() : "medium";
        const priority = ["low", "medium", "high", "critical"].includes(priorityRaw) ? priorityRaw : "medium";
        const severity = ["low", "medium", "high", "critical"].includes(severityRaw) ? severityRaw : "medium";
        const ownerText = mapping.owner ? String(row[mapping.owner] || "").trim().toLowerCase() : "";
        const owner = ownerText ? owners.find((o) => o.full_name?.toLowerCase() === ownerText || o.work_email?.toLowerCase() === ownerText || o.employee_number?.toLowerCase() === ownerText) : null;
        const departmentText = mapping.department ? String(row[mapping.department] || "").trim().toLowerCase() : "";
        const department = departmentText ? orgUnits.find((u) => u.type === "department" && (u.name?.toLowerCase() === departmentText || u.code?.toLowerCase() === departmentText)) : null;
        const requirementText = mapping.recommendation ? String(row[mapping.recommendation] || "").trim() : title;
        const ctrl = await base44.entities.Control.create({
          framework_id: audit.framework_id || "", control_number: number, title,
          custom_requirement_text: requirementText, official_text: "", control_type: "custom", is_custom: true,
          priority, active: true,
        });
        const auditControl = await base44.entities.AuditControl.create({
          audit_id: auditId, control_id: ctrl.id, framework_id: audit.framework_id || "", control_number: number,
          control_title: title, compliance_status: "Under Evaluation", due_date: mapping.due_date ? String(row[mapping.due_date] || "") : "",
          control_level_owners: owner ? [owner.id] : [],
        });
        const expected = await base44.entities.ExpectedEvidence.create({
          control_id: ctrl.id, framework_id: audit.framework_id || "", evidence_type: "Imported", name: evidenceName,
          description: "Imported requested evidence", is_mandatory: true, allow_reuse: true,
        });
        const conditionsText = mapping.evidence_conditions ? String(row[mapping.evidence_conditions] || "") : "";
        const conditionItems = conditionsText.split(/\r?\n|;|\|/).map((x) => x.trim()).filter(Boolean);
        if (conditionItems.length) await base44.entities.EvidenceCondition.bulkCreate(conditionItems.map((name) => ({ expected_evidence_id: expected.id, control_id: ctrl.id, name, is_mandatory: true, active: true })));
        const request = await base44.entities.EvidenceRequest.create({
          audit_id: auditId, audit_control_id: auditControl.id, control_id: ctrl.id, framework_id: audit.framework_id || "", expected_evidence_id: expected.id,
          title: evidenceName, evidence_type: "Imported", status: "Requested", review_status: "awaiting_review",
          request_date: new Date().toISOString().slice(0, 10), due_date: mapping.due_date ? String(row[mapping.due_date] || "") : "",
          assigned_owner_ids: owner ? [owner.id] : [], assigned_department_id: department?.id || "", notification_method: "immediate",
          status_history: [{ status: "Requested", changed_by: "import", changed_at: new Date().toISOString(), comment: `Imported from ${file?.name}` }],
        });
        if (owner) await dispatchNotification({ recipientId: owner.id, recipientEmail: owner.work_email, type: "new_evidence_request", title: `Imported evidence request: ${evidenceName}`, body: `${audit.name} — ${title}`, relatedRecordType: "EvidenceRequest", relatedRecordId: request.id, link: `/audits/${auditId}` });
        const correctiveAction = mapping.corrective_action ? String(row[mapping.corrective_action] || "").trim() : "";
        if (correctiveAction) await base44.entities.CorrectionPlan.create({ corrective_action: correctiveAction, audit_id: auditId, control_id: ctrl.id, primary_owner_id: owner?.id || "", priority, risk: severity, target_date: mapping.due_date ? String(row[mapping.due_date] || "") : "", completion_percentage: 0, required_closure_evidence: evidenceName, status: "open", closure_decision: "pending" });
        created += 1;
      }
      await logAudit({ action: "spreadsheet_import", recordType: "Audit", recordId: auditId, recordName: audit.name, comment: `Imported ${created} validated rows from ${file?.name}`, newValue: { rows: created, mapping } });
      setResult({ created }); setStep(4); onDone?.();
    } catch (error) { setErrors([`Import failed: ${error.message}`]); }
    finally { setImporting(false); }
  };

  return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
    <div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">Spreadsheet Import — Step {step}/4</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
    <div className="p-6 space-y-4">
      {step === 1 && <div className="border-2 border-dashed rounded-xl p-10 text-center"><FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" /><p className="text-sm text-slate-500 my-3">Upload CSV, XLS, or XLSX. Original headers are preserved and mapped by you.</p><input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} /><button onClick={() => fileRef.current?.click()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm inline-flex gap-2"><Upload className="w-4 h-4" />Choose file</button></div>}
      {step === 2 && <><div className="grid md:grid-cols-2 gap-3">{FIELD_DEFS.map((field) => <label key={field.key} className="text-xs font-medium text-slate-600">{field.label}{field.required && <span className="text-red-500"> *</span>}<select value={mapping[field.key]} onChange={(e) => setMapping((p) => ({ ...p, [field.key]: e.target.value }))} className="w-full mt-1 border rounded-lg px-2 py-2 text-sm"><option value="">— not mapped —</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>)}</div><Preview columns={columns} rows={previewRows} total={rows.length} /><div className="flex justify-between"><button onClick={() => setStep(1)} className="text-sm px-4 py-2">Back</button><button onClick={() => validate() && setStep(3)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Validate</button></div></>}
      {step === 3 && <><div className="flex gap-2 items-center text-sm"><CheckCircle2 className="w-5 h-5 text-emerald-600" />{rows.length} rows validated and ready for confirmation.</div>{warnings.length > 0 && <IssueBox title="Warnings" items={warnings} warning /> }<div className="bg-slate-50 p-4 rounded-lg text-sm">The import will create a custom control, expected-evidence item, evidence request, acceptance conditions, owner assignments, and optional corrective action for each row.</div><div className="flex justify-between"><button onClick={() => setStep(2)} className="text-sm px-4 py-2">Back</button><button onClick={doImport} disabled={importing} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{importing ? "Importing…" : `Confirm & import ${rows.length} rows`}</button></div></>}
      {step === 4 && <div className="text-center py-10"><CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" /><h3 className="font-semibold mt-3">Import complete</h3><p className="text-sm text-slate-500">{result?.created} requirements created.</p><button onClick={onClose} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Done</button></div>}
      {errors.length > 0 && <IssueBox title="Errors" items={errors} />}
    </div>
  </div></div>;
}

function Preview({ columns, rows, total }) { return <div><div className="overflow-auto max-h-64 border rounded-lg"><table className="w-full text-xs"><thead className="bg-slate-50 sticky top-0"><tr>{columns.map((c) => <th key={c} className="text-left px-2 py-2">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t">{columns.map((c) => <td key={c} className="px-2 py-1.5 max-w-56 truncate">{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table></div><p className="text-[11px] text-slate-400 mt-1">Showing {rows.length} of {total} rows.</p></div>; }
function IssueBox({ title, items, warning = false }) { return <div className={`${warning ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"} border rounded-lg p-3`}><div className="font-medium text-sm flex gap-2"><AlertTriangle className="w-4 h-4" />{title} ({items.length})</div><ul className="text-xs list-disc list-inside mt-1 max-h-40 overflow-auto">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div>; }

function normalizeCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return value == null ? "" : String(value).trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
