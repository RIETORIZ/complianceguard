# Compliance Management Tool — Power BI Reporting Model

## 1. Connection Approach

Use the authenticated Base44 backend function `reporting-export`. Request each dataset separately and load the results into Power Query. Do not embed permanent credentials in PBIX files. Store the reporting identity/token in the approved Power BI gateway or organizational secret store.

Every response exposes:

- `id` as the stable row key
- `updated_date` as the incremental-refresh key
- `exported_at`
- dataset name and entity name
- row count

## 2. Recommended Star Schema

### Fact tables

- **FactAuditControl** — `AuditControl`
- **FactEvidenceRequest** — `EvidenceRequest`
- **FactEvidenceSubmission** — `EvidenceSubmission`
- **BridgeEvidenceMapping** — `EvidenceMapping`
- **FactFinding** — `Finding`
- **FactCorrectionPlan** — `CorrectionPlan`
- **FactStatusActivity** — `AuditTrail` or normalized status histories
- **FactComplianceSnapshot** — `ComplianceSnapshot` when added to the export catalog for historical trend extraction

### Dimension tables

- **DimAudit** — `Audit`
- **DimFramework** — `Framework`
- **DimDomain** — `Domain`
- **DimControl** — `Control`
- **DimExpectedEvidence** — `ExpectedEvidence`
- **DimEvidenceCondition** — `EvidenceCondition`
- **DimOwner** — `Owner`
- **DimOwnerGroup** — `OwnerGroup`
- **DimOrgUnit** — `OrgUnit`
- **DimSite** — `Site`
- **DimSystem** — `System`
- **DimDate** — generated in Power BI

## 3. Core Relationships

| From | Key | To | Key | Cardinality |
|---|---|---|---|---|
| AuditControl | audit_id | Audit | id | many-to-one |
| AuditControl | control_id | Control | id | many-to-one |
| AuditControl | domain_id | Domain | id | many-to-one |
| EvidenceRequest | audit_id | Audit | id | many-to-one |
| EvidenceRequest | audit_control_id | AuditControl | id | many-to-one |
| EvidenceRequest | expected_evidence_id | ExpectedEvidence | id | many-to-one |
| EvidenceSubmission | evidence_request_id | EvidenceRequest | id | many-to-one |
| EvidenceMapping | evidence_submission_id | EvidenceSubmission | id | many-to-one |
| EvidenceMapping | evidence_request_id | EvidenceRequest | id | many-to-one |
| EvidenceMapping | audit_control_id | AuditControl | id | many-to-one |
| ExpectedEvidence | control_id | Control | id | many-to-one |
| EvidenceCondition | expected_evidence_id | ExpectedEvidence | id | many-to-one |
| Finding | source_audit_id | Audit | id | many-to-one |
| Finding | audit_control_id | AuditControl | id | many-to-one |
| Finding | evidence_request_id | EvidenceRequest | id | many-to-one |
| CorrectionPlan | finding_id | Finding | id | many-to-one |
| CorrectionPlan | audit_id | Audit | id | many-to-one |
| Owner | sector_id / department_id / division_id | OrgUnit | id | many-to-one |
| Audit | site_id | Site | id | many-to-one |

Array ownership fields such as `assigned_owner_ids`, `control_level_owners`, and `supporting_owner_ids` should be expanded into bridge tables in Power Query.

## 4. Suggested Power Query Pattern

1. Invoke `reporting-export` for the required dataset.
2. Convert `rows` to a table.
3. Apply data types explicitly.
4. Expand owner arrays into bridge tables.
5. Use `updatedSince` during incremental refresh.
6. Keep evidence storage URLs out of general management datasets and reports.

## 5. Recommended Measures

### Weighted compliance percentage

```DAX
Compliance % =
VAR Applicable =
    CALCULATE(
        COUNTROWS(FactAuditControl),
        FactAuditControl[compliance_status] <> "Not Applicable"
    )
VAR Weighted =
    CALCULATE(COUNTROWS(FactAuditControl), FactAuditControl[compliance_status] = "Implemented")
    + 0.5 * CALCULATE(COUNTROWS(FactAuditControl), FactAuditControl[compliance_status] = "Partially Implemented")
RETURN DIVIDE(Weighted, Applicable, 0)
```

### Overdue evidence

Count requests where the persisted status is `Overdue`. For near-real-time analysis before the hourly job runs, additionally calculate requests whose due date is past and whose status is not Received, Partially Received, Not Applicable or Not Available.

### Accepted evidence rate

Count request review states `accepted` and `accepted_with_observation` divided by requests with submitted evidence.

### Correction-plan completion rate

Closed correction plans divided by all correction plans, plus average completion percentage for open plans.

## 6. Recommended Report Pages

- Executive compliance overview
- Audit portfolio
- Evidence lifecycle
- Evidence expiry and reuse impact
- Compliance by framework/domain/site/department
- Ownership and overdue accountability
- Findings and regulatory impact
- Corrective-action progress and escalation
- Historical trends
- Drill-through control and evidence request page

## 7. Security

- Use a dedicated reporting identity with the Executive Viewer or approved reporting role.
- Apply Power BI row-level security when different business units access the same semantic model.
- Do not import restricted evidence URLs into broad management models.
- AuditTrail exports contain sensitive operational activity and should be restricted.
- Incremental-refresh partitions and cached extracts must follow organizational retention and classification policy.

## 8. Refresh Strategy

- Operational dashboards: every 30–60 minutes where justified.
- Management dashboards: daily or several times per day.
- Compliance snapshots: daily historical trend.
- Large deployments: use a governed data warehouse or lakehouse staging layer rather than repeatedly extracting all operational entities.
