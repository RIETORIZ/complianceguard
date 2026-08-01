export function isFileNameMeaningful(fileName) {
  if (!fileName) return false;
  const base = fileName.replace(/\.[^/.]+$/, "");
  if (base.length < 5) return false;
  const vowels = (base.match(/[aeiouAEIOU]/g) || []).length;
  const vowelRatio = vowels / base.length;
  const hasLongConsonantCluster = /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(base);
  if (base.length >= 15 && vowelRatio < 0.15 && hasLongConsonantCluster) return false;
  if (hasLongConsonantCluster && vowelRatio < 0.2 && !base.includes(" ") && !base.includes("_") && !base.includes("-")) return false;
  return true;
}

export function suggestEvidenceName({ frameworkCode, controlNumber, evidenceType, system, date }) {
  const parts = [];
  if (frameworkCode) parts.push(frameworkCode);
  if (controlNumber) parts.push(controlNumber.replace(/[^a-zA-Z0-9-]/g, "-"));
  if (evidenceType) parts.push(evidenceType.replace(/[^a-zA-Z0-9]/g, "_"));
  if (system) parts.push(system.replace(/[^a-zA-Z0-9]/g, "_"));
  parts.push(date || new Date().toISOString().slice(0, 4));
  return parts.join("_");
}

export function computeOverdueStatus(request, now = new Date()) {
  const excludedStates = ["Received", "Partially Received", "Not Applicable", "Not Available"];
  if (request.exclude_from_overdue || excludedStates.includes(request.status)) return request.status;
  if (!request.due_date) return request.status;
  const due = new Date(`${request.due_date}T23:59:59`);
  return due < now ? "Overdue" : request.status;
}

export function computeEvidenceMetrics(requests) {
  const counts = { Requested: 0, Received: 0, "Partially Received": 0, "Require Further Comments": 0, "Not Applicable": 0, "Not Available": 0, Overdue: 0, awaiting_review: 0, accepted: 0, rejected: 0, expiring_soon: 0 };
  requests.forEach((request) => {
    const status = computeOverdueStatus(request);
    if (counts[status] !== undefined) counts[status] += 1;
    if (request.review_status === "awaiting_review" && ["Received", "Partially Received"].includes(status)) counts.awaiting_review += 1;
    if (["accepted", "accepted_with_observation"].includes(request.review_status)) counts.accepted += 1;
    if (request.review_status === "rejected") counts.rejected += 1;
  });
  return counts;
}

export function computeComplianceMetrics(controls) {
  const counts = { "Under Evaluation": 0, Implemented: 0, "Partially Implemented": 0, "Not Implemented": 0, "Not Applicable": 0 };
  let total = 0;
  let implemented = 0;
  controls.forEach((control) => {
    if (counts[control.compliance_status] !== undefined) counts[control.compliance_status] += 1;
    if (control.compliance_status === "Not Applicable") return;
    total += 1;
    if (control.compliance_status === "Implemented") implemented += 1;
    if (control.compliance_status === "Partially Implemented") implemented += 0.5;
  });
  return { counts, percentage: total ? Math.round((implemented / total) * 100) : 0, total };
}

export function evidenceValidityStatus(expiryDate, now = new Date()) {
  if (!expiryDate) return "Under Review";
  const expiry = new Date(`${expiryDate}T23:59:59`);
  if (expiry < now) return "Expired";
  const days = (expiry.getTime() - now.getTime()) / 86400000;
  return days <= 30 ? "Expiring Soon" : "Valid";
}
