import { createClientFromRequest } from "npm:@base44/sdk";

const CLEARANCE: Record<string, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const PRIVILEGED = new Set(["admin", "System Administrator", "Compliance Administrator", "Compliance Officer", "Auditor"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { submissionId } = await req.json();
    if (!submissionId || typeof submissionId !== "string") return Response.json({ error: "submissionId is required" }, { status: 400 });

    const admin = base44.asServiceRole;
    const submission = await admin.entities.EvidenceSubmission.get(submissionId);
    if (!submission) return Response.json({ error: "Evidence not found" }, { status: 404 });
    const request = await admin.entities.EvidenceRequest.get(submission.evidence_request_id);
    if (!request) return Response.json({ error: "Evidence request not found" }, { status: 404 });

    const data = user.data || user;
    const role = user.role || "Auditee";
    const ownerId = data.owner_id || "";
    const userClearance = CLEARANCE[data.evidence_clearance || "internal"] ?? 1;
    const evidenceClearance = CLEARANCE[submission.confidentiality_classification || "confidential"] ?? 2;
    const assigned = ownerId && (request.assigned_owner_ids || []).includes(ownerId);
    const submittedByUser = submission.uploaded_by_id === user.id;
    const ownedEvidence = ownerId && submission.owner_id === ownerId;
    const sectorMatch = !request.assigned_sector_id || !data.sector_id || request.assigned_sector_id === data.sector_id;
    const departmentMatch = !request.assigned_department_id || !data.department_id || request.assigned_department_id === data.department_id;
    const divisionMatch = !request.assigned_division_id || !data.division_id || request.assigned_division_id === data.division_id;
    const siteMatch = !submission.related_site_id || !(data.site_ids || []).length || data.site_ids.includes(submission.related_site_id);
    const systemMatch = !submission.related_system_id || !(data.system_ids || []).length || data.system_ids.includes(submission.related_system_id);
    const scoped = sectorMatch && departmentMatch && divisionMatch && siteMatch && systemMatch;
    const allowed = PRIVILEGED.has(role) || ((assigned || submittedByUser || ownedEvidence || ["Department Manager", "Division Manager", "Sector Manager", "External Auditor"].includes(role)) && scoped && userClearance >= evidenceClearance);

    if (!allowed) {
      await admin.entities.AuditTrail.create({ user_id: user.id, user_name: user.full_name || user.email || "", action: "evidence_access_denied", record_type: "EvidenceSubmission", record_id: submissionId, record_name: submission.display_title, timestamp: new Date().toISOString(), reason: "Scope or confidentiality clearance denied" });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await admin.entities.AuditTrail.create({ user_id: user.id, user_name: user.full_name || user.email || "", action: "evidence_previewed", record_type: "EvidenceSubmission", record_id: submissionId, record_name: submission.display_title, timestamp: new Date().toISOString() });
    return Response.json({
      evidence: {
        id: submission.id,
        master_evidence_id: submission.master_evidence_id,
        display_title: submission.display_title,
        original_file_name: submission.original_file_name,
        file_url: submission.file_url,
        file_type: submission.file_type,
        file_size: submission.file_size,
        version: submission.version,
        confidentiality_classification: submission.confidentiality_classification,
        approval_status: submission.approval_status,
        validity_status: submission.validity_status,
        upload_date: submission.upload_date,
        received_date: submission.received_date,
        expiry_date: submission.expiry_date,
      },
    });
  } catch (error) {
    console.error("secure-evidence-access", error);
    return Response.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
});
