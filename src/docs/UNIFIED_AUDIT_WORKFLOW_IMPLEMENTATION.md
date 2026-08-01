# Unified Audit Workflow — Implementation Report

**Implementation profile:** `Unified Compliance Workflow v1`  
**Scope:** All six configured audit types  
**Contract path:** Control creation → Evidence request → Evidence submission → Evidence review → Compliance evaluation → Audit response → Finding → Correction plan → Verification → Closure

## 1. Current Architecture Summary

The application is a React 18/Vite single-page application backed by Base44 persistent entities, authentication, file upload integration, backend functions, scheduled automations, and reporting exports.

The workflow implementation is centralized in `src/lib/audit-workflow.js`. Audit creation, audit workspaces, evidence review, findings, correction plans, dashboards, reports, automation, and data migration consume this shared model rather than defining separate audit-type workflows.

## 2. Audit Types Using the Same Workflow

The following audit types use the same ten-stage workflow:

1. Self-Assessment
2. External Regulatory Audit
3. Corporate Compliance Assessment
4. Internal Audit
5. Technical Assessment
6. Correction Plan

The only retained framework-specific creation rule is OTCC: selecting multiple sites creates one OTCC audit per site and names each audit `{year} OTCC - {site_name}`. This changes audit instantiation and scope only; it does not change the downstream workflow.

## 3. Requirements Implemented

### Shared workflow and audit creation

- One shared workflow profile and version are stored on every new audit.
- Every audit type requires a framework and can contain official framework controls, custom controls, and imported controls.
- Every audit workspace displays the same ten workflow stages and derives the current stage from live records.
- Audit workflow completion percentage is recalculated from live controls, evidence, responses, findings, and correction plans.

### Separate status dimensions

The following remain separate fields and records:

- evidence request status
- evidence review decision
- control compliance status
- finding status
- correction-plan status

Evidence acceptance does not automatically mark a control Implemented. A separate compliance evaluation is required and is validated against mandatory evidence, current accepted submissions, scope, and open findings.

### Evidence workflow

- Expected evidence and evidence conditions can be configured per control.
- Evidence requests support owners, organizational assignments, due dates, priority, and notification method.
- Evidence submissions preserve original name, display title, metadata, hash, versions, checklist results, timestamps, validity, approval information, and confidentiality classification.
- One master evidence item can be reused across controls through independent evidence mappings.
- Each mapping keeps its own review decision.
- Review decisions use the canonical workflow values and update request status independently.
- Rejected or revised evidence remains in history.

### Compliance evaluation and audit response

- Compliance decisions are independent of evidence review.
- Implemented decisions require accepted mandatory evidence and no open finding.
- Partially Implemented and Not Implemented decisions can draft findings.
- Not Applicable and non-compliant decisions require an auditor reason.
- Formal audit responses are persisted in `AuditResponse` and can return evidence requests, require further comments, reject Not Applicable justification, close eligible controls, or require a correction plan.

### Findings and correction plans

- Findings use the canonical finding lifecycle.
- Correction plans use the canonical remediation and verification lifecycle.
- Closure evidence, progress, milestones, root cause, target date, owner response, verification decision, cancellation reason, and risk-acceptance expiry are supported.
- Closing a correction plan closes the eligible finding and returns the control to `Under Evaluation` for reassessment.
- Correction-plan closure never automatically changes the control to Implemented.
- Correction-plan owners can update progress and submit closure evidence, but only auditor-level reviewers can verify, reject, close, cancel, or accept risk.

### History, automation, dashboards, and reporting

- `StatusHistory` stores independent status transitions with actor, date, reason, audit, and control context.
- `AuditTrail` stores important user and system actions.
- Scheduled automation uses the canonical evidence-request and correction-plan statuses.
- Dashboard and reports normalize legacy values and calculate from live entity data.
- Power BI export includes audit responses and status histories.

## 4. Database Changes Made

### Added entities

- `AuditResponse`
- `StatusHistory`

### Extended entities

- `Audit`: workflow profile and version
- `AuditControl`: compliance-evaluation metadata
- `EvidenceRequest`: canonical evidence review decision
- `EvidenceSubmission`: canonical evidence review decision
- `EvidenceMapping`: canonical independent mapping decision
- `Finding`: canonical lifecycle, cancellation reason, risk-acceptance expiry
- `CorrectionPlan`: canonical lifecycle, root cause, gap, milestones, closure evidence, verification decisions, history, risk-acceptance expiry

Legacy review fields are retained temporarily for compatibility while canonical fields are authoritative.

## 5. Backend Changes Made

- Updated `compliance-automation` to use canonical overdue transitions and write status history. When accepted shared evidence expires, the automation invalidates affected mappings, reopens unsupported requests and controls for reassessment, notifies owners, and preserves closure when a current accepted replacement exists.
- Updated `reporting-export` to expose `audit_responses` and persisted `status_histories`.
- Added `migrate-unified-audit-workflow` to normalize existing records without altering control compliance decisions.
- The migration is restricted to System Administrator, Compliance Administrator, and legacy admin roles.

## 6. Frontend Changes Made

- Unified audit creation in `Audits.jsx`.
- Unified control-to-closure workspace in `AuditWorkspace.jsx`.
- Rebuilt Findings and Correction Plans pages around canonical lifecycle values.
- Added an administrator migration action for existing data.
- Updated Dashboard and Reports calculations to use canonical/normalized values.
- Updated imports and seed data to create canonical workflow records.

## 7. Validation Added

Run the dependency-free workflow contract validator:

```bash
npm run validate:workflow
```

It verifies:

- all six audit types use the shared registry
- all ten workflow stages exist
- schema enums match the shared status constants
- evidence acceptance cannot implement a control by itself
- correction-plan closure reassesses rather than auto-implements a control
- OTCC per-site creation remains available
- formal audit responses and shared workflow rendering are present
- expired shared evidence invalidates affected mappings and reopens unsupported controls only when no current accepted replacement exists

The full project quality gate remains:

```bash
npm run validate
```

## 8. Validation Results in This Package

- Unified workflow contract validator: **passed**
- JavaScript/JSX/TypeScript syntax parse: **108 files passed, 0 syntax errors**
- Base44 JSONC parse: **30 files passed, 0 parse errors**
- Shared workflow manual assertions: **passed**

The dependency-backed Vite build, ESLint run, and Vitest suite were not rerun in the packaging environment because the package mirror returned an incomplete installation. The source package does not include that incomplete `node_modules` directory.

## 9. Remaining Limitations

The unified workflow is implemented, but the following contract items still require production integration or additional workflow expansion:

- external malware-scanning service
- production email provider and delivery confirmation
- short-lived signed evidence URLs
- dedicated extension-request/approval records and manager approval screen
- formal risk-acceptance approval chain beyond status/expiry capture
- technical-assessment sub-workflow for closure verification
- configurable workflow/status administration screens rather than code-defined canonical values
- large-volume pagination, load testing, retention, and archive policy
- deployed Base44 runtime verification of functions, schedules, RLS, and migrations

These limitations do not create separate workflows by audit type; they are shared production-hardening or feature-completion items.
