# Compliance Management Tool — Requirement Traceability Matrix

**Authoritative source:** `Compliance Management Tool — Project Overview` (44 pages)

Status definitions:

- **Implemented** — source, schema, and user interaction exist.
- **Implemented / runtime verification required** — implemented in Base44 resources; function scheduling or external service behavior must be verified after publication.
- **Partial** — a functional alternative exists, but production hardening or an external dependency remains.
- **Not implemented** — no functional implementation exists.

| ID | Source requirement | Implementation | Validation status |
|---|---|---|---|
| R-001 | Centralized compliance operations | Dashboard, Audits, Frameworks, Findings, Correction Plans, Owners, Reports, Administration | Implemented |
| R-002 | Evidence is the core operational capability | `EvidenceRequest`, `EvidenceSubmission`, `EvidenceMapping`, evidence conditions, upload/review workflows | Implemented |
| R-003 | Self-Assessment | `Audit.audit_type`, audit creation, framework-control population | Implemented |
| R-004 | External Regulatory Audit | Audit type and workspace supported | Implemented |
| R-005 | Corporate Compliance Assessment | Audit type, scope, framework/custom controls | Implemented |
| R-006 | Internal Audit | Multi-framework controls, custom controls, spreadsheet import | Implemented |
| R-007 | Technical Assessment | Custom technical requirements, imports, evidence and findings | Implemented |
| R-008 | Correction Plans | Audit type and operational `CorrectionPlan` workflow | Implemented |
| R-009 | NCA frameworks ECC, DCC, CSCC, CCC, TCC, OTCC, OSMACC | Framework library and validated seed | Implemented |
| R-010 | Current-year framework audit naming | `Audits.jsx` generated name, editable before creation | Implemented |
| R-011 | One OTCC audit per selected site | OTCC audit creation loop and per-site control population | Implemented |
| R-012 | Framework → Domain → Subdomain → Control → Sub-control → Evidence → Conditions | Recursive `Frameworks.jsx` and relational entities | Implemented |
| R-013 | Protect official regulatory wording | Field-level RLS on `Control.official_text`; custom text separate | Implemented |
| R-014 | Internal notes, guidance and additional requirements | Separate control fields and library UI | Implemented |
| R-015 | Multiple evidence items per control | `ExpectedEvidence` one-to-many relationship | Implemented |
| R-016 | Multiple acceptance conditions per evidence | `EvidenceCondition` and auditee checklist | Implemented |
| R-017 | Conditions mandatory/optional, formats, validity, examples, rejection reasons, approval, reuse | Framework evidence/condition editor | Implemented |
| R-018 | Preserve evidence-requirement history | AuditTrail; conditions retired with `active=false` | Implemented |
| R-019 | Detect poor evidence filename | `isFileNameMeaningful`; warning and suggested title | Implemented and tested |
| R-020 | Do not block legitimate submission if display title is meaningful | Upload validates display title, not the original filename alone | Implemented and tested |
| R-021 | One master evidence file supports multiple controls | `master_evidence_id` and `EvidenceMapping` | Implemented |
| R-022 | Independent review decision for each mapping | Per-mapping `review_status`; auditor selects reuse mappings | Implemented |
| R-023 | Do not automatically close every linked control | Independent eligibility evaluation | Implemented |
| R-024 | Approve evidence and close all eligible controls | Auditor action with mandatory evidence, conditions, validity, approval and findings checks | Implemented |
| R-025 | Evidence request statuses remain separate | Dedicated `EvidenceRequest.status` enum | Implemented and tested |
| R-026 | Compliance statuses remain separate | `AuditControl.compliance_status` enum | Implemented and tested |
| R-027 | Received evidence does not imply Implemented | No automatic status coupling; auditor action required | Implemented and tested |
| R-028 | Automatic overdue processing | Hourly `compliance-automation` function | Implemented / runtime verification required |
| R-029 | Received and Partially Received excluded from overdue | Pure rule and scheduled function exclusions | Implemented and tested |
| R-030 | Complete request communication/status log | request status history, comments, dates, resubmission count, review dates | Implemented |
| R-031 | Evidence review actions | Accept, observation, reject, clarification, comments, corrected/updated file, approval, partial, finding, correction plan | Implemented |
| R-032 | Reason required for rejection/return | Review modal validation | Implemented |
| R-033 | Sector → Department → Division → Employee | `OrgUnit`, `Owner`, recursive hierarchy UI | Implemented |
| R-034 | Add/edit/move/deactivate owners and managers | Owners module and cascading validation | Implemented |
| R-035 | Groups and group membership | `OwnerGroup` and groups interface | Implemented |
| R-036 | Audit/control/evidence/corrective/supporting owners | entity assignment fields and workflows | Implemented |
| R-037 | Assign people, groups, sector, department, division, combinations | Evidence request form and recipient resolution | Implemented |
| R-038 | Immediate and end-of-day notification | notification abstraction, queued digest function | Implemented / runtime verification required |
| R-039 | Notification types and escalation | request/review/finding/action/expiry/overdue notifications; scheduled escalation | Implemented |
| R-040 | Excel and CSV import with preview and mapping | `ImportSpreadsheetModal`, `read-excel-file`, CSV parser | Implemented |
| R-041 | Do not assume fixed column names | user-selected mapping and optional auto-suggestion | Implemented |
| R-042 | Validate blank/duplicate rows and show errors | import validation before confirmation | Implemented |
| R-043 | Findings from multiple sources | full source-type enum and operational Findings page | Implemented |
| R-044 | Finding fields, response, closure evidence, verification and history | `Finding` entity and modal | Implemented |
| R-045 | Corrective action owner/supporters, risk, progress, evidence, validation, escalation and closure | `CorrectionPlan` entity and page | Implemented |
| R-046 | Evidence repository metadata | submission schema includes ID, title, original name, URL, type, size, hash, dates, version, owner, approval, classification and mappings | Implemented |
| R-047 | Do not overwrite evidence versions | version records retained; approved current version superseded only after replacement acceptance | Implemented |
| R-048 | Evidence validity and affected controls | validity status, scheduled expiry processing and linked requests | Implemented / runtime verification required |
| R-049 | Dashboard audit metrics | live audit records and drill-down | Implemented |
| R-050 | Dashboard evidence metrics | all requested states, review state and expiry | Implemented |
| R-051 | Dashboard compliance metrics by framework/domain/department/site and trends | live group calculations and `ComplianceSnapshot` | Implemented |
| R-052 | Dashboard ownership metrics | owner/dept/division/unassigned/inactive assignments | Implemented |
| R-053 | Dashboard findings and correction-plan metrics | live findings/actions calculations | Implemented |
| R-054 | Presentation-style audit report | escaped HTML report, printable to PDF | Implemented |
| R-055 | One page/slide per control | page-break control report sections | Implemented |
| R-056 | Evidence folder and preview links | control workspace and authenticated evidence preview links | Implemented |
| R-057 | Do not expose evidence to unauthorized users | backend evidence gateway, role/scope/clearance checks and audit logging | Implemented; short-lived storage signing is Partial |
| R-058 | Power BI-ready tables/API | `reporting-export` function and documented star schema | Implemented / runtime verification required |
| R-059 | Stable IDs and relationships | Base44 entity IDs and explicit foreign-key fields | Implemented |
| R-060 | 11 application roles | User schema, permission matrix, route navigation and backend gateways | Implemented |
| R-061 | Access restricted by organizational and evidence scope | interface helpers plus backend evidence scope/clearance checks | Implemented for evidence; general cross-entity organizational RLS is Partial |
| R-062 | Immutable audit trail | AuditTrail update/delete denied by RLS | Implemented |
| R-063 | Audit important actions and previous/new values | `logAudit` and backend automation/gateway logs | Implemented |
| R-064 | Secure authentication/session management | Base44 managed authentication | Implemented by platform |
| R-065 | File type and size validation | upload validation using expected formats and 25 MB limit | Implemented |
| R-066 | Malware-scanning integration point | `malware_scan_status` lifecycle | Partial — external scanner not connected |
| R-067 | Hash/integrity and duplicate prevention | browser SHA-256 and duplicate reuse prompt | Implemented |
| R-068 | Search/filter/sort/pagination | search/filter/sort throughout; bounded entity queries | Partial — large-list cursor pagination not yet implemented everywhere |
| R-069 | API documentation | `API_DOCUMENTATION.md` | Implemented |
| R-070 | Database migrations/schema resources | version-controlled `base44/entities/*.jsonc` | Implemented |
| R-071 | Seed data | idempotent relational seed covering requested scenarios | Implemented |
| R-072 | Automated tests | compliance and access-control tests | Implemented; UI/E2E tests remain Partial |
| R-073 | Sample import spreadsheet | technical and correction-plan CSV samples | Implemented |
| R-074 | Architecture, security, Power BI and deployment documentation | documents under `src/docs` and README | Implemented |

## Explicit remaining gaps

1. An external malware-scanning service is not connected. Files are marked `pending` at upload to provide the integration point.
2. The secure evidence gateway performs authorization before releasing the stored file URL, but the underlying storage URL is not replaced by a short-lived signed URL in this implementation.
3. Organization-wide row-level filters that require joins across Owner, Audit and OrgUnit are enforced in application/backend gateways where implemented; Base44 entity RLS is primarily role-based because entity policies cannot express all cross-entity joins.
4. Native PPTX is not generated. The implemented report is presentation-style HTML and prints to PDF using the same control-level report model.
5. Automated tests cover critical deterministic workflow and authorization rules; browser E2E, accessibility, load and penetration tests remain production-release activities.
