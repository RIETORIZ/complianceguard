# Compliance Management Tool — Project Documentation

A centralized, enterprise-grade Compliance Management Tool for managing regulatory frameworks, audits, evidence workflows, findings, correction plans, notifications, dashboards, and Power BI-ready reporting.

## 1. Setup & Run Instructions

This application runs on the Base44 platform (React + Vite + Tailwind + Base44 BaaS).

1. Open the app in the Base44 builder (live preview is available immediately).
2. Sign in / register (authentication is mandatory; Google OAuth supported).
3. Navigate to **Administration → Seed Data → Run Seed** to load demonstration data.
4. Explore the **Dashboard**, **Audits**, **Frameworks**, **Findings**, etc.

## 2. Environment-Variable Template

No secrets are stored in source code. The platform manages auth tokens and integration credentials. For production email sending and Power BI direct connectivity (Builder+):

```
# Email adapter (production SMTP / provider) — currently dev-logged
EMAIL_PROVIDER=...
EMAIL_API_KEY=...
# Power BI direct connector (Builder+)
BASE44_API_KEY=...
# Malware scanning integration point (AV on upload)
AV_SCAN_ENDPOINT=...
```

## 3. Test Accounts & Roles

Roles supported (role-based access control at API and interface level):

- System Administrator
- Compliance Administrator
- Compliance Officer
- Auditor
- Auditee
- Control Owner
- Department Manager
- Division Manager
- Sector Manager
- External Auditor
- Executive Viewer

Users join via invitation (`base44.users.inviteUser`). Assign roles in the platform user management.

## 4. Architecture

**Frontend:** React SPA (pages + components), Tailwind CSS, shadcn/ui, lucide-react.
**Backend:** Base44 BaaS — entities (relational data model), server-side validation, auth, audit logging, integrations (LLM, file upload, email).
**Shared libraries:** `src/lib/compliance.js` (status configs, overdue computation, audit-trail logging, notification dispatch, evidence-name validation), `src/lib/seed.js` (demo data).

### Data Model (17 entities)
Framework → Domain → Control → ExpectedEvidence → EvidenceCondition; OrgUnit (sector/department/division) → Owner; Site, System, OwnerGroup; Audit → AuditControl → EvidenceRequest → EvidenceSubmission; Finding, CorrectionPlan, Notification, AuditTrail.

## 5. Requirement Traceability Matrix (key items)

| Requirement | Module / Implementation |
|---|---|
| 6 audit types | `Audit.audit_type` enum; Create Audit modal |
| 7 NCA frameworks (ECC…OSMACC) | `Framework` entity + seed |
| Auto audit name (`2026 ECC`, `2026 OTCC – Plant 1`) | `CreateAuditModal` auto-generation, per-site for OTCC |
| Editable audit name | name field editable in create modal |
| Framework → Domain → Sub-control → Evidence → Conditions | `Frameworks` page tree |
| Protected official wording | `Control.official_text` (never overwritten) |
| Evidence conditions (14 standard) | `EvidenceCondition` + `DEFAULT_EVIDENCE_CONDITIONS` |
| Auditor add/edit/remove conditions | Conditions live on Frameworks/controls |
| Naming validation + warning | `isFileNameMeaningful`, `suggestEvidenceName`, upload modal warning |
| Evidence reuse across controls | `EvidenceSubmission.linked_audit_control_ids`, review modal "close eligible" |
| Evidence request statuses (7) | `EvidenceRequest.status` enum + `computeOverdueStatus` |
| Auto-overdue | `computeOverdueStatus` + Admin overdue processor |
| Separate compliance status (5) | `AuditControl.compliance_status` (independent) |
| Evidence review actions (10+) | `EvidenceReviewModal` actions; reason required on reject/return |
| Owner hierarchy + multi-assign | `Owners` page + request form (person/group/dept/division) |
| Notifications (immediate + EOD) | `dispatchNotification`, `Notification` entity, in-app center |
| Spreadsheet import (10-step) | `ImportSpreadsheetModal` (upload → preview → map → validate → confirm) |
| Findings (8 sources) | `Finding` entity + `Findings` page |
| Correction plans (full lifecycle) | `CorrectionPlan` entity + `CorrectionPlans` page |
| Evidence repository (versioned) | `EvidenceSubmission` versioning, master id, no overwrite |
| Dashboard (no hardcoded values) | `Dashboard` computes from live records |
| Report generation (HTML/PDF) | `Reports` page — 12-section report with evidence preview links |
| Power BI reporting layer | Relational schema documented in Reports + Admin → Power BI tab |
| Roles & access control | 11 roles (Admin → Roles tab) |
| Audit trail (immutable) | `AuditTrail` entity, logged on all key actions |
| Security (least privilege, file validation, signed links, confidentiality) | Admin → Security tab |

## 6. Power BI Reporting Model

All entities expose stable string IDs and relational foreign keys. Connect Power BI (Builder+) via the Base44 API/OData endpoint. Recommended star schema: fact tables (EvidenceRequest, EvidenceSubmission, AuditControl, Finding, CorrectionPlan) + dimension tables (Framework, Domain, Control, Owner, OrgUnit, Site, System, Audit). Full documentation in **Reports** page and **Administration → Power BI**.

## 7. Security Considerations

See Administration → Security tab. Highlights: platform-managed secure auth, 11-role RBAC, least-privilege scoping, file type/size validation, meaningful-name detection, malware-scan integration point, signed access-controlled evidence URLs, immutable audit trail, confidentiality classification (public/internal/confidential/restricted), separation of app permissions vs evidence access, no secrets in source.

## 8. Known Limitations

- **Email:** uses a development adapter (logged to console + in-app notifications). Production email requires real provider configuration.
- **Power BI direct connector:** requires Builder+ plan; the relational data model is fully available regardless.
- **PPTX report export:** currently HTML/PDF; the reporting service is structured for future PPTX extension.
- **Real-time overdue processing:** computed on read; an explicit processor runs on demand from Admin. A scheduled task (Builder+) would automate this.
- **Evidence preview access control:** enforced via signed URLs and confidentiality classification; full per-user evidence ACL with external identity providers is a next phase.
- **Automated tests:** critical workflows are verified via the preview; a formal automated test suite is a recommended next phase.

## 9. Recommended Next Development Phases

1. Scheduled overdue + notification processor (cron via workflows).
2. Full per-user evidence confidentiality ACL with row-level security policies.
3. Native PPTX report generation.
4. Automated end-to-end test suite for the 22 validation scenarios.
5. Real email/SMS provider integration and escalation chains.
6. Advanced evidence reuse matching engine (similarity scoring).
7. Bulk evidence lifecycle operations and expiry alerts.
8. Two-way Power BI dataset refresh and semantic model publishing.

## 10. Validation Scenarios (verified)

Dashboard metrics match underlying records; all 6 audit types and 3 frameworks seeded; evidence present in every request status; versioned evidence (v1/v2) and evidence reused across controls; overdue auto-detection; findings and corrective actions; audit-trail logging on seed, audit creation, evidence upload, reviews, and report generation.