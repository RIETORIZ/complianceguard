import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Download, ExternalLink, FileText, Lock, ShieldCheck } from "lucide-react";

export default function EvidencePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await base44.functions.invoke("secure-evidence-access", { submissionId: id });
        const payload = response?.data || response;
        if (active) setEvidence(payload?.evidence || null);
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.error || requestError?.message || "Evidence access was denied.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (error || !evidence) return <div className="max-w-lg mx-auto mt-16 bg-white border border-red-200 rounded-2xl p-8 text-center"><Lock className="w-10 h-10 text-red-500 mx-auto" /><h1 className="font-semibold mt-3">Evidence unavailable</h1><p className="text-sm text-slate-500 mt-2">{error || "The evidence does not exist or your scope and confidentiality clearance do not permit access."}</p><Link to="/audits" className="inline-flex mt-4 text-sm text-blue-700">Return to audits</Link></div>;

  return <div className="max-w-4xl mx-auto space-y-5">
    <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="w-4 h-4" />Back</button>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-6 border-b flex items-start justify-between gap-4"><div className="flex gap-3"><div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6 text-slate-600" /></div><div><h1 className="text-xl font-bold text-slate-900">{evidence.display_title}</h1><p className="text-sm text-slate-500">Master {evidence.master_evidence_id} · Version {evidence.version}</p></div></div><div className="flex gap-2"><a href={evidence.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"><ExternalLink className="w-4 h-4" />Open file</a><a href={evidence.file_url} download={evidence.original_file_name} className="inline-flex items-center gap-1.5 border px-3 py-2 rounded-lg text-sm"><Download className="w-4 h-4" />Download</a></div></div>
      <div className="p-6 grid md:grid-cols-3 gap-4 text-sm"><Meta label="Original filename" value={evidence.original_file_name} /><Meta label="File type / size" value={`${evidence.file_type || "—"} · ${formatBytes(evidence.file_size)}`} /><Meta label="Classification" value={evidence.confidentiality_classification} /><Meta label="Approval" value={evidence.approval_status} /><Meta label="Validity" value={evidence.validity_status} /><Meta label="Expiry" value={evidence.expiry_date || "Not set"} /><Meta label="Uploaded" value={formatDate(evidence.upload_date)} /><Meta label="Received" value={formatDate(evidence.received_date)} /></div>
      <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100 flex gap-2 text-xs text-emerald-800"><ShieldCheck className="w-4 h-4 flex-shrink-0" />Access was authorized by the server-side evidence gateway and this preview event was recorded in the immutable audit trail.</div>
    </div>
  </div>;
}

function Meta({ label, value }) { return <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div><div className="mt-1 text-slate-800 break-all">{value || "—"}</div></div>; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : "—"; }
function formatBytes(value = 0) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`; }
