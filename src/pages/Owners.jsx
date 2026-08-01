import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/compliance";
import { Search, Plus, X } from "lucide-react";
import { OwnerHierarchyTree } from "@/components/owners/OwnerHierarchyTree";

export default function Owners() {
  const [owners, setOwners] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [sites, setSites] = useState([]);
  const [systems, setSystems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const [o, ou, s, sy, g] = await Promise.all([
        base44.entities.Owner.list("-created_date", 200),
        base44.entities.OrgUnit.list("-created_date", 200),
        base44.entities.Site.list("-created_date", 200),
        base44.entities.System.list("-created_date", 200),
        base44.entities.OwnerGroup.list("-created_date", 200),
      ]);
      setOwners(o); setOrgUnits(ou); setSites(s); setSystems(sy); setGroups(g);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const unitName = (id) => orgUnits.find((u) => u.id === id)?.name || "—";
  const siteName = (id) => sites.find((s) => s.id === id)?.name || "—";
  const systemName = (id) => systems.find((s) => s.id === id)?.name || "—";

  const filtered = owners.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.full_name?.toLowerCase().includes(q) || o.work_email?.toLowerCase().includes(q) || unitName(o.sector_id).toLowerCase().includes(q) || unitName(o.department_id).toLowerCase().includes(q) || unitName(o.division_id).toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Owners</h1>
          <p className="text-sm text-slate-500 mt-1">Centralized ownership registry: Sector → Department → Division → Auditee.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg"><Plus className="w-4 h-4" /> Add Owner</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, sector, department, division…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>

      <OwnerHierarchyTree orgUnits={orgUnits} owners={filtered} search={search} />

      {showForm && <OwnerForm orgUnits={orgUnits} sites={sites} systems={systems} groups={groups} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function OwnerForm({ orgUnits, sites, systems, groups, onClose, onDone }) {
  const [form, setForm] = useState({ full_name: "", employee_number: "", job_title: "", work_email: "", phone: "", sector_id: "", department_id: "", division_id: "", manager_id: "", group_ids: [], assigned_sites: [], assigned_systems: [], is_primary_accountable: false, active: true });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const o = await base44.entities.Owner.create(form);
      await logAudit({ action: "owner_assigned", recordType: "Owner", recordId: o.id, recordName: form.full_name, newValue: form });
      onDone();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Add Owner</h2><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
        <div className="p-6 space-y-3">
          {[["full_name", "Full name"], ["employee_number", "Employee number"], ["job_title", "Job title"], ["work_email", "Work email"], ["phone", "Phone"]].map(([k, l]) => (
            <div key={k}><label className="text-xs font-medium text-slate-600">{l}</label><input value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs font-medium text-slate-600">Sector</label><select value={form.sector_id} onChange={(e) => setForm((p) => ({ ...p, sector_id: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-2 py-2 text-sm">{orgUnits.filter((u) => u.type === "sector").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-600">Department</label><select value={form.department_id} onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-2 py-2 text-sm">{orgUnits.filter((u) => u.type === "department").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-600">Division</label><select value={form.division_id} onChange={(e) => setForm((p) => ({ ...p, division_id: e.target.value }))} className="w-full mt-1 border border-slate-200 rounded-lg px-2 py-2 text-sm">{orgUnits.filter((u) => u.type === "division").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_primary_accountable} onChange={(e) => setForm((p) => ({ ...p, is_primary_accountable: e.target.checked }))} /><span className="text-sm text-slate-700">Primary accountable owner</span></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2"><button onClick={onClose} className="text-sm text-slate-600 px-4 py-2">Cancel</button><button onClick={submit} disabled={saving || !form.full_name} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save Owner"}</button></div>
      </div>
    </div>
  );
}