export const APP_ROLES = [
  "System Administrator",
  "Compliance Administrator",
  "Compliance Officer",
  "Auditor",
  "Auditee",
  "Control Owner",
  "Department Manager",
  "Division Manager",
  "Sector Manager",
  "External Auditor",
  "Executive Viewer",
];

const LEGACY_ROLE_MAP = {
  admin: "System Administrator",
  user: "Auditee",
};

export function normalizeRole(role) {
  return LEGACY_ROLE_MAP[role] || role || "Auditee";
}

export const PERMISSIONS = {
  dashboard_view: APP_ROLES,
  audits_view: APP_ROLES,
  audits_manage: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor"],
  frameworks_view: APP_ROLES,
  frameworks_manage: ["System Administrator", "Compliance Administrator"],
  evidence_submit: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Auditee", "Control Owner"],
  evidence_review: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "External Auditor"],
  findings_manage: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor"],
  correction_manage: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Control Owner", "Auditee"],
  owners_view: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Department Manager", "Division Manager", "Sector Manager"],
  owners_manage: ["System Administrator", "Compliance Administrator"],
  reports_view: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Department Manager", "Division Manager", "Sector Manager", "External Auditor", "Executive Viewer"],
  admin_view: ["System Administrator", "Compliance Administrator"],
  audit_trail_view: ["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor"],
};

export function hasPermission(user, permission) {
  const role = normalizeRole(user?.role);
  return (PERMISSIONS[permission] || []).includes(role);
}

export function canAccessRecordByScope(user, record = {}) {
  const role = normalizeRole(user?.role);
  if (["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor", "Executive Viewer"].includes(role)) return true;
  const data = user?.data || user || {};
  if (record.sector_id && data.sector_id && record.sector_id !== data.sector_id) return false;
  if (record.department_id && data.department_id && record.department_id !== data.department_id) return false;
  if (record.division_id && data.division_id && record.division_id !== data.division_id) return false;
  if (record.site_id && Array.isArray(data.site_ids) && data.site_ids.length && !data.site_ids.includes(record.site_id)) return false;
  if (record.system_id && Array.isArray(data.system_ids) && data.system_ids.length && !data.system_ids.includes(record.system_id)) return false;
  return true;
}

const CLEARANCE = { public: 0, internal: 1, confidential: 2, restricted: 3 };
export function canViewEvidence(user, submission = {}, request = {}) {
  const role = normalizeRole(user?.role);
  if (["System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor"].includes(role)) return true;
  const userData = user?.data || user || {};
  const userClearance = CLEARANCE[userData.evidence_clearance || "internal"] ?? 1;
  const evidenceLevel = CLEARANCE[submission.confidentiality_classification || "confidential"] ?? 2;
  if (evidenceLevel > userClearance) return false;
  if (submission.uploaded_by_id === user?.id || submission.owner_id === userData.owner_id) return true;
  if ((request.assigned_owner_ids || []).includes(userData.owner_id)) return true;
  return canAccessRecordByScope(user, request);
}
