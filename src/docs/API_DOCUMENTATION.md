# Compliance Management Tool — API Documentation

## Authentication

Frontend calls use the authenticated Base44 SDK client. Backend functions call `base44.auth.me()` and reject unauthenticated requests. Service-role entity access is used only inside backend functions after an authorization decision.

## Entity API

The application uses the standard Base44 entity SDK:

```javascript
await base44.entities.Audit.list("-created_date", 100);
await base44.entities.EvidenceRequest.filter({ audit_id: auditId });
await base44.entities.Finding.create(payload);
await base44.entities.CorrectionPlan.update(id, payload);
```

Entity operations remain subject to the schema RLS under `base44/entities`.

## Backend Functions

### `secure-evidence-access`

Purpose: authorize access to a specific evidence submission.

Request:

```json
{
  "submissionId": "<EvidenceSubmission.id>"
}
```

Successful response:

```json
{
  "evidence": {
    "id": "...",
    "master_evidence_id": "EV-...",
    "display_title": "...",
    "original_file_name": "...",
    "file_url": "...",
    "file_type": "pdf",
    "file_size": 12345,
    "version": 2,
    "confidentiality_classification": "confidential",
    "approval_status": "approved",
    "validity_status": "Valid"
  }
}
```

Errors:

- `400` missing submission ID
- `401` not authenticated
- `403` role, scope or clearance denied
- `404` evidence/request not found

Every allowed or denied access attempt is written to `AuditTrail`.

### `reporting-export`

Purpose: governed export for Power BI and approved reporting consumers.

Request:

```json
{
  "dataset": "evidence_requests",
  "limit": 5000,
  "updatedSince": "2026-08-01T00:00:00Z"
}
```

`updatedSince` is optional. `limit` is capped at 10,000 rows per invocation. Lookup datasets have no incremental key; `status_histories` uses `event_id` and `changed_at`.

Supported dataset values:

- `audits`
- `frameworks`
- `domains`
- `controls`
- `audit_controls`
- `expected_evidence`
- `evidence_conditions`
- `evidence_requests`
- `evidence_submissions`
- `evidence_mappings`
- `owners`
- `owner_groups`
- `organizational_units`
- `sites`
- `systems`
- `findings`
- `correction_plans`
- `notifications`
- `audit_trail`
- `compliance_snapshots`
- `audit_types`
- `evidence_statuses`
- `compliance_statuses`
- `status_histories`

Response:

```json
{
  "dataset": "evidence_requests",
  "entity": "EvidenceRequest",
  "exported_at": "2026-08-01T10:00:00Z",
  "row_count": 150,
  "stable_key": "id",
  "incremental_key": "updated_date",
  "rows": []
}
```

Allowed roles: System Administrator, Compliance Administrator, Compliance Officer, Auditor and Executive Viewer, plus the legacy admin role.

### `compliance-automation`

Purpose: scheduled or manual compliance status processing.

Request: empty object.

Response summary:

```json
{
  "success": true,
  "processed_at": "...",
  "summary": {
    "evidence_requests_overdue": 0,
    "evidence_expired": 0,
    "evidence_expiring_soon": 0,
    "corrective_actions_overdue": 0
  }
}
```

Runs hourly through its Base44 automation definition.

### `end-of-day-digest`

Purpose: consolidate queued end-of-day notifications.

Runs daily at 14:00 UTC / 17:00 Asia/Riyadh.

The development adapter creates an in-app digest, updates queued items and logs the email content. A production email provider can replace this adapter without changing the notification data model.

### `compliance-snapshot`

Purpose: record daily compliance trend points for organization, framework, domain and site scopes.

Runs daily and creates immutable `ComplianceSnapshot` rows.

## File Uploads

Uploads use:

```javascript
const { file_url } = await base44.integrations.Core.UploadFile({ file });
```

Before upload, the application validates:

- configured extension
- maximum size of 25 MB
- meaningful evidence title
- required metadata
- formal approval fields when applicable
- completion of all condition responses

After upload, SHA-256 is calculated and stored. Exact duplicates can reuse an existing master evidence record.

## Audit Logging Contract

Important actions create `AuditTrail` records containing:

- user ID and display name
- action
- record type and ID
- record name
- previous and new JSON values
- comment/reason
- timestamp

AuditTrail update and delete are denied by entity RLS.

## Error Handling

- User-facing operations catch entity/function errors and display the returned message.
- Backend functions return structured JSON errors with HTTP status codes.
- Audit logging failures do not break the primary transaction but are written to the browser/server console for investigation.
- Production monitoring should alert when audit logging or notification dispatch fails.
