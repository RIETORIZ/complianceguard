# Compliance Management Tool — Security Considerations

## Implemented Controls

### Authentication and session management

- Base44 platform-managed authentication and session handling.
- Protected application routes require authentication.
- Backend functions independently call `auth.me()`.

### Role-based authorization

- Eleven enterprise roles plus legacy Base44 role compatibility.
- Interface permissions hide unauthorized navigation and actions.
- Entity row-level policies restrict create/read/update/delete by role.
- Official regulatory wording has field-level write protection.
- AuditTrail updates and deletes are denied.

### Evidence access

- Evidence preview uses `secure-evidence-access` rather than direct entity lookup.
- The backend validates:
  - role
  - linked owner/assignee
  - sector, department and division scope
  - site and system scope
  - confidentiality clearance
- Access allowed and denied events are logged.
- Evidence reporting and management links point to authenticated application previews.

### File controls

- accepted-extension validation
- 25 MB size limit
- meaningful display-title validation
- SHA-256 integrity hash
- exact-duplicate detection
- confidentiality classification
- version history and active-version control
- malware scan lifecycle field

### Input and output protection

- Controlled entity schemas and enums.
- User-supplied audit report content is escaped before HTML generation.
- React output encoding protects standard interface rendering.
- Backend function parameters are validated before use.
- No secrets or production credentials are stored in source.

### Accountability

- Immutable AuditTrail entity.
- Important workflow actions capture previous/new values and reasons.
- Scheduled status changes and reporting exports are audited.
- Evidence preview attempts are audited.

## Authorization Model

| Role | Primary access |
|---|---|
| System Administrator | Full application and configuration administration |
| Compliance Administrator | Compliance configuration, frameworks, owners, audits and reports |
| Compliance Officer | Operational compliance, audits, evidence, findings and reporting |
| Auditor | Audit execution and evidence review |
| Auditee | Assigned evidence and corrective-action participation |
| Control Owner | Assigned controls, evidence and remediation |
| Department Manager | Department-level monitoring and assigned work |
| Division Manager | Division-level monitoring and assigned work |
| Sector Manager | Sector-level monitoring and assigned work |
| External Auditor | Controlled assigned audit/evidence access |
| Executive Viewer | Read-only management reporting |

General entity RLS is role-based. Evidence authorization adds the detailed organizational and confidentiality decision in a backend gateway because cross-entity organizational joins are not fully expressible in simple entity RLS.

## Production Hardening Required

1. **Malware scanner:** connect an approved AV/CDR service and prevent reviewer access until the scan status is `clean`.
2. **Short-lived storage URLs:** replace released persistent file URLs with short-lived signed URLs or a streaming proxy.
3. **Enterprise SSO:** integrate the approved identity provider and enforce MFA/Conditional Access.
4. **Provisioning:** connect HR/identity lifecycle feeds for owner activation, deactivation and organizational movement.
5. **Secrets:** store service credentials only in Base44 or approved enterprise secret management.
6. **Security monitoring:** forward authentication, denied access, administration and evidence events to the SIEM.
7. **Retention:** define evidence, audit trail, report and personal-data retention schedules.
8. **Data residency:** confirm Base44/storage residency and contractual requirements for the target organization.
9. **Penetration testing:** perform authenticated application, API, IDOR and file-access tests before production release.
10. **Business continuity:** document backup, restore and recovery objectives for platform data and evidence storage.

## Threat Scenarios and Mitigations

| Threat | Mitigation |
|---|---|
| Direct-object access to restricted evidence | Backend evidence gateway and audited authorization decision |
| Auditor changes official regulatory text | Field-level write protection and separate custom fields |
| Evidence overwritten | Immutable version records and controlled activation/superseding |
| Duplicate or conflicting files | SHA-256 detection and master-evidence reuse |
| One reused file closes unrelated controls | Independent mappings and per-control eligibility checks |
| Unexplained rejection | Mandatory rejection/return reason |
| Silent audit-log alteration | RLS denies update/delete |
| Dashboard manipulation | Metrics calculated from persistent entities, not browser constants |
| Spreadsheet formula/script content | Import reads cell values into validated fields; imported content is rendered through React/escaped reports |
| Privilege through hidden buttons | API/entity/backend policies complement interface restrictions |

## Privacy

Owner records contain employee numbers, work contact information and organizational assignments. Access should be limited to operational need. Power BI extracts and exported reports must not broadly expose personal information or restricted evidence metadata.

## Security Validation Performed

- build and lint gate
- deterministic authorization tests
- evidence-clearance tests
- file-naming and status-transition tests
- dependency audit
- schema/RLS review
- report-output escaping review

Security validation does not replace a production penetration test or external platform assurance review.
