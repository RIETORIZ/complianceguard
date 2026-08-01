# Compliance Workflow Implementation Contract

## 1. Purpose

This specification defines the required workflow from:

**Control creation → Evidence request → Evidence submission → Evidence review → Compliance evaluation → Audit response → Finding → Correction plan → Verification → Closure**

When reviewing or modifying the application code, every feature, database table, API endpoint, status transition, notification, and user-interface action should be checked against this specification.

---

# 2. Core Workflow Rule

The application must maintain the following as separate concepts:

```yaml
status_dimensions:
  evidence_request_status:
    purpose: Tracks whether requested evidence has been provided
  evidence_review_decision:
    purpose: Tracks the auditor's decision on submitted evidence
  compliance_status:
    purpose: Tracks whether the control is implemented
  finding_status:
    purpose: Tracks the lifecycle of an identified compliance gap
  correction_plan_status:
    purpose: Tracks remediation and closure activity
```

These statuses must never be combined into one field.

Example:

```yaml
example:
  evidence_request_status: Received
  evidence_review_decision: Pending Review
  compliance_status: Under Evaluation
```

Receiving evidence does not mean that a control is implemented.

---

# 3. Roles

```yaml
roles:
  system_administrator:
    responsibilities:
      - Manage users
      - Manage permissions
      - Manage system configuration

  compliance_administrator:
    responsibilities:
      - Manage frameworks
      - Manage regulatory controls
      - Manage evidence templates
      - Manage statuses and workflows
      - Manage notification rules

  auditor:
    responsibilities:
      - Create audits
      - Add controls
      - Define evidence requirements
      - Request evidence
      - Review evidence
      - Evaluate controls
      - Create findings
      - Create correction plans
      - Verify closure

  compliance_officer:
    responsibilities:
      - Perform auditor functions according to assigned permissions
      - Monitor audits and evidence requests
      - Prepare reports

  auditee:
    responsibilities:
      - Respond to evidence requests
      - Upload evidence
      - Complete evidence checklists
      - Provide comments
      - Respond to findings
      - Submit correction-plan updates

  control_owner:
    responsibilities:
      - Own control implementation
      - Coordinate evidence submission
      - Respond to compliance evaluation

  evidence_owner:
    responsibilities:
      - Submit specific requested evidence
      - Maintain evidence validity

  correction_plan_owner:
    responsibilities:
      - Implement corrective actions
      - Submit progress updates
      - Submit closure evidence

  manager:
    responsibilities:
      - Monitor assignments
      - Approve extensions where required
      - Receive escalations

  executive_viewer:
    responsibilities:
      - View dashboards and reports
```

---

# 4. Main Entities

```yaml
entities:
  audit:
    required_fields:
      - id
      - name
      - audit_type
      - year
      - framework_id
      - scope
      - status
      - start_date
      - end_date
      - created_by

  control:
    required_fields:
      - id
      - audit_id
      - control_reference
      - title
      - description
      - source_type
      - official_control_id
      - scope
      - compliance_status
      - primary_owner_id
      - created_by

  expected_evidence:
    required_fields:
      - id
      - control_id
      - title
      - description
      - evidence_type
      - mandatory
      - reuse_allowed
      - validity_period
      - approval_required

  evidence_condition:
    required_fields:
      - id
      - expected_evidence_id
      - description
      - mandatory
      - condition_type
      - display_order

  evidence_request:
    required_fields:
      - id
      - expected_evidence_id
      - request_status
      - request_date
      - due_date
      - requester_id
      - notification_method
      - priority

  evidence_submission:
    required_fields:
      - id
      - evidence_request_id
      - master_evidence_id
      - submitted_by
      - submitted_at
      - received_at
      - review_decision

  master_evidence:
    required_fields:
      - id
      - display_title
      - original_file_name
      - stored_file_name
      - storage_location
      - file_type
      - file_size
      - file_hash
      - version
      - owner_id
      - uploaded_at
      - effective_date
      - review_date
      - expiry_date
      - confidentiality_classification

  evidence_control_mapping:
    required_fields:
      - id
      - master_evidence_id
      - control_id
      - expected_evidence_id
      - mapping_status
      - auditor_decision

  finding:
    required_fields:
      - id
      - audit_id
      - control_id
      - title
      - description
      - severity
      - risk_rating
      - status
      - primary_owner_id
      - due_date

  correction_plan:
    required_fields:
      - id
      - finding_id
      - control_id
      - corrective_action
      - required_closure_evidence
      - primary_owner_id
      - target_date
      - completion_percentage
      - status

  status_history:
    required_fields:
      - id
      - entity_type
      - entity_id
      - previous_status
      - new_status
      - changed_by
      - changed_at
      - reason

  audit_log:
    required_fields:
      - id
      - actor_id
      - action
      - entity_type
      - entity_id
      - previous_value
      - new_value
      - timestamp
      - reason
```

---

# 5. Required Status Values

## 5.1 Evidence Request Status

```yaml
evidence_request_status:
  - Requested
  - Received
  - Partially Received
  - Require Further Comments
  - Not Applicable
  - Not Available
  - Overdue
```

Default:

```yaml
default_evidence_request_status: Requested
```

---

## 5.2 Evidence Review Decision

```yaml
evidence_review_decision:
  - Pending Review
  - Accepted
  - Accepted with Observation
  - Partially Sufficient
  - Revision Required
  - Rejected
  - Expired
  - Superseded
```

Default after submission:

```yaml
default_evidence_review_decision: Pending Review
```

---

## 5.3 Compliance Status

```yaml
compliance_status:
  - Under Evaluation
  - Implemented
  - Partially Implemented
  - Not Implemented
  - Not Applicable
```

Default:

```yaml
default_compliance_status: Under Evaluation
```

---

## 5.4 Finding Status

```yaml
finding_status:
  - Draft
  - Open
  - Management Response Required
  - Correction Plan Required
  - Under Remediation
  - Pending Verification
  - Closed
  - Risk Accepted
  - Cancelled
```

---

## 5.5 Correction Plan Status

```yaml
correction_plan_status:
  - Draft
  - Awaiting Owner Response
  - Open
  - In Progress
  - Pending Closure Evidence
  - Submitted for Verification
  - Revision Required
  - Verified
  - Closed
  - Overdue
  - On Hold
  - Cancelled
  - Risk Accepted
```

---

# 6. End-to-End Workflow

## Stage 1: Create or Select Audit

```yaml
stage: audit_creation
actor:
  - auditor
  - compliance_officer

inputs:
  - audit_type
  - framework
  - year
  - scope
  - site
  - audit_name

system_actions:
  - Generate default audit name
  - Create audit workspace
  - Record creation in audit log

default_name_rule:
  standard_framework: "{year} {framework}"
  otcc_site: "{year} OTCC - {site_name}"

outputs:
  - Audit created
  - Audit saved as draft
  - Audit creation rejected due to missing required data
```

---

## Stage 2: Add Control

```yaml
stage: control_creation

control_sources:
  - Official regulatory framework
  - Manual custom control
  - Excel import
  - CSV import
  - Previous audit
  - Control template

required_actions:
  - Validate control reference
  - Validate control description
  - Detect duplicates
  - Protect official regulatory wording

duplicate_outputs:
  merge:
    result: Merge the requirement with the existing custom record
  replace:
    result: Replace the existing custom version
  keep_separate:
    result: Create a separate audit requirement
  cancel:
    result: Do not create the new control

successful_output:
  - Control is added to the audit
  - Compliance status is set to Under Evaluation
  - Control creation is logged
```

---

## Stage 3: Define Expected Evidence

```yaml
stage: expected_evidence_configuration

actor:
  - auditor
  - compliance_administrator

actions:
  - Add expected evidence
  - Set evidence as mandatory or optional
  - Define evidence type
  - Define accepted file formats
  - Define validity period
  - Define approval requirement
  - Define evidence reuse permission
  - Add examples
  - Add common rejection reasons
```

Possible evidence types:

```yaml
evidence_types:
  - Policy
  - Procedure
  - Standard
  - Screenshot
  - Configuration Review
  - System Report
  - Access Review
  - Approval Record
  - Meeting Minutes
  - Risk Assessment
  - Training Record
  - Technical Export
  - Penetration Test Report
  - Vulnerability Report
  - Backup Report
  - Contract
  - Other
```

---

## Stage 4: Define Evidence Conditions

```yaml
stage: evidence_conditions

condition_examples:
  - Meaningful file name
  - Document is current
  - Document is approved
  - Approval authority is visible
  - Approval date is visible
  - Version number is visible
  - Screenshot is full screen
  - System name is visible
  - Date and time are visible
  - Correct configuration is visible
  - Correct site is covered
  - Correct system is covered
  - Correct department is covered
  - Sensitive information is masked
  - File is readable
  - File is not corrupted
  - Correct reporting period is covered
```

Each condition must support:

```yaml
condition_fields:
  - description
  - mandatory
  - auditor_editable
  - auditee_confirmation_required
  - display_order
```

---

## Stage 5: Assign Owners

```yaml
stage: owner_assignment

assignment_levels:
  - Audit
  - Control
  - Expected Evidence
  - Evidence Request
  - Finding
  - Correction Plan

assignable_targets:
  - Person
  - Multiple people
  - Group
  - Division
  - Department
  - Sector

required_capabilities:
  - Search by person name
  - Search by email
  - Search by division
  - Search by department
  - Search by sector
  - Search by group
  - Assign primary accountable owner
  - Assign supporting owners
```

Outputs:

```yaml
owner_assignment_outputs:
  - Owner assigned
  - Multiple owners assigned
  - Group assigned
  - Item left unassigned
  - Inactive owner warning
  - Ownership reassigned
```

---

## Stage 6: Create Evidence Request

```yaml
stage: evidence_request_creation

actor:
  - auditor
  - compliance_officer

required_inputs:
  - expected_evidence
  - assigned_owner
  - request_date
  - due_date
  - priority
  - notification_method

default_status:
  request_status: Requested

notification_methods:
  - Immediate email
  - End-of-day email
  - In-application notification
```

System actions:

```yaml
system_actions:
  - Create evidence request
  - Set request status to Requested
  - Notify assigned owners
  - Start due-date monitoring
  - Record request in audit trail
```

---

## Stage 7: Auditee Reviews Request

```yaml
stage: auditee_request_review

display_to_auditee:
  - Audit name
  - Control number
  - Control description
  - Expected evidence
  - Evidence acceptance conditions
  - File requirements
  - Evidence examples
  - Common rejection reasons
  - Request date
  - Due date
  - Auditor comments
```

---

## Stage 8: Auditee Response

```yaml
auditee_response_options:
  complete_evidence:
    request_status: Received

  partial_evidence:
    request_status: Partially Received

  existing_evidence:
    action: Validate evidence reuse compatibility

  comments_only:
    action: Send comments for auditor review

  not_applicable:
    action: Submit justification for auditor approval

  not_available:
    request_status: Not Available

  extension_request:
    action: Submit proposed due date and justification

  no_response:
    before_due_date: Requested
    after_due_date: Overdue
```

---

## Stage 9: File Validation

```yaml
stage: evidence_file_validation

checks:
  - File type
  - File size
  - Malware scanning integration
  - File readability
  - Duplicate file hash
  - Evidence title
  - Required metadata
  - Expiry information
  - Approval information
```

Poor naming rule:

```yaml
poor_file_name_rule:
  example: fakjsdbfjkvbaksjldbvkjlasd.png

  system_response:
    - Show warning
    - Explain that the evidence may be rejected
    - Require a meaningful evidence display title
    - Suggest a compliant evidence title

  must_not:
    - Automatically reject valid evidence only because of the original local filename
```

Suggested format:

```yaml
evidence_naming_pattern: "{framework}_{control}_{evidence_type}_{system}_{date}"
```

---

## Stage 10: Evidence Submission

```yaml
stage: evidence_submission

auditee_actions:
  - Upload evidence
  - Enter evidence title
  - Complete metadata
  - Complete condition checklist
  - Add comments
  - Submit response

system_actions:
  - Record submitted_at
  - Record received_at
  - Create evidence version
  - Save original filename
  - Save display title
  - Set review decision to Pending Review
  - Update request status
  - Notify auditor
```

Request-status result:

```yaml
submission_status_logic:
  complete_submission: Received
  incomplete_submission: Partially Received
```

---

## Stage 11: Evidence Reuse

```yaml
stage: evidence_reuse

user_action:
  button_label: Add this evidence to other controls

system_checks:
  - Evidence type matches
  - Evidence scope matches
  - Evidence is current
  - Evidence is not expired
  - Evidence conditions are compatible
  - Framework or control relationship is valid

possible_outputs:
  - Evidence linked successfully
  - Auditor approval required
  - Reuse rejected due to scope mismatch
  - Reuse rejected because evidence expired
  - Reuse rejected because conditions differ
```

Important rule:

```yaml
reuse_rule:
  one_master_file: true
  separate_control_mapping: true
  separate_review_decision_per_control: true
  automatic_control_closure: false
```

---

## Stage 12: Auditor Evidence Review

```yaml
stage: evidence_review

auditor_reviews:
  - Submitted file
  - Evidence title
  - Original filename
  - Evidence metadata
  - Evidence conditions
  - Auditee checklist
  - Evidence date
  - Approval status
  - Validity period
  - System or site scope
  - Previous versions
  - Other linked controls
```

Possible outcomes:

```yaml
review_outcomes:
  Accepted:
    request_status: Received
    next_step: Compliance evaluation

  Accepted with Observation:
    request_status: Received
    next_step: Compliance evaluation
    additional_action: Record observation

  Partially Sufficient:
    request_status: Partially Received
    next_step: Request missing evidence

  Require Further Comments:
    request_status: Require Further Comments
    next_step: Return to auditee

  Revision Required:
    review_decision: Revision Required
    next_step: Request corrected or updated evidence

  Rejected:
    review_decision: Rejected
    required_field: Rejection reason
    next_step:
      - Request replacement evidence
      - Create finding when appropriate

  Expired:
    review_decision: Expired
    next_step: Request current evidence

  Superseded:
    review_decision: Superseded
    next_step: Use newer active evidence version
```

---

## Stage 13: Compliance Evaluation

```yaml
stage: control_compliance_evaluation

default_status: Under Evaluation
```

Decision logic:

```yaml
compliance_decisions:
  Implemented:
    conditions:
      - All mandatory evidence is accepted
      - Evidence applies to correct scope
      - Evidence is current
      - Required approvals are available
      - No material gap remains

  Partially Implemented:
    conditions:
      - Some requirements are implemented
      - Some evidence is missing or insufficient
      - Some systems, sites, or departments are not covered

  Not Implemented:
    conditions:
      - Control is absent
      - Evidence confirms non-implementation
      - Required evidence is unavailable
      - Material requirement is not satisfied

  Not Applicable:
    conditions:
      - Justification submitted
      - Auditor validated justification
      - Required approval obtained

  Under Evaluation:
    conditions:
      - Additional evidence required
      - Additional comments required
      - Technical testing pending
      - Scope remains unclear
```

---

## Stage 14: Send Audit Response

```yaml
stage: audit_response

response_contents:
  - Audit name
  - Control number
  - Control description
  - Evidence reviewed
  - Evidence review decision
  - Compliance status
  - Auditor comments
  - Missing requirements
  - Finding details
  - Required next action
  - Due date
  - Correction-plan requirement
```

Possible responses:

```yaml
response_types:
  control_accepted:
    result: Control can be closed

  accepted_with_observation:
    result: Control may be closed while observation is tracked

  additional_evidence_required:
    result: Evidence request remains open

  further_comments_required:
    result: Request status becomes Require Further Comments

  evidence_rejected:
    result:
      - Replacement evidence requested
      - Finding may be created

  partially_implemented:
    result:
      - Finding created
      - Correction plan may be required

  not_implemented:
    result:
      - Finding created
      - Correction plan required

  not_applicable_accepted:
    result: Control status becomes Not Applicable

  not_applicable_rejected:
    result:
      - Request returns to Requested
      - Auditee must provide evidence
```

---

## Stage 15: Finding Decision

```yaml
stage: finding_decision

finding_required_when:
  - Control is Partially Implemented
  - Control is Not Implemented
  - Required evidence is unavailable
  - Evidence confirms a material gap
  - Regulatory requirement is not satisfied
  - Repeated observation remains unresolved

finding_not_required_when:
  - Control is Implemented
  - No material gap exists
  - Issue is only a minor observation
```

Finding outputs:

```yaml
finding_outputs:
  - Observation only
  - Formal finding
  - Correction plan required
  - Immediate escalation
  - Technical assessment required
  - Compensating control required
  - Risk acceptance requested
```

---

## Stage 16: Create Correction Plan

```yaml
stage: correction_plan_creation

creation_sources:
  - Finding
  - Audit observation
  - Technical assessment
  - Regulatory response
  - Imported spreadsheet
  - Manual creation

required_fields:
  - Related finding
  - Related control
  - Gap description
  - Root cause
  - Corrective action
  - Required closure evidence
  - Primary owner
  - Supporting owners
  - Priority
  - Risk level
  - Start date
  - Target date
  - Milestones
```

Initial status:

```yaml
initial_correction_plan_status: Awaiting Owner Response
```

---

## Stage 17: Correction Plan Owner Response

```yaml
correction_plan_owner_options:
  accept_plan:
    next_status: Open

  start_work:
    next_status: In Progress

  propose_alternative_action:
    next_step: Auditor approval

  request_extension:
    next_step: Auditor or manager approval

  add_milestones:
    next_status: In Progress

  submit_progress_update:
    next_status: In Progress

  submit_closure_evidence:
    next_status: Submitted for Verification

  request_risk_acceptance:
    next_step: Risk acceptance workflow

  no_response:
    after_due_date: Overdue
```

---

## Stage 18: Verify Correction Plan

```yaml
stage: correction_plan_verification

auditor_reviews:
  - Corrective action
  - Closure evidence
  - Original finding
  - Related control
  - Implementation scope
  - Completion date
  - Technical validation
  - Management approval
```

Possible outcomes:

```yaml
verification_outcomes:
  Verified:
    correction_plan_status: Closed
    finding_status: Closed
    next_step: Reassess control

  Partially Verified:
    correction_plan_status: Revision Required
    next_step: Request additional remediation

  Closure Evidence Rejected:
    correction_plan_status: Revision Required
    next_step: Request new closure evidence

  Technical Validation Required:
    correction_plan_status: Submitted for Verification
    next_step: Create technical assessment

  Risk Accepted:
    correction_plan_status: Risk Accepted
    finding_status: Risk Accepted
    next_step: Record risk acceptance expiry

  Cancelled:
    correction_plan_status: Cancelled
    required_field: Cancellation reason
```

---

## Stage 19: Reassess Control

```yaml
stage: control_reassessment

possible_transitions:
  - Not Implemented -> Partially Implemented
  - Not Implemented -> Implemented
  - Partially Implemented -> Implemented
  - Partially Implemented -> Partially Implemented
  - Not Implemented -> Not Implemented
  - Any status -> Under Evaluation
  - Any status -> Not Applicable with approval
```

Rules:

```yaml
reassessment_rules:
  - Preserve previous status
  - Record new status in status history
  - Record auditor and date
  - Record reason
  - Do not automatically mark control Implemented solely because correction plan closed
```

---

## Stage 20: Closure and Reporting

```yaml
stage: closure_and_reporting

system_actions:
  - Close eligible correction plan
  - Close eligible finding
  - Update control compliance status
  - Update audit completion percentage
  - Update dashboard metrics
  - Update Power BI reporting views
  - Generate reports
  - Record all actions in audit trail
```

Possible outputs:

```yaml
reporting_outputs:
  - Control response report
  - Evidence status report
  - Finding report
  - Correction plan report
  - Audit summary
  - Audit presentation
  - Overdue report
  - Owner performance report
  - Power BI dataset
```

---

# 7. Automatic Rules

```yaml
automatic_rules:
  overdue_evidence_request:
    trigger:
      - Current date is after evidence request due date
      - Request is not Received
      - Request is not Partially Received
      - Request is not formally closed
    action:
      - Set request status to Overdue
      - Send notification
      - Record status transition

  overdue_correction_plan:
    trigger:
      - Current date is after correction plan target date
      - Plan is not Closed
      - Plan is not Cancelled
      - Plan is not Risk Accepted
    action:
      - Set correction plan status to Overdue
      - Notify owner
      - Escalate according to configured rules

  evidence_expiration:
    trigger:
      - Current date reaches expiry warning threshold
    action:
      - Mark evidence Expiring Soon
      - Notify evidence owner

  expired_shared_evidence:
    trigger:
      - Shared evidence expires
    action:
      - Identify all linked controls
      - Notify affected control owners and auditors
      - Reopen evaluation where required
```

---

# 8. Mandatory Invariants

The following rules must always be enforced:

```yaml
invariants:
  - Evidence request status is separate from evidence review decision
  - Evidence review decision is separate from compliance status
  - Compliance status is separate from correction plan status
  - Receiving evidence does not automatically implement a control
  - Rejected evidence remains in the history
  - New versions do not overwrite old evidence
  - Not Applicable requires justification
  - Rejection requires a reason
  - Revision Required requires a reason
  - Cancellation requires a reason
  - Status overrides require a reason
  - One evidence file may map to multiple controls
  - Every control mapping has its own review decision
  - Shared evidence does not automatically close linked controls
  - Closing a correction plan triggers control reassessment
  - Closing a finding does not automatically mark a control Implemented
  - Every important action is logged
```

---

# 9. Required User Interface Areas

```yaml
ui_pages:
  dashboard:
    required:
      - Audit metrics
      - Evidence metrics
      - Compliance metrics
      - Findings
      - Correction plans
      - Ownership metrics

  audit_workspace:
    required:
      - Domains
      - Controls
      - Evidence requirements
      - Owners
      - Findings
      - Correction plans

  control_details:
    required:
      - Control description
      - Compliance status
      - Expected evidence
      - Evidence mappings
      - Findings
      - Status history

  evidence_request_page:
    required:
      - Evidence conditions
      - Assigned owners
      - Due date
      - Request status
      - Submission log

  evidence_submission_page:
    required:
      - File upload
      - Naming warning
      - Evidence metadata
      - Condition checklist
      - Reuse action

  evidence_review_page:
    required:
      - Evidence preview
      - Conditions
      - Checklist
      - Review decision
      - Auditor comments
      - Linked controls

  findings_page:
    required:
      - Finding details
      - Severity
      - Owner
      - Due date
      - Status

  correction_plan_page:
    required:
      - Corrective action
      - Milestones
      - Progress
      - Closure evidence
      - Verification decision

  owners_page:
    hierarchy:
      - Sector
      - Department
      - Division
      - Auditee
```

---

# 10. Required API or Service Actions

The code should expose equivalent backend actions for:

```yaml
required_actions:
  audits:
    - create_audit
    - update_audit
    - add_framework_controls
    - create_otcc_site_audits

  controls:
    - add_control
    - import_controls
    - update_custom_control
    - assign_control_owner
    - set_compliance_status

  evidence_requirements:
    - create_expected_evidence
    - update_expected_evidence
    - add_evidence_condition
    - update_evidence_condition

  evidence_requests:
    - create_evidence_request
    - assign_evidence_owner
    - update_due_date
    - request_extension
    - approve_extension

  submissions:
    - upload_evidence
    - submit_existing_evidence
    - complete_evidence_checklist
    - submit_comments
    - submit_not_applicable
    - submit_not_available

  evidence_review:
    - accept_evidence
    - accept_with_observation
    - mark_partially_sufficient
    - request_comments
    - request_revision
    - reject_evidence
    - mark_expired
    - mark_superseded
    - approve_evidence_reuse

  findings:
    - create_finding
    - update_finding
    - close_finding
    - cancel_finding

  correction_plans:
    - create_correction_plan
    - accept_correction_plan
    - propose_alternative_action
    - submit_progress
    - submit_closure_evidence
    - verify_correction_plan
    - reject_closure_evidence
    - accept_risk
    - close_correction_plan

  reporting:
    - generate_audit_report
    - generate_control_report
    - generate_finding_report
    - generate_correction_plan_report
    - expose_power_bi_reporting_data
```

---

# 11. Acceptance Tests

When modifying the application, the following tests must pass:

```yaml
acceptance_tests:
  - Create a new audit
  - Add an official control
  - Add a custom control
  - Detect a duplicate control
  - Define multiple evidence items for one control
  - Define multiple conditions for one evidence item
  - Assign a control to a person
  - Assign evidence to a division
  - Issue an immediate notification
  - Issue an end-of-day notification
  - Upload a badly named file
  - Display naming warning
  - Allow a meaningful display title
  - Complete evidence checklist
  - Record submission timestamp
  - Record received timestamp
  - Set request to Received
  - Set request to Partially Received
  - Request further comments
  - Mark evidence Not Available
  - Submit Not Applicable justification
  - Automatically mark unanswered request Overdue
  - Reuse evidence across multiple controls
  - Keep separate mapping decisions
  - Accept evidence without automatically implementing control
  - Reject evidence with mandatory reason
  - Mark control Partially Implemented
  - Create finding
  - Create correction plan
  - Submit progress update
  - Submit closure evidence
  - Reject insufficient closure evidence
  - Verify correction plan
  - Reassess control after closure
  - Preserve previous compliance status
  - Update dashboard from real data
  - Expose reporting data for Power BI
  - Block unauthorized evidence access
```

---

# 12. Instructions for Code Review and Modification

When this specification is provided with the project code, perform the following:

```yaml
code_review_process:
  - Inspect the existing architecture
  - Identify frontend and backend technologies
  - Identify database schema and migrations
  - Map existing features to this implementation contract
  - Create a gap analysis
  - Identify missing entities
  - Identify missing statuses
  - Identify invalid status combinations
  - Identify missing API actions
  - Identify non-functional interface buttons
  - Identify hard-coded dashboard data
  - Identify missing access controls
  - Modify the database schema
  - Modify backend services
  - Modify API routes
  - Modify frontend pages
  - Add validation
  - Add notifications
  - Add audit logging
  - Add automated tests
  - Run and validate the complete workflow
```

Required response after reviewing the code:

```yaml
required_code_review_output:
  - Current architecture summary
  - Requirements already implemented
  - Requirements partially implemented
  - Requirements missing
  - Database changes made
  - Backend changes made
  - Frontend changes made
  - Workflow changes made
  - Tests added
  - Validation results
  - Remaining limitations
```
