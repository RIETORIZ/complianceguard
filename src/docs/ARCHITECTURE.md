# Compliance Management Tool — Architecture

## 1. Architecture Summary

The application is a Base44-hosted React single-page application with version-controlled entity schemas, backend functions, scheduled automations, platform-managed authentication, and persistent Base44 data storage.

```text
Browser / React UI
  ├─ Base44 Auth Context
  ├─ Interface Permission Routes
  ├─ Compliance Modules
  │   ├─ Dashboard
  │   ├─ Framework Library
  │   ├─ Audit Workspace
  │   ├─ Evidence Submission and Review
  │   ├─ Findings and Correction Plans
  │   ├─ Owners and Organization
  │   ├─ Notifications
  │   ├─ Reports
  │   └─ Administration
  └─ Base44 SDK
       ├─ Persistent Entities + Entity RLS
       ├─ File Upload Integration
       └─ Backend Functions
            ├─ secure-evidence-access
            ├─ reporting-export
            ├─ compliance-automation
            ├─ end-of-day-digest
            └─ compliance-snapshot
```

## 2. Frontend

- React 18 and React Router.
- Tailwind CSS enterprise interface.
- Base44 SDK for entity access, authentication, file uploads and function invocation.
- Route-level permission checks through `PermissionRoute`.
- Navigation items filtered by the same permission matrix.
- Server-side evidence authorization is not delegated to the browser.

## 3. Data Architecture

### Regulatory library

- `Framework`
- `Domain` with recursive `parent_id`
- `Control` with recursive `parent_id`
- `ExpectedEvidence`
- `EvidenceCondition`

Official regulatory wording is stored in `Control.official_text` and protected by field-level security. Organization-specific text is stored separately.

### Audit execution

- `Audit`
- `AuditControl`
- `EvidenceRequest`
- `EvidenceSubmission`
- `EvidenceMapping`

`EvidenceRequest.status` and `AuditControl.compliance_status` are separate fields with independent workflows.

### Organization and ownership

- `OrgUnit`: sector, department and division hierarchy
- `Owner`
- `OwnerGroup`
- `Site`
- `System`

### Findings and remediation

- `Finding`
- `CorrectionPlan`

### Governance and reporting

- `Notification`
- `AuditTrail`
- `ComplianceSnapshot`

## 4. Evidence Model

One master evidence identity can have multiple physical versions. Each version is an `EvidenceSubmission` with:

- stable `master_evidence_id`
- version number
- SHA-256 file hash
- active-version flag
- review and approval state
- validity state
- metadata and confidentiality classification
- linked requests and controls

`EvidenceMapping` is the independent junction record between a submitted version and each evidence request/control. It preserves independent reuse review decisions.

A replacement file remains pending without superseding an existing active approved version. The existing approved version is superseded only when the replacement is accepted.

## 5. Backend Services

### secure-evidence-access

- authenticates the user
- loads evidence through service-role access
- checks role, ownership, organization, site/system scope and confidentiality clearance
- logs access granted or denied
- releases evidence metadata and storage URL only after authorization

### reporting-export

- restricts exports to reporting roles
- returns named datasets
- uses `id` as stable key and `updated_date` for incremental refresh
- audits export events

### compliance-automation

Runs hourly to:

- mark unanswered evidence requests overdue
- update evidence validity
- notify affected owners
- mark and escalate overdue corrective actions
- record actions in the audit trail

### end-of-day-digest

Runs at 17:00 Asia/Riyadh and consolidates queued notification items. In the current development adapter, email output is logged while the in-application digest is persisted.

### compliance-snapshot

Creates daily compliance snapshots for organization, framework, domain and site trend reporting.

## 6. Security Boundaries

1. Authentication is handled by Base44.
2. Interface permissions prevent unauthorized actions and navigation.
3. Entity RLS restricts CRUD operations by role.
4. Official regulatory wording has additional field-level protection.
5. AuditTrail denies updates and deletes.
6. Evidence file access is authorized by a backend gateway rather than direct browser entity lookup.
7. File URLs are not included in general reporting exports unless the caller is authorized for the dataset and entity policy.

## 7. Deployment Model

- Source changes auto-commit to the Base44 application repository.
- Entity and function resources synchronize through Base44 application deployment/publication.
- The Vite frontend builds to `dist`.
- No secrets are stored in source.
- Production external integrations should be configured through Base44 or approved secret management.

## 8. Scalability Considerations

The current implementation uses bounded entity queries suitable for a demonstration and moderate deployment. A large enterprise rollout should add:

- server-side cursor pagination for high-volume views
- archive/retention rules
- external object storage lifecycle policies
- asynchronous malware scanning
- materialized reporting extracts for large Power BI refreshes
- performance and load tests using production-like volumes
