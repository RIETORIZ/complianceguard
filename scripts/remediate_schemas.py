from pathlib import Path
import json

# User schema: preserve legacy roles while adding required enterprise roles and scope fields.
p = Path('base44/entities/User.jsonc')
user = json.loads(p.read_text())
user['properties'] = {
    'role': {
        'type': 'string',
        'description': 'Enterprise application role',
        'enum': ['admin', 'user', 'System Administrator', 'Compliance Administrator', 'Compliance Officer', 'Auditor', 'Auditee', 'Control Owner', 'Department Manager', 'Division Manager', 'Sector Manager', 'External Auditor', 'Executive Viewer'],
        'default': 'Auditee',
    },
    'owner_id': {'type': 'string', 'description': 'Linked Owner record'},
    'sector_id': {'type': 'string'},
    'department_id': {'type': 'string'},
    'division_id': {'type': 'string'},
    'site_ids': {'type': 'array', 'items': {'type': 'string'}},
    'system_ids': {'type': 'array', 'items': {'type': 'string'}},
    'evidence_clearance': {'type': 'string', 'enum': ['public', 'internal', 'confidential', 'restricted'], 'default': 'internal'},
}
user['required'] = ['role']
p.write_text(json.dumps(user, indent=2))

# EvidenceSubmission metadata and review fields.
p = Path('base44/entities/EvidenceSubmission.jsonc')
s = json.loads(p.read_text())
s['properties'].update({
    'description': {'type': 'string'},
    'evidence_type': {'type': 'string'},
    'responsible_department_id': {'type': 'string'},
    'related_system_id': {'type': 'string'},
    'related_asset': {'type': 'string'},
    'related_site_id': {'type': 'string'},
    'evidence_date': {'type': 'string', 'format': 'date'},
    'document_version': {'type': 'string'},
    'approving_authority': {'type': 'string'},
    'change_description': {'type': 'string'},
    'superseded_date': {'type': 'string', 'format': 'date-time'},
    'review_status': {'type': 'string', 'enum': ['awaiting_review', 'accepted', 'accepted_with_observation', 'rejected', 'clarification_requested', 'further_comments_requested', 'corrected_file_requested', 'updated_evidence_requested', 'formal_approval_requested', 'partially_sufficient'], 'default': 'awaiting_review'},
    'review_comments': {'type': 'string'},
    'rejection_reason': {'type': 'string'},
    'reviewed_by_id': {'type': 'string'},
    'acceptance_date': {'type': 'string', 'format': 'date-time'},
    'rejection_date': {'type': 'string', 'format': 'date-time'},
    'validity_status': {'type': 'string', 'enum': ['Valid', 'Expiring Soon', 'Expired', 'Pending Renewal', 'Superseded', 'Under Review'], 'default': 'Under Review'},
    'malware_scan_status': {'type': 'string', 'enum': ['not_scanned', 'pending', 'clean', 'infected', 'failed'], 'default': 'not_scanned'},
})
p.write_text(json.dumps(s, indent=2))

# Protect official regulatory wording. Custom controls use a separate field.
p = Path('base44/entities/Control.jsonc')
c = json.loads(p.read_text())
c['properties']['official_text']['rls'] = {
    'read': True,
    'write': {'$or': [
        {'user_condition': {'role': 'admin'}},
        {'user_condition': {'role': 'System Administrator'}},
        {'user_condition': {'role': 'Compliance Administrator'}},
    ]},
}
c['properties']['custom_requirement_text'] = {'type': 'string', 'description': 'Organization-specific or custom requirement text'}
p.write_text(json.dumps(c, indent=2))

all_roles = ['admin', 'user', 'System Administrator', 'Compliance Administrator', 'Compliance Officer', 'Auditor', 'Auditee', 'Control Owner', 'Department Manager', 'Division Manager', 'Sector Manager', 'External Auditor', 'Executive Viewer']
privileged = ['admin', 'System Administrator', 'Compliance Administrator']
auditors = privileged + ['Compliance Officer', 'Auditor']
submitters = auditors + ['Auditee', 'Control Owner']
managers = ['Department Manager', 'Division Manager', 'Sector Manager', 'Executive Viewer']

def role_rule(roles):
    return {'$or': [{'user_condition': {'role': role}} for role in roles]}

read_rule = role_rule(all_roles)
policy = {
    'Framework': (privileged, privileged, privileged),
    'Domain': (privileged, privileged, privileged),
    'Control': (privileged, privileged, privileged),
    'ExpectedEvidence': (auditors, auditors, privileged),
    'EvidenceCondition': (auditors, auditors, privileged),
    'OrgUnit': (privileged, privileged, privileged),
    'Site': (privileged, privileged, privileged),
    'System': (privileged, privileged, privileged),
    'OwnerGroup': (privileged, privileged, privileged),
    'Owner': (privileged, privileged, privileged),
    'Audit': (auditors, auditors, privileged),
    'AuditControl': (auditors, auditors, privileged),
    'EvidenceRequest': (auditors, submitters, privileged),
    'EvidenceSubmission': (submitters, submitters, privileged),
    'EvidenceMapping': (submitters, auditors, privileged),
    'Finding': (auditors, auditors, privileged),
    'CorrectionPlan': (auditors, submitters, privileged),
    'Notification': (submitters, submitters, privileged),
}

for path in Path('base44/entities').glob('*.jsonc'):
    data = json.loads(path.read_text())
    name = data.get('name')
    if name == 'User':
        continue
    if name == 'AuditTrail':
        data['rls'] = {
            'create': read_rule,
            'read': role_rule(auditors + managers),
            'update': False,
            'delete': False,
        }
    elif name in policy:
        create_roles, update_roles, delete_roles = policy[name]
        data['rls'] = {
            'create': role_rule(create_roles),
            'read': read_rule,
            'update': role_rule(update_roles),
            'delete': role_rule(delete_roles),
        }
    else:
        data['rls'] = {
            'create': role_rule(privileged),
            'read': read_rule,
            'update': role_rule(privileged),
            'delete': role_rule(privileged),
        }
    path.write_text(json.dumps(data, indent=2))

# Package scripts.
p = Path('package.json')
pkg = json.loads(p.read_text())
pkg['scripts']['test'] = 'vitest run'
pkg['scripts']['validate'] = 'npm run build && npm run lint && npm run test'
p.write_text(json.dumps(pkg, indent=2))
