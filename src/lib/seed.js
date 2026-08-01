import { base44 } from "@/api/base44Client";

// Seeds the database with realistic compliance demonstration data.
// Idempotent-ish: checks for existing frameworks before seeding.
export async function seedDatabase(onProgress) {
  const log = (msg) => onProgress && onProgress(msg);
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  // 1. Org hierarchy
  log("Creating organizational hierarchy…");
  const sectors = await base44.entities.OrgUnit.bulkCreate([
    { type: "sector", name: "Energy Sector", code: "ES", active: true },
    { type: "sector", name: "Digital Sector", code: "DS", active: true },
  ]);
  const sectorEnergy = sectors.find((s) => s.name === "Energy Sector");
  const sectorDigital = sectors.find((s) => s.name === "Digital Sector");

  const departments = await base44.entities.OrgUnit.bulkCreate([
    { type: "department", name: "Cybersecurity Department", code: "CSD", parent_id: sectorEnergy.id, active: true },
    { type: "department", name: "Operations Technology", code: "OT", parent_id: sectorEnergy.id, active: true },
    { type: "department", name: "IT Infrastructure", code: "ITI", parent_id: sectorDigital.id, active: true },
  ]);
  const deptCyber = departments[0];
  const deptOT = departments[1];
  const deptIT = departments[2];

  const divisions = await base44.entities.OrgUnit.bulkCreate([
    { type: "division", name: "Governance Division", parent_id: deptCyber.id, active: true },
    { type: "division", name: "OT Security Division", parent_id: deptOT.id, active: true },
    { type: "division", name: "Cloud Services Division", parent_id: deptIT.id, active: true },
  ]);

  // 2. Sites & Systems
  log("Creating sites and systems…");
  const sites = await base44.entities.Site.bulkCreate([
    { name: "Plant 1 — Riyadh Refinery", code: "P1", type: "Plant", location: "Riyadh", active: true },
    { name: "Plant 2 — Jeddah Facility", code: "P2", type: "Plant", location: "Jeddah", active: true },
    { name: "Headquarters", code: "HQ", type: "Office", location: "Riyadh", active: true },
  ]);
  const systems = await base44.entities.System.bulkCreate([
    { name: "Active Directory", code: "AD", criticality: "critical", active: true },
    { name: "SCADA Network", code: "SCADA", criticality: "critical", active: true },
    { name: "Cloud IAM", code: "CIAM", criticality: "high", active: true },
  ]);

  // 3. Groups
  const groups = await base44.entities.OwnerGroup.bulkCreate([
    { name: "OT Security Team", active: true, member_ids: [] },
    { name: "Cloud Governance Team", active: true, member_ids: [] },
  ]);

  // 4. Owners
  log("Creating owners…");
  const owners = await base44.entities.Owner.bulkCreate([
    { full_name: "Ahmed Al-Rashid", employee_number: "EMP-1001", job_title: "Compliance Officer", work_email: "ahmed.rashid@nca-demo.local", phone: "+96650000001", sector_id: sectorEnergy.id, department_id: deptCyber.id, division_id: divisions[0].id, active: true, is_primary_accountable: true, assigned_sites: [sites[2].id], assigned_systems: [systems[0].id] },
    { full_name: "Sarah Al-Otaibi", employee_number: "EMP-1002", job_title: "Lead Auditor", work_email: "sarah.otaibi@nca-demo.local", phone: "+96650000002", sector_id: sectorEnergy.id, department_id: deptCyber.id, division_id: divisions[0].id, active: true, assigned_systems: [systems[0].id] },
    { full_name: "Khalid Al-Harbi", employee_number: "EMP-1003", job_title: "OT Security Manager", work_email: "khalid.harbi@nca-demo.local", phone: "+96650000003", sector_id: sectorEnergy.id, department_id: deptOT.id, division_id: divisions[1].id, active: true, assigned_sites: [sites[0].id, sites[1].id], assigned_systems: [systems[1].id] },
    { full_name: "Fatima Al-Zahra", employee_number: "EMP-1004", job_title: "Control Owner", work_email: "fatima.zahra@nca-demo.local", phone: "+96650000004", sector_id: sectorDigital.id, department_id: deptIT.id, division_id: divisions[2].id, active: true, assigned_systems: [systems[2].id] },
    { full_name: "Mohammed Al-Qahtani", employee_number: "EMP-1005", job_title: "Division Manager", work_email: "mohammed.q@nca-demo.local", phone: "+96650000005", sector_id: sectorEnergy.id, department_id: deptOT.id, division_id: divisions[1].id, active: false },
  ]);
  const [ahmed, sarah, khalid, fatima, mohammed] = owners;

  // 5. Frameworks
  log("Creating NCA frameworks…");
  const frameworks = await base44.entities.Framework.bulkCreate([
    { code: "ECC", name: "Essential Cybersecurity Controls", description: "Essential baseline cybersecurity controls", authority: "NCA", version: "1.0", is_nca_framework: true, active: true },
    { code: "DCC", name: "Digital Cybersecurity Controls", description: "Digital cybersecurity controls", authority: "NCA", is_nca_framework: true, active: true },
    { code: "CSCC", name: "Critical Systems Cybersecurity Controls", description: "Critical systems controls", authority: "NCA", is_nca_framework: true, active: true },
    { code: "CCC", name: "Cloud Cybersecurity Controls", description: "Cloud cybersecurity controls", authority: "NCA", is_nca_framework: true, active: true },
    { code: "TCC", name: "Telecom Cybersecurity Controls", description: "Telecom controls", authority: "NCA", is_nca_framework: true, active: true },
    { code: "OTCC", name: "Operational Technology Cybersecurity Controls", description: "OT cybersecurity controls (site-based)", authority: "NCA", is_nca_framework: true, active: true },
    { code: "OSMACC", name: "Open Source Management & Audit Cybersecurity Controls", description: "Open source management controls", authority: "NCA", is_nca_framework: true, active: true },
  ]);
  const ecc = frameworks.find((f) => f.code === "ECC");
  const otcc = frameworks.find((f) => f.code === "OTCC");
  const cc = frameworks.find((f) => f.code === "CCC");

  // 6. Domains & Controls (ECC sample)
  log("Creating ECC domains and controls…");
  const eccDomains = await base44.entities.Domain.bulkCreate([
    { framework_id: ecc.id, name: "Cybersecurity Governance", code: "1", order: 1 },
    { framework_id: ecc.id, name: "Asset Management", code: "2", order: 2 },
    { framework_id: ecc.id, name: "Identity & Access Management", code: "3", order: 3 },
  ]);
  const gov = eccDomains[0], asset = eccDomains[1], iam = eccDomains[2];

  const eccControls = await base44.entities.Control.bulkCreate([
    { framework_id: ecc.id, domain_id: gov.id, control_number: "1-1", title: "Cybersecurity Policy", official_text: "The organization shall establish, approve, and publish a cybersecurity policy that is reviewed at least annually.", control_type: "regulatory", is_custom: false, priority: "high", active: true },
    { framework_id: ecc.id, domain_id: gov.id, control_number: "1-2", title: "Cybersecurity Roles & Responsibilities", official_text: "The organization shall define and assign cybersecurity roles and responsibilities.", control_type: "regulatory", priority: "high", active: true },
    { framework_id: ecc.id, domain_id: asset.id, control_number: "2-1", title: "Asset Inventory", official_text: "The organization shall maintain an inventory of information assets.", control_type: "regulatory", priority: "medium", active: true },
    { framework_id: ecc.id, domain_id: iam.id, control_number: "3-1", title: "User Access Management", official_text: "The organization shall manage user access rights based on least privilege.", control_type: "regulatory", priority: "high", active: true },
  ]);
  const [cPolicy, cRoles, cAsset, cAccess] = eccControls;

  // Expected evidence + conditions
  log("Creating expected evidence and conditions…");
  const expectedEvs = await base44.entities.ExpectedEvidence.bulkCreate([
    { control_id: cPolicy.id, framework_id: ecc.id, evidence_type: "Approved Policy", name: "Approved Cybersecurity Policy Document", is_mandatory: true, accepted_formats: ["pdf", "docx"], validity_period_days: 365, requires_formal_approval: true, allow_reuse: true },
    { control_id: cRoles.id, framework_id: ecc.id, evidence_type: "RACI Matrix", name: "Roles & Responsibilities Matrix", is_mandatory: true, accepted_formats: ["pdf", "xlsx"], allow_reuse: true },
    { control_id: cAccess.id, framework_id: ecc.id, evidence_type: "Screenshot", name: "Access Review Screenshot", is_mandatory: true, accepted_formats: ["png", "jpg"], allow_reuse: false },
  ]);
  const conditions = await base44.entities.EvidenceCondition.bulkCreate([
    { expected_evidence_id: expectedEvs[0].id, control_id: cPolicy.id, name: "Meaningful file name", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[0].id, control_id: cPolicy.id, name: "Approved document", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[0].id, control_id: cPolicy.id, name: "Visible approval authority", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[0].id, control_id: cPolicy.id, name: "Visible version and approval date", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[0].id, control_id: cPolicy.id, name: "Sensitive information appropriately masked", is_mandatory: false, active: true },
    { expected_evidence_id: expectedEvs[2].id, control_id: cAccess.id, name: "Full-screen screenshot", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[2].id, control_id: cAccess.id, name: "Visible system name", is_mandatory: true, active: true },
    { expected_evidence_id: expectedEvs[2].id, control_id: cAccess.id, name: "Visible date and time", is_mandatory: true, active: true },
  ]);

  // 7. Audits
  log("Creating audits (ECC Self-Assessment, 2x OTCC, Internal, Technical)…");
  const auditECC = (await base44.entities.Audit.create({ name: `${year} ECC`, audit_year: year, framework_id: ecc.id, framework_code: "ECC", audit_type: "Self-Assessment", status: "active", lead_auditor_id: sarah.id, audit_level_owners: [sarah.id], scope: "Enterprise ECC self-assessment" })).id;
  const auditOTCC1 = (await base44.entities.Audit.create({ name: `${year} OTCC – Plant 1`, audit_year: year, framework_id: otcc.id, framework_code: "OTCC", audit_type: "Self-Assessment", site_id: sites[0].id, status: "active", lead_auditor_id: khalid.id, audit_level_owners: [khalid.id], scope: "OTCC site assessment - Plant 1" })).id;
  const auditOTCC2 = (await base44.entities.Audit.create({ name: `${year} OTCC – Plant 2`, audit_year: year, framework_id: otcc.id, framework_code: "OTCC", audit_type: "Self-Assessment", site_id: sites[1].id, status: "active", lead_auditor_id: khalid.id, audit_level_owners: [khalid.id], scope: "OTCC site assessment - Plant 2" })).id;
  const auditInternal = (await base44.entities.Audit.create({ name: `${year} Internal Audit — IAM`, audit_year: year, framework_id: ecc.id, framework_code: "ECC", audit_type: "Internal Audit", status: "active", lead_auditor_id: sarah.id, scope: "Internal audit of IAM controls" })).id;
  const auditTech = (await base44.entities.Audit.create({ name: `${year} Technical Assessment — Cloud`, audit_year: year, framework_id: cc.id, framework_code: "CCC", audit_type: "Technical Assessment", status: "active", lead_auditor_id: sarah.id, scope: "Technical cloud controls assessment" })).id;
  const auditCorrection = (await base44.entities.Audit.create({ name: `${year} Correction Plan — Access`, audit_year: year, framework_id: ecc.id, framework_code: "ECC", audit_type: "Correction Plan", status: "active", lead_auditor_id: sarah.id, scope: "Remediation of access findings" })).id;

  // 8. Audit controls
  log("Linking controls to audits…");
  const acRecords = await base44.entities.AuditControl.bulkCreate([
    { audit_id: auditECC, control_id: cPolicy.id, framework_id: ecc.id, domain_id: gov.id, control_number: "1-1", control_title: cPolicy.title, compliance_status: "Implemented", control_level_owners: [ahmed.id], due_date: `${year}-12-31`, order: 1 },
    { audit_id: auditECC, control_id: cRoles.id, framework_id: ecc.id, domain_id: gov.id, control_number: "1-2", control_title: cRoles.title, compliance_status: "Partially Implemented", control_level_owners: [ahmed.id], due_date: `${year}-12-31`, order: 2 },
    { audit_id: auditECC, control_id: cAsset.id, framework_id: ecc.id, domain_id: asset.id, control_number: "2-1", control_title: cAsset.title, compliance_status: "Under Evaluation", control_level_owners: [fatima.id], due_date: `${year}-12-31`, order: 3 },
    { audit_id: auditECC, control_id: cAccess.id, framework_id: ecc.id, domain_id: iam.id, control_number: "3-1", control_title: cAccess.title, compliance_status: "Not Implemented", control_level_owners: [fatima.id], due_date: `${year}-06-30`, order: 4 },
    { audit_id: auditInternal, control_id: cAccess.id, framework_id: ecc.id, domain_id: iam.id, control_number: "3-1", control_title: cAccess.title, compliance_status: "Partially Implemented", control_level_owners: [fatima.id], due_date: `${year}-09-30`, order: 1 },
  ]);
  const acPolicy = acRecords[0];
  const acRoles = acRecords[1];
  const acAccess = acRecords[3];

  // 9. Evidence requests — covering every status
  log("Creating evidence requests in every status…");
  const pastDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const reqs = await base44.entities.EvidenceRequest.bulkCreate([
    { audit_id: auditECC, audit_control_id: acPolicy.id, control_id: cPolicy.id, framework_id: ecc.id, title: "ECC_1-1_Approved_Cybersecurity_Policy_2026.pdf", evidence_type: "Approved Policy", status: "Received", review_status: "accepted", request_date: pastDate, due_date: futureDate, assigned_owner_ids: [ahmed.id], notification_method: "immediate", submission_date: pastDate, received_date: now, acceptance_date: now, status_history: [{ status: "Requested", changed_at: pastDate }, { status: "Received", changed_at: now }] },
    { audit_id: auditECC, audit_control_id: acRoles.id, control_id: cRoles.id, framework_id: ecc.id, title: "ECC_1-2_RACI_Matrix.xlsx", evidence_type: "RACI Matrix", status: "Partially Received", review_status: "partially_sufficient", request_date: pastDate, due_date: futureDate, assigned_owner_ids: [ahmed.id], notification_method: "end_of_day", status_history: [{ status: "Requested", changed_at: pastDate }, { status: "Partially Received", changed_at: now }] },
    { audit_id: auditECC, audit_control_id: acAccess.id, control_id: cAccess.id, framework_id: ecc.id, title: "Access review screenshot", evidence_type: "Screenshot", status: "Overdue", review_status: "awaiting_review", request_date: pastDate, due_date: pastDate, assigned_owner_ids: [fatima.id], assigned_department_id: deptIT.id, notification_method: "immediate", status_history: [{ status: "Requested", changed_at: pastDate }] },
    { audit_id: auditOTCC1, audit_control_id: acPolicy.id, control_id: cPolicy.id, framework_id: ecc.id, title: "OT cybersecurity policy", evidence_type: "Approved Policy", status: "Requested", review_status: "awaiting_review", request_date: pastDate, due_date: futureDate, assigned_owner_ids: [khalid.id], notification_method: "immediate", status_history: [{ status: "Requested", changed_at: pastDate }] },
    { audit_id: auditOTCC2, audit_control_id: acPolicy.id, control_id: cPolicy.id, framework_id: ecc.id, title: "OT cybersecurity policy v2", evidence_type: "Approved Policy", status: "Require Further Comments", review_status: "further_comments_requested", request_date: pastDate, due_date: futureDate, assigned_owner_ids: [khalid.id], notification_method: "both", status_history: [{ status: "Requested", changed_at: pastDate }] },
    { audit_id: auditInternal, audit_control_id: acRecords[4].id, control_id: cAccess.id, framework_id: ecc.id, title: "IAM access review evidence", evidence_type: "Screenshot", status: "Not Applicable", review_status: "awaiting_review", request_date: pastDate, due_date: futureDate, assigned_owner_ids: [fatima.id], exclude_from_overdue: true, status_history: [{ status: "Requested", changed_at: pastDate }, { status: "Not Applicable", changed_at: now }] },
  ]);
  const reqPolicy = reqs[0];
  const reqRoles = reqs[1];
  const reqAccessOverdue = reqs[2];

  // 10. Evidence submissions — versioned + reused across controls
  log("Creating evidence submissions (versioned, reused)…");
  const masterId = "EV-DEMO-001";
  await base44.entities.EvidenceSubmission.bulkCreate([
    { evidence_request_id: reqPolicy.id, master_evidence_id: masterId, display_title: "ECC_1-1_Approved_Cybersecurity_Policy_2026.pdf", original_file_name: "policy_v1.pdf", file_url: "https://example.com/policy_v1.pdf", file_type: "pdf", file_size: 240000, version: 1, is_active_version: false, upload_date: pastDate, approval_status: "superseded", confidentiality_classification: "confidential", linked_audit_control_ids: [acPolicy.id], checklist_completed: true },
    { evidence_request_id: reqPolicy.id, master_evidence_id: masterId, display_title: "ECC_1-1_Approved_Cybersecurity_Policy_2026.pdf", original_file_name: "policy_v2_signed.pdf", file_url: "https://example.com/policy_v2_signed.pdf", file_type: "pdf", file_size: 245000, version: 2, is_active_version: true, upload_date: now, received_date: now, effective_date: pastDate, review_date: now, expiry_date: `${year + 1}-01-01`, approval_status: "approved", confidentiality_classification: "confidential", linked_audit_control_ids: [acPolicy.id, acRoles.id], checklist_completed: true, checklist_results: [{ condition: "Meaningful file name", passed: true }, { condition: "Approved document", passed: true }, { condition: "Visible approval authority", passed: true }] },
  ]);

  // 11. Findings & correction plans
  log("Creating findings and corrective actions…");
  const finding = await base44.entities.Finding.create({ title: "Incomplete user access review evidence", description: "Access review screenshot missing system name and date. Evidence rejected.", source_audit_id: auditECC, source_type: "Evidence Review", framework_id: ecc.id, control_id: cAccess.id, audit_control_id: acAccess.id, evidence_request_id: reqAccessOverdue.id, severity: "high", risk_rating: "high", regulatory_impact: "ECC 3-1 non-compliance", owner_id: fatima.id, department_id: deptIT.id, due_date: futureDate, auditor_comments: "Evidence must show full-screen with visible system name and date.", status: "open" });
  await base44.entities.Finding.create({ title: "Cybersecurity policy not formally approved", description: "Policy lacks visible approval authority signature.", source_audit_id: auditECC, source_type: "Evidence Review", framework_id: ecc.id, control_id: cPolicy.id, severity: "medium", risk_rating: "medium", owner_id: ahmed.id, due_date: futureDate, status: "in_progress" });
  await base44.entities.CorrectionPlan.create({ corrective_action: "Re-screenshot access review with visible system name and date/time", finding_id: finding.id, audit_id: auditCorrection, control_id: cAccess.id, primary_owner_id: fatima.id, supporting_owner_ids: [ahmed.id], priority: "high", risk: "high", target_date: futureDate, completion_percentage: 40, status: "in_progress", closure_decision: "pending", required_closure_evidence: "Updated screenshot" });
  await base44.entities.CorrectionPlan.create({ corrective_action: "Obtain formal VP signature on cybersecurity policy", finding_id: null, audit_id: auditCorrection, control_id: cPolicy.id, primary_owner_id: ahmed.id, priority: "medium", risk: "medium", target_date: pastDate, completion_percentage: 20, status: "overdue", closure_decision: "pending", required_closure_evidence: "Signed policy PDF" });

  // 12. Notifications
  log("Creating sample notifications…");
  await base44.entities.Notification.bulkCreate([
    { recipient_id: ahmed.id, recipient_email: ahmed.work_email, channel: "in_app", delivery_mode: "immediate", type: "new_evidence_request", title: "New evidence request: Approved Cybersecurity Policy", body: "Evidence requested for 2026 ECC — Cybersecurity Policy. Due: " + futureDate, related_record_type: "EvidenceRequest", link: `/audits/${auditECC}`, is_read: false, sent_at: now, delivery_status: "dev_logged" },
    { recipient_id: fatima.id, recipient_email: fatima.work_email, channel: "in_app", delivery_mode: "immediate", type: "overdue", title: "Evidence overdue: Access review screenshot", body: "Your evidence request is overdue.", related_record_type: "EvidenceRequest", link: `/audits/${auditECC}`, is_read: false, sent_at: now, delivery_status: "dev_logged" },
    { recipient_id: khalid.id, recipient_email: khalid.work_email, channel: "in_app", delivery_mode: "end_of_day", type: "upcoming_deadline", title: "Deadline approaching: OT cybersecurity policy", body: "Evidence due in 30 days for OTCC Plant 1.", link: `/audits/${auditOTCC1}`, is_read: true, sent_at: now, read_at: now, delivery_status: "dev_logged" },
  ]);

  // 13. Audit trail entries
  log("Recording audit trail…");
  await base44.entities.AuditTrail.bulkCreate([
    { user_name: "System", action: "seed_data_loaded", record_type: "System", record_id: "seed", record_name: "Seed Data", comment: "Initial seed data loaded", timestamp: now },
    { user_name: "Sarah Al-Otaibi", action: "audit_created", record_type: "Audit", record_id: auditECC, record_name: `${year} ECC`, timestamp: now },
    { user_name: "Sarah Al-Otaibi", action: "evidence_uploaded", record_type: "EvidenceSubmission", record_name: "Cybersecurity Policy v2", comment: "Versioned upload", timestamp: now },
  ]);

  log("Seed data complete.");
  return { frameworks: frameworks.length, owners: owners.length, audits: 6 };
}