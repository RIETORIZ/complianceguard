# Compliance Management Tool

Evidence-driven compliance operations for regulatory frameworks, audits, evidence requests and submissions, findings, corrective actions, notifications, dashboards, reports and Power BI integration.

## Technology

- React 18 + Vite + Tailwind CSS
- Base44 authentication, persistent entities, files and backend functions
- Version-controlled schemas under `base44/entities`
- Scheduled automation under `base44/functions`
- Vitest for deterministic compliance and authorization rules

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

For frontend-only development against the hosted backend, update `.env.local`:

```dotenv
VITE_BASE44_APP_ID=6a6dcc68d9385572345614dd
VITE_BASE44_APP_BASE_URL=https://your-published-app.base44.app
```

Never place production secrets in `VITE_*` variables.

## Quality Gate

```bash
npm run validate
npm audit
```

`npm run validate` executes:

1. JavaScript type checking
2. production build
3. ESLint error gate
4. automated tests

## Demonstration Data

Sign in with an administrative role and select:

**Administration → Seed Data → Run Seed**

The seed is idempotent and covers:

- all seven required NCA framework records
- ECC Self-Assessment
- two OTCC site assessments
- Internal Audit
- Technical Assessment imported scenario
- Correction Plan
- every evidence-request status
- every compliance status
- versioned and reused evidence
- findings and corrective actions
- immediate and end-of-day notifications
- compliance trends

Sample files:

- `/samples/technical-assessment-import.csv`
- `/samples/correction-plan-import.csv`

## Backend Functions

- `secure-evidence-access`
- `reporting-export`
- `compliance-automation`
- `end-of-day-digest`
- `compliance-snapshot`

Verify function deployment and schedules after publishing the Base44 application.

## Documentation

- [Architecture](src/docs/ARCHITECTURE.md)
- [Requirement Traceability Matrix](src/docs/REQUIREMENT_TRACEABILITY_MATRIX.md)
- [Validation Report](src/docs/VALIDATION_REPORT.md)
- [API Documentation](src/docs/API_DOCUMENTATION.md)
- [Power BI Model](src/docs/POWER_BI_MODEL.md)
- [Security](src/docs/SECURITY.md)
- [Deployment](src/docs/DEPLOYMENT.md)
- [Known Limitations](src/docs/KNOWN_LIMITATIONS.md)

## Release Position

The source is suitable for controlled demonstration and acceptance testing after the quality gate passes. Production release additionally requires malware scanning, short-lived evidence delivery, enterprise SSO, email integration, penetration testing, privacy/data-residency approval and runtime verification of scheduled functions.
