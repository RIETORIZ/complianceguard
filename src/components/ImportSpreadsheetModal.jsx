import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/compliance";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Extracts rows from an uploaded CSV/Excel file via the ExtractData integration
export function ImportSpreadsheetModal({ auditId, audit, owners, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [step, setStep] = useState(1);
  const [mapping, setMapping] = useState({ control: "", evidence: "", owner: "", department: "", due_date: "", priority: "", severity: "", recommendation: "", corrective_action: "" });
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const FIELDS = [
    { key: "control", label: "Control / Requirement", required: true },
    { key: "evidence", label: "Expected Evidence", required: false },
    { key: "owner", label: "Owner (name)", required: false },
    { key: "department", label: "Department", required: false },
    { key: "due_date", label: "Due Date", required: false },
    { key: "priority", label: "Priority", required: false },
    { key: "severity", label: "Severity", required: false },
    { key: "recommendation", label: "Recommendation", required: false },
    { key: "corrective_action", label: "Corrective Action", required: false },
  ];

  const handleFile = async (f) => {
    setFile(f);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: "array", items: { type: "object", properties: { col1: { type: "string" }, col2: { type: "string" }, col3: { type: "string" }, col4: { type: "string" }, col5: { type: "string" }, col6: { type: "string" }, col7: { type: "string" }, col8: { type: "string" } } } },
      });
      const data = extracted.output || [];
      if (data.length === 0) { setErrors(["No rows found in file."]); return; }
      const cols = Object.keys(data[0]);
      setColumns(cols);
      setRows(data);
      // auto-match columns by name
      const auto = { ...mapping };
      cols.forEach((c) => {
        const cl = c.toLowerCase();
        if (!auto.control && (cl.includes("control") || cl.includes("requirement"))) auto.control = c;
        else if (!auto.evidence && cl.includes("evidence")) auto.evidence = c;
        else if (!auto.owner && (cl.includes("owner") || cl.includes("name"))) auto.owner = c;
        else if (!auto.department && cl.includes("department")) auto.department = c;
        else if (!auto.due_date && (cl.includes("due") || cl.includes("date"))) auto.due_date = c;
        else if (!auto.priority && cl.includes("priority")) auto.priority = c;
        else if (!auto.severity && cl.includes("severity")) auto.severity = c;
        else if (!auto.recommendation && cl.includes("recommend")) auto.recommendation = c;
        else if (!auto.corrective_action && (cl.includes("corrective") || cl.includes("action"))) auto.corrective_action = c;
      });
      setMapping(auto);
      setStep(2);
    } catch (e) {
      setErrors(["Failed to parse file: " + e.message]);
    }
  };

  const validate = () => {
    const errs = [];
    if (!mapping.control) errs.push("You must identify the control/requirement column.");
    const seen = new Set();
    rows.forEach((r, i) => {
      const val = r[mapping.control];
      if (!val || !String(val).trim()) errs.push(`Row ${i + 1}: blank control/requirement.`);
      else if (seen.has(val)) errs.push(`Row ${i + 1}: duplicate control "${val}".`);
      else seen.add(val);
    });
    setErrors(errs);
    return errs.length === 0;
  };

  const doImport = async () => {
    if (!validate()) return;
    setImporting(true);
    try {
      let created = 0;
      for (const r of rows) {
        const controlTitle = String(r[mapping.control] || "").trim();
        if (!controlTitle) continue;
        const ctrl = await base44.entities.Control.create({
          framework_id: audit.framework_id, title: controlTitle, control_number: "",
          official_text: String(r[mapping.recommendation] || r[mapping.control] || ""), control_type: "custom", is_custom: true,
          priority: r[mapping.priority] || "medium", active: true,
        });
        const ownerName = mapping.owner ? String(r[mapping.owner] || "").trim() : "";
        const matchedOwner = ownerName ? owners.find((o) => o.full_name.toLowerCase().includes(ownerName.toLowerCase())) : null;
        const ac = await base44.entities.AuditControl.create({
          audit_id: auditId, control_id: ctrl.id, framework_id: audit.framework_id, control_title: controlTitle,
          compliance_status: "Under Evaluation", due_date: mapping.due_date ? r[mapping.due_date] : "",
          control_level_owners: matchedOwner ? [matchedOwner.id] : [],
        });
        if (mapping.evidence && r[mapping.evidence]) {
          await base44.entities.ExpectedEvidence.create({ control_id: ctrl.id, framework_id: audit.framework_id, name: String(r[mapping.evidence]), is_mandatory: true });
          await base44.entities.EvidenceRequest.create({
            audit_id: auditId, audit_control_id: ac.id, control_id: ctrl.id, framework_id: audit.framework_id,
            title: String(r[mapping.evidence]), evidence_type: "Imported", status: "Requested", review_status: "awaiting_review",
            request_date: new Date().toISOString().slice(0, 10), due_date: mapping.due_date ? r[mapping.due_date] : "",
            assigned_owner_ids: matchedOwner ? [matchedOwner.id] : [], assigned_department_id: mapping.department ? r[mapping.department] : "",
            notification_method: "immediate",
          });
        }
        if (mapping.corrective_action && r[mapping.corrective_action]) {
          await base44.entities.CorrectionPlan.create({
            corrective_action: String(r[mapping.corrective_action]), audit_id: auditId, control_id: ctrl.id,
            primary_owner_id: matchedOwner?.id || "", priority: r[mapping.priority] || "medium", risk: r[mapping.severity] || "medium",
            target_date: mapping.due_date ? r[mapping.due_date] : "", status: "open", closure_decision: "pending",
          });
        }
        created++;
      }
      await logAudit({ action: "spreadsheet_import", recordType: "Audit", recordId: auditId, recordName: audit.name, comment: `Imported ${created} rows from ${file?.name}`, newValue: { rows: created, mapping } });
      setResult({ created });
      setStep(4);
      onDone && onDone();
    } catch (e) { setErrors(["Import failed: " + e.message]); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Import from Spreadsheet — Step {step}/4</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="text-center py-8">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-3">Upload an Excel or CSV file. Column names are not fixed — you'll map them next.</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFile(e.target.files[0])} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"><Upload className="w-4 h-4" /> Choose file</button>
                <button onClick={() => {
                  const csv = "Control,Expected Evidence,Owner,Department,Due Date,Priority,Severity,Recommendation,Corrective Action\nNetwork segmentation policy,Network diagram,Khalid Al-Harbi,Operations Technology,2026-12-31,high,medium,Document segmentation zones,Update diagram to include new VLANs\nBackup encryption,Encryption config screenshot,Fatima Al-Zahra,IT Infrastructure,2026-09-30,medium,low,Verify AES-256 enabled,\nPatch management procedure,Approved procedure PDF,Ahmed Al-Rashid,Cybersecurity Department,2026-11-15,high,high,Include emergency patch SLA,Revise procedure to add 24h emergency patching";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "sample-compliance-import.csv"; a.click();
                  URL.revokeObjectURL(url);
                }} className="text-xs text-slate-500 hover:text-slate-900 mt-2 underline">Download sample spreadsheet</button>
              </div>
              {errors.length > 0 && <div className="mt-3 text-xs text-red-600">{errors[0]}</div>}
            </div>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-slate-600">Found <strong>{rows.length}</strong> rows, <strong>{columns.length}</strong> columns. Map columns to fields:</p>
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-slate-600">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <select value={mapping[f.key]} onChange={(e) => setMapping((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">— none —</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr>{columns.map((c) => <th key={c} className="px-2 py-1 text-left font-medium text-slate-600">{c}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 5).map((r, i) => (<tr key={i} className="border-t border-slate-100">{columns.map((c) => <td key={c} className="px-2 py-1 text-slate-700 truncate max-w-[120px]">{String(r[c] ?? "")}</td>)}</tr>))}</tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400">Showing first 5 of {rows.length} rows for preview.</p>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="text-sm text-slate-600 px-4 py-2">Back</button>
                <button onClick={() => { if (validate()) setStep(3); }} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg">Validate & Continue</button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Validation complete</div>
              {errors.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">All {rows.length} rows validated. No blank or duplicate controls detected. Ready to import.</div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-amber-800 font-medium mb-1"><AlertTriangle className="w-4 h-4" /> Issues found ({errors.length}):</div>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                <div className="font-semibold mb-1">Will create per row:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Custom control {mapping.evidence && "+ expected evidence + evidence request"}</li>
                  {mapping.corrective_action && <li>Correction plan item (if corrective action column mapped)</li>}
                </ul>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="text-sm text-slate-600 px-4 py-2">Back</button>
                <button onClick={doImport} disabled={importing} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">{importing ? "Importing…" : `Confirm & Import ${rows.length} rows`}</button>
              </div>
            </>
          )}
          {step === 4 && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <div className="text-lg font-semibold text-slate-900">Import complete</div>
              <p className="text-sm text-slate-500 mt-1">{result?.created} records created successfully.</p>
              <button onClick={onClose} className="mt-4 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}