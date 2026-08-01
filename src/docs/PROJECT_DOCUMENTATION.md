# Compliance Management Tool — Project Documentation

This application implements the evidence-driven compliance lifecycle defined in the authoritative project overview:

```text
Framework Library → Audit Creation → Control Selection → Evidence Request
→ Evidence Submission → Independent Review → Compliance Assessment
→ Findings → Correction Plans → Verification → Closure → Reporting
```

## Delivered Modules

- Responsive management dashboard backed by persistent data
- Audit portfolio and six required audit/assessment types
- Seven required NCA framework records
- Recursive regulatory library with protected official wording
- Audit workspace with multi-framework and custom controls
- Evidence requests, assignments, conditions, submission, versioning and reuse
- Independent evidence mapping and control-closure decisions
- Findings and correction-plan workflows
- Sector → Department → Division → Employee ownership hierarchy
- Immediate and end-of-day notifications
- CSV/XLS/XLSX mapped import
- Presentation-style HTML/PDF audit reports
- Secure evidence preview gateway
- Power BI reporting export layer
- Immutable audit trail
- Role and confidentiality authorization
- Seed data and automated rule tests

## Documentation Set

- `ARCHITECTURE.md`
- `REQUIREMENT_TRACEABILITY_MATRIX.md`
- `VALIDATION_REPORT.md`
- `API_DOCUMENTATION.md`
- `POWER_BI_MODEL.md`
- `SECURITY.md`
- `DEPLOYMENT.md`
- `KNOWN_LIMITATIONS.md`

## Roles

The application supports:

1. System Administrator
2. Compliance Administrator
3. Compliance Officer
4. Auditor
5. Auditee
6. Control Owner
7. Department Manager
8. Division Manager
9. Sector Manager
10. External Auditor
11. Executive Viewer

The role is enforced through navigation/action permissions and entity RLS. Evidence access adds server-side organization, site, system and confidentiality checks.

## Core Design Rules

- Evidence request status and compliance status are independent.
- Evidence receipt never automatically marks a control Implemented.
- Official regulatory text is protected from ordinary audit editing.
- One evidence file can support multiple controls through independent mappings.
- Reuse does not close linked controls automatically.
- A control closes only after mandatory evidence, mandatory conditions, validity, approval and open findings are evaluated.
- Evidence versions are retained; an approved version remains active until its replacement is accepted.
- Dashboard metrics are calculated from persistent records.
- Reports link to authenticated evidence previews.
- AuditTrail update and delete are denied.

## Run and Validate

```bash
npm install
npm run validate
npm audit
```

Use **Administration → Seed Data → Run Seed** for the idempotent demonstration dataset.

## Release Position

The implementation is suitable for controlled demonstration and user acceptance testing after build/lint/tests pass and Base44 backend functions are deployed. Production release remains subject to the hardening items in `SECURITY.md` and `KNOWN_LIMITATIONS.md`, including malware scanning, short-lived evidence delivery, enterprise SSO, email integration and penetration testing.
