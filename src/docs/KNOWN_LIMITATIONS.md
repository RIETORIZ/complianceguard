# Compliance Management Tool — Known Limitations and Next Phases

## Current Limitations

### 1. Malware scanning is an integration point

Uploads are validated and marked with `malware_scan_status`, but no external antivirus or content-disarm service is connected. Production must quarantine new evidence until an approved scanner returns a clean result.

### 2. Storage links are authorized but not short-lived signed URLs

The backend evidence gateway authorizes access before returning the stored file URL. The final production design should generate a short-lived signed URL or proxy/stream the file so a previously released storage URL cannot remain usable indefinitely.

### 3. Cross-entity organizational RLS

Base44 entity policies enforce role-based CRUD. Detailed evidence organization/site/system/confidentiality checks are enforced in the backend evidence gateway. Applying equivalent joined organizational filtering to every entity requires additional scoped backend APIs or denormalized access-scope fields.

### 4. Native PowerPoint generation

The application generates a presentation-style HTML report with one printable page per control and secure application links. It can be printed to PDF. Native PPTX generation is not currently implemented; the report data model is suitable for adding a PPTX renderer.

### 5. End-to-end browser tests

Automated tests cover deterministic compliance and authorization rules. Browser E2E tests for complete uploads, review actions, imports, report generation and permission navigation should be added using an approved test runner and test tenant.

### 6. High-volume pagination

Entity queries are bounded and suitable for demonstration/moderate usage. Large deployments require server-side cursor pagination, search indexes and possibly archival partitions.

### 7. Email provider

Immediate and end-of-day delivery use a development adapter and persisted in-app notifications. Production requires SMTP, Microsoft Graph or another approved email service with delivery/retry telemetry.

### 8. External identity and HR lifecycle

Authentication is platform-managed. Production should connect enterprise SSO, MFA and employee lifecycle provisioning. Owner/manager/delegate updates should be synchronized from the authoritative organizational source.

### 9. Backend function publication acceptance

Function and automation source is included under `base44/functions`. After application publication, administrators must verify the schedule activation, service-role permissions, logging and failure handling in the target Base44 environment.

### 10. Dependency advisories

The direct high-severity `xlsx` dependency was removed. Remaining moderate advisories are inherited through Base44/Vite development tooling. They should be reviewed when compatible platform/plugin updates are available; forced upgrades must not be applied without regression testing.

### 11. Data retention and legal hold

The schema supports auditability and version history, but organization-specific retention, deletion, legal-hold and archival policies are not automatically applied.

### 12. Accessibility and localization

The interface is responsive and keyboard-compatible in standard controls, but a formal WCAG audit and Arabic/RTL localization have not been completed.

## Recommended Next Development Phases

### Phase 1 — Production security

- Enterprise SSO and MFA/Conditional Access
- short-lived evidence URLs or streaming proxy
- malware scanning/quarantine
- SIEM integration
- security and privacy assessment
- penetration test and remediation

### Phase 2 — Operational integrations

- Microsoft Graph/SMTP email
- HR organizational synchronization
- SharePoint/object-storage connector if required
- ticketing integration for findings/corrective actions
- regulator/external-auditor access workflow

### Phase 3 — Reporting and analytics

- Power BI gateway/service account
- incremental refresh and semantic model
- native PPTX renderer
- scheduled report packs
- executive RLS in Power BI

### Phase 4 — Scale and assurance

- cursor pagination and indexed search
- archival/retention automation
- browser E2E tests
- performance/load testing
- disaster recovery exercise
- accessibility and Arabic/RTL release
