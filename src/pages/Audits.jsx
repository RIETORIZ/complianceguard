import React, { useState, useEffect } from "react";
import { Link } from "@/lib/router";
import { base44 } from "@/api/base44Client";
import { logAudit, recordStatusTransition, dispatchNotification } from "@/lib/compliance";
import { Plus, Search, Calendar, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUDIT_TYPES, UNIFIED_AUDIT_WORKFLOW, getDefaultAuditName } from "@/lib/audit-workflow";

export function CreateAuditModal({ open, onClose, onCreated }) {
  const [frameworks, setFrameworks] = useState([]);
  const [sites, setSites] = useState([]);
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState({ framework_id: "", audit_type: "Self-Assessment", site_ids: [], audit_name: "", lead_auditor_id: "", scope: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([base44.entities.Framework.list(), base44.entities.Site.list(), base44.entities.Owner.list()])
      .then(([f, s, o]) => { setFrameworks(f); setSites(s); setOwners(o); });
  }, [open]);

  useEffect(() => {
    const fw = frameworks.find((f) => f.id === form.framework_id);
    if (!fw) return;
    const year = new Date().getFullYear();
    setForm((p) => ({ ...p, audit_name: getDefaultAuditName({ year, frameworkCode: fw.code }) }));
  }, [form.framework_id, frameworks]);

  const populateFrameworkControls = async (audit, framework) => {
    if (!framework?.id) return;
    const controls = await base44.entities.Control.filter({ framework_id: framework.id });
    const topLevel = controls.filter((c) => !c.parent_id);
    if (!topLevel.length) return;
    await base44.entities.AuditControl.bulkCreate(topLevel.map((c, index) => ({
      audit_id: audit.id,
      control_id: c.id,
      framework_id: c.framework_id,
      domain_id: c.domain_id,
      control_number: c.control_number,
      control_title: c.title,
      compliance_status: "Under Evaluation",
      order: index,
    })));
  };

  const submit = async () => {
    const fw = frameworks.find((f) => f.id === form.framework_id);
    if (!fw) return alert("A framework is required for every audit type. Custom controls can be added after creation.");
    if (fw.code === "OTCC" && form.site_ids.length === 0) return alert("Select at least one site. OTCC creates one audit per selected site.");
    setCreating(true);
    const year = new Date().getFullYear();
    try {
      const siteIds = fw.code === "OTCC" ? form.site_ids : [form.site_ids[0] || ""];
      for (const siteId of siteIds) {
        const site = sites.find((item) => item.id === siteId);
        const defaultName = getDefaultAuditName({ year, frameworkCode: fw.code, siteName: site?.name });
        const baseName = form.audit_name?.trim();
        const name = fw.code === "OTCC"
          ? (baseName && baseName.includes(site?.name || siteId) ? baseName : `${baseName || `${year} OTCC`} - ${site?.name || siteId}`)
          : (baseName || defaultName);
        const audit = await base44.entities.Audit.create({
          name,
          audit_year: year,
          framework_id: fw.id,
          framework_code: fw.code,
          audit_type: form.audit_type,
          site_id: siteId,
          status: "active",
          lead_auditor_id: form.lead_auditor_id,
          scope: form.scope,
          audit_level_owners: form.lead_auditor_id ? [form.lead_auditor_id] : [],
          workflow_profile: UNIFIED_AUDIT_WORKFLOW,
          workflow_version: 1,
        });
        await populateFrameworkControls(audit, fw);
        await recordStatusTransition({ entityType: "Audit", entityId: audit.id, previousStatus: "", newStatus: "active", reason: `Created using ${UNIFIED_AUDIT_WORKFLOW}`, auditId: audit.id });
        await logAudit({ action: "audit_created", recordType: "Audit", recordId: audit.id, recordName: name, newValue: audit, comment: UNIFIED_AUDIT_WORKFLOW });
        if (form.lead_auditor_id) {
          const owner = owners.find((item) => item.id === form.lead_auditor_id);
          await dispatchNotification({ recipientId: form.lead_auditor_id, recipientEmail: owner?.work_email, type: "audit_assigned", title: `Assigned as lead auditor: ${audit.name}`, body: `You have been assigned as lead auditor for ${audit.name}. The unified control-to-closure workflow applies.`, relatedRecordType: "Audit", relatedRecordId: audit.id, link: `/audits/${audit.id}` });
        }
      }
      onCreated && onCreated();
      onClose();
    } catch (e) { console.error(e); alert("Failed to create audit: " + e.message); }
    finally { setCreating(false); }
  };

  if (!open) return null;
  const fw = frameworks.find((f) => f.id === form.framework_id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Start New Audit</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Framework</label>
            <select value={form.framework_id} onChange={(e) => setForm((p) => ({ ...p, framework_id: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select framework…</option>
              {frameworks.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Audit Type</label>
            <select value={form.audit_type} onChange={(e) => setForm((p) => ({ ...p, audit_type: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {AUDIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {fw?.code === "OTCC" && (
            <div>
              <label className="text-xs font-medium text-slate-600">Sites (one audit per selected site)</label>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.site_ids.includes(s.id)} onChange={(e) => {
                      setForm((p) => ({ ...p, site_ids: e.target.checked ? [...p.site_ids, s.id] : p.site_ids.filter((x) => x !== s.id) }));
                    }} /> {s.name}
                  </label>
                ))}
                {sites.length === 0 && <p className="text-xs text-slate-400">No sites defined.</p>}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600">Audit Name (editable)</label>
            <input value={form.audit_name} onChange={(e) => setForm((p) => ({ ...p, audit_name: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Lead Auditor</label>
            <select value={form.lead_auditor_id} onChange={(e) => setForm((p) => ({ ...p, lead_auditor_id: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select owner…</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Scope</label>
            <textarea value={form.scope} onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm h-16" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-slate-600 px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={creating || !form.framework_id || (fw?.code === "OTCC" && form.site_ids.length === 0)} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">{creating ? "Creating…" : "Create Audit"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Audits() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const a = await base44.entities.Audit.list("-created_date", 200);
      setAudits(a);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = audits.filter((a) => {
    if (search && !a.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && a.audit_type !== filterType) return false;
    return true;
  });

  const statusColor = { planned: "bg-slate-100 text-slate-700", active: "bg-blue-100 text-blue-700", in_review: "bg-amber-100 text-amber-700", completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-red-100 text-red-700" };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audits</h1>
          <p className="text-sm text-slate-500 mt-1">Manage assessments across all NCA frameworks and audit types.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-800">
          <Plus className="w-4 h-4" /> Start Audit
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audits…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All types</option>
          {AUDIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a) => (
          <Link key={a.id} to={`/audits/${a.id}`} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">{a.framework_code || "—"}</div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", statusColor[a.status])}>{a.status}</span>
            </div>
            <div className="font-semibold text-slate-900 mt-3 text-sm">{a.name}</div>
            <div className="text-xs text-slate-500 mt-1">{a.audit_type}</div>
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {a.audit_year}</span>
              {a.site_id && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Site</span>}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 text-sm">No audits found.</div>}
      </div>

      <CreateAuditModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}