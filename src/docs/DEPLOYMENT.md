# Compliance Management Tool — Installation, Configuration and Deployment

## Prerequisites

- Node.js 20 or later
- npm
- Access to the Base44 application/workspace
- Base44 Builder plan or equivalent source-development access

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

For frontend-only development, set:

```dotenv
VITE_BASE44_APP_ID=6a6dcc68d9385572345614dd
VITE_BASE44_APP_BASE_URL=https://your-published-app.base44.app
```

The Base44 development environment can inject these values automatically when the project is run through the platform tooling.

## Quality Gate

Before publication:

```bash
npm run validate
npm audit
```

The validation script runs the production build, ESLint error gate and Vitest suite.

## Base44 Resources

Version-controlled resources:

```text
base44/entities/*.jsonc
base44/functions/*/function.jsonc
base44/functions/*/index.ts
base44/config.jsonc
```

The application includes scheduled functions. After deployment/publication verify that the following resources are active:

- `compliance-automation` — hourly
- `end-of-day-digest` — 17:00 Asia/Riyadh
- `compliance-snapshot` — daily
- `secure-evidence-access` — on demand
- `reporting-export` — on demand

## Initial Data

1. Sign in as System Administrator or Compliance Administrator.
2. Open **Administration → Seed Data**.
3. Select **Run Seed**.
4. The seed is idempotent and updates its demonstration records without duplicating the primary dataset.

Sample imports are available from Administration:

- `public/samples/technical-assessment-import.csv`
- `public/samples/correction-plan-import.csv`

## Test Users

Base44 user accounts must be registered or invited through the platform. The application does not include hard-coded passwords.

Recommended acceptance-test users:

| Test identity | Application role | Scope configuration |
|---|---|---|
| sysadmin-test | System Administrator | unrestricted |
| compliance-admin-test | Compliance Administrator | unrestricted compliance administration |
| auditor-test | Auditor | selected audits/frameworks |
| auditee-test | Auditee | linked Owner ID and assigned org/site/system |
| department-manager-test | Department Manager | linked department and confidentiality clearance |
| external-auditor-test | External Auditor | assigned audit and explicit evidence clearance |
| executive-test | Executive Viewer | reports/dashboard only |

Set the user profile fields:

- `role`
- `owner_id`
- `sector_id`
- `department_id`
- `division_id`
- `site_ids`
- `system_ids`
- `evidence_clearance`

## Production Integration Configuration

Configure through Base44 or the approved enterprise secret store:

- email provider credentials
- malware scanner endpoint/credentials
- SIEM ingestion endpoint/token
- enterprise SSO configuration
- reporting service identity

Do not expose secrets in `VITE_*` variables because those values are included in browser bundles.

## Publication Acceptance Checklist

1. Entity schemas synchronized successfully.
2. RLS rules active, including immutable AuditTrail.
3. Backend functions deployed.
4. Scheduled functions enabled with correct timezone interpretation.
5. Seed or approved master data loaded.
6. Role test identities configured.
7. Evidence access tested for allowed and denied users.
8. Immediate and end-of-day notification adapter tested.
9. Power BI reporting identity tested.
10. Report links verified after publication.
11. Malware scanning connected or uploads explicitly treated as non-production.
12. Penetration and privacy testing completed.

## Rollback

Use a Base44 checkpoint or source-control commit to restore a known-good version. A pre-remediation checkpoint was created before the validation changes, and a final checkpoint should be created after acceptance.
