import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/compliance";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/access-control";
import { Search, Plus, X, Pencil, Building2, Users, UserRound } from "lucide-react";
import { OwnerHierarchyTree } from "@/components/owners/OwnerHierarchyTree";
import { cn } from "@/lib/utils";

export default function Owners() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "owners_manage");
  const [owners, setOwners] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [sites, setSites] = useState([]);
  const [systems, setSystems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [ownerForm, setOwnerForm] = useState(null);
  const [unitForm, setUnitForm] = useState(null);
  const [groupForm, setGroupForm] = useState(null);
  const [tab, setTab] = useState("hierarchy");

  const load = async () => {
    try {
      const [o, ou, s, sy, g] = await Promise.all([
        base44.entities.Owner.list("full_name", 500),
        base44.entities.OrgUnit.list("name", 500),
        base44.entities.Site.list("name", 500),
        base44.entities.System.list("name", 500),
        base44.entities.OwnerGroup.list("name", 500),
      ]);
      setOwners(o); setOrgUnits(ou); setSites(s); setSystems(sy); setGroups(g);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const unitName = (id) => orgUnits.find((u) => u.id === id)?.name || "—";
  const filtered = owners.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const groupNames = (o.group_ids || []).map((id) => groups.find((g) => g.id === id)?.name || "").join(" ");
    return [o.full_name, o.work_email, o.employee_number, o.job_title, unitName(o.sector_id), unitName(o.department_id), unitName(o.division_id), groupNames]
      .some((value) => value?.toLowerCase().includes(q));
  });

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Owners</h1>
          <p className="text-sm text-slate-500 mt-1">Sector → Department → Division → Employee, with accountable and supporting ownership.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setUnitForm({})} className="flex items-center gap-2 border border-slate-200 text-sm px-3 py-2 rounded-lg"><Building2 className="w-4 h-4" /> Add Unit</button>
            <button onClick={() => setGroupForm({})} className="flex items-center gap-2 border border-slate-200 text-sm px-3 py-2 rounded-lg"><Users className="w-4 h-4" /> Add Group</button>
            <button onClick={() => setOwnerForm({})} className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg"><Plus className="w-4 h-4" /> Add Employee</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[{ key: 'hierarchy', label: 'Hierarchy', Icon: Building2 }, { key: 'employees', label: 'Employees', Icon: UserRound }, { key: 'groups', label: 'Groups', Icon: Users }].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2", tab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500")}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, employee number, role, sector, department, division, or group…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>

      {tab === "hierarchy" && <OwnerHierarchyTree orgUnits={orgUnits} owners={filtered} search={search} onEdit={canManage ? setOwnerForm : undefined} />}
      {tab === "employees" && <EmployeeTable owners={filtered} orgUnits={orgUnits} onEdit={canManage ? setOwnerForm : undefined} />}
      {tab === "groups" && <GroupTable groups={groups} owners={owners} onEdit={canManage ? setGroupForm : undefined} />}

      {ownerForm && <OwnerForm value={ownerForm.id ? ownerForm : null} owners={owners} orgUnits={orgUnits} sites={sites} systems={systems} groups={groups} onClose={() => setOwnerForm(null)} onDone={() => { setOwnerForm(null); load(); }} />}
      {unitForm && <OrgUnitForm value={unitForm.id ? unitForm : null} owners={owners} orgUnits={orgUnits} onClose={() => setUnitForm(null)} onDone={() => { setUnitForm(null); load(); }} />}
      {groupForm && <GroupForm value={groupForm.id ? groupForm : null} owners={owners} onClose={() => setGroupForm(null)} onDone={() => { setGroupForm(null); load(); }} />}
    </div>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }

function EmployeeTable({ owners, orgUnits, onEdit }) {
  const unit = (id) => orgUnits.find((u) => u.id === id)?.name || "—";
  return <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{["Employee","Job title","Sector","Department","Division","Status",""] .map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-slate-600">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{owners.map((o) => <tr key={o.id}><td className="px-3 py-2"><div className="font-medium">{o.full_name}</div><div className="text-xs text-slate-400">{o.work_email} · {o.employee_number}</div></td><td className="px-3 py-2">{o.job_title || "—"}</td><td className="px-3 py-2">{unit(o.sector_id)}</td><td className="px-3 py-2">{unit(o.department_id)}</td><td className="px-3 py-2">{unit(o.division_id)}</td><td className="px-3 py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full", o.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{o.active ? "Active" : "Inactive"}</span></td><td className="px-3 py-2">{onEdit && <button onClick={() => onEdit(o)} className="p-1.5 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>}</td></tr>)}</tbody></table></div>;
}

function GroupTable({ groups, owners, onEdit }) {
  const name = (id) => owners.find((o) => o.id === id)?.full_name || "Unknown";
  return <div className="grid md:grid-cols-2 gap-3">{groups.map((g) => <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-4"><div className="flex justify-between"><div><div className="font-semibold text-slate-900">{g.name}</div><div className="text-xs text-slate-500">{g.description || "No description"}</div></div>{onEdit && <button onClick={() => onEdit(g)}><Pencil className="w-4 h-4 text-slate-400" /></button>}</div><div className="mt-3 flex flex-wrap gap-1">{(g.member_ids || []).map((id) => <span key={id} className="text-xs bg-slate-100 px-2 py-1 rounded">{name(id)}</span>)}</div></div>)}</div>;
}

function OwnerForm({ value, owners, orgUnits, sites, systems, groups, onClose, onDone }) {
  const initial = value || {};
  const [form, setForm] = useState({ full_name: "", employee_number: "", job_title: "", work_email: "", phone: "", sector_id: "", department_id: "", division_id: "", manager_id: "", group_ids: [], assigned_sites: [], assigned_systems: [], is_primary_accountable: false, active: true, ...initial });
  const [saving, setSaving] = useState(false);
  const departments = orgUnits.filter((u) => u.type === "department" && (!form.sector_id || u.parent_id === form.sector_id));
  const divisions = orgUnits.filter((u) => u.type === "division" && (!form.department_id || u.parent_id === form.department_id));
  const setList = (key, event) => setForm((p) => ({ ...p, [key]: Array.from(event.target.selectedOptions).map((o) => o.value) }));
  const submit = async () => {
    if (!form.full_name || !form.sector_id || !form.department_id || !form.division_id) return alert("Full name and a valid Sector → Department → Division path are required.");
    if (!departments.some((d) => d.id === form.department_id) || !divisions.some((d) => d.id === form.division_id)) return alert("The selected organizational path is invalid.");
    setSaving(true);
    try {
      let record;
      if (value?.id) {
        record = await base44.entities.Owner.update(value.id, form);
        await logAudit({ action: "owner_updated", recordType: "Owner", recordId: value.id, recordName: form.full_name, previousValue: value, newValue: form });
      } else {
        record = await base44.entities.Owner.create(form);
        await logAudit({ action: "owner_created", recordType: "Owner", recordId: record.id, recordName: form.full_name, newValue: form });
      }
      onDone();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return <Modal title={value ? "Edit Employee" : "Add Employee"} onClose={onClose}><div className="space-y-3">
    {[["full_name","Full name"],["employee_number","Employee number"],["job_title","Job title"],["work_email","Work email"],["phone","Phone / contact"]].map(([k,l]) => <Field key={k} label={l}><input value={form[k] || ""} onChange={(e) => setForm((p) => ({...p,[k]:e.target.value}))} className="input" /></Field>)}
    <div className="grid md:grid-cols-3 gap-2"><Field label="Sector"><select value={form.sector_id} onChange={(e) => setForm((p) => ({...p,sector_id:e.target.value,department_id:"",division_id:""}))} className="input"><option value="">Select…</option>{orgUnits.filter((u) => u.type === "sector" && u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Department"><select value={form.department_id} onChange={(e) => setForm((p) => ({...p,department_id:e.target.value,division_id:""}))} className="input"><option value="">Select…</option>{departments.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Division"><select value={form.division_id} onChange={(e) => setForm((p) => ({...p,division_id:e.target.value}))} className="input"><option value="">Select…</option>{divisions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div>
    <Field label="Manager"><select value={form.manager_id || ""} onChange={(e) => setForm((p) => ({...p,manager_id:e.target.value}))} className="input"><option value="">None</option>{owners.filter((o) => o.id !== value?.id && o.active).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</select></Field>
    <div className="grid md:grid-cols-3 gap-2"><Field label="Groups"><select multiple value={form.group_ids || []} onChange={(e) => setList("group_ids", e)} className="input h-24">{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field><Field label="Sites"><select multiple value={form.assigned_sites || []} onChange={(e) => setList("assigned_sites", e)} className="input h-24">{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Systems"><select multiple value={form.assigned_systems || []} onChange={(e) => setList("assigned_systems", e)} className="input h-24">{systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
    <div className="flex gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_primary_accountable} onChange={(e) => setForm((p) => ({...p,is_primary_accountable:e.target.checked}))} />Primary accountable</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm((p) => ({...p,active:e.target.checked}))} />Active</label></div>
    <button onClick={submit} disabled={saving} className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm disabled:opacity-50">{saving ? "Saving…" : "Save Employee"}</button>
  </div></Modal>;
}

function OrgUnitForm({ value, owners, orgUnits, onClose, onDone }) {
  const [form, setForm] = useState({ type: "sector", name: "", code: "", parent_id: "", manager_id: "", active: true, ...(value || {}) });
  const parents = form.type === "department" ? orgUnits.filter((u) => u.type === "sector") : form.type === "division" ? orgUnits.filter((u) => u.type === "department") : [];
  const save = async () => {
    if (!form.name || (form.type !== "sector" && !form.parent_id)) return alert("Name and parent organizational unit are required.");
    const record = value?.id ? await base44.entities.OrgUnit.update(value.id, form) : await base44.entities.OrgUnit.create(form);
    await logAudit({ action: value?.id ? "org_unit_updated" : "org_unit_created", recordType: "OrgUnit", recordId: record.id, recordName: form.name, previousValue: value, newValue: form }); onDone();
  };
  return <Modal title={value ? "Edit Organizational Unit" : "Add Organizational Unit"} onClose={onClose}><div className="space-y-3"><Field label="Type"><select value={form.type} onChange={(e) => setForm((p) => ({...p,type:e.target.value,parent_id:""}))} className="input"><option value="sector">Sector</option><option value="department">Department</option><option value="division">Division</option></select></Field><Field label="Name"><input value={form.name} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))} className="input" /></Field><Field label="Code"><input value={form.code || ""} onChange={(e) => setForm((p) => ({...p,code:e.target.value}))} className="input" /></Field>{form.type !== "sector" && <Field label="Parent"><select value={form.parent_id} onChange={(e) => setForm((p) => ({...p,parent_id:e.target.value}))} className="input"><option value="">Select…</option>{parents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}<Field label="Manager"><select value={form.manager_id || ""} onChange={(e) => setForm((p) => ({...p,manager_id:e.target.value}))} className="input"><option value="">None</option>{owners.filter((o) => o.active).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</select></Field><label className="flex gap-2 text-sm"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm((p) => ({...p,active:e.target.checked}))} />Active</label><button onClick={save} className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm">Save Unit</button></div></Modal>;
}

function GroupForm({ value, owners, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", description: "", member_ids: [], active: true, ...(value || {}) });
  const save = async () => { if (!form.name) return; const record = value?.id ? await base44.entities.OwnerGroup.update(value.id, form) : await base44.entities.OwnerGroup.create(form); await logAudit({ action: value?.id ? "owner_group_updated" : "owner_group_created", recordType: "OwnerGroup", recordId: record.id, recordName: form.name, previousValue: value, newValue: form }); onDone(); };
  return <Modal title={value ? "Edit Group" : "Add Group"} onClose={onClose}><div className="space-y-3"><Field label="Name"><input value={form.name} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))} className="input" /></Field><Field label="Description"><textarea value={form.description || ""} onChange={(e) => setForm((p) => ({...p,description:e.target.value}))} className="input h-20" /></Field><Field label="Members"><select multiple value={form.member_ids || []} onChange={(e) => setForm((p) => ({...p,member_ids:Array.from(e.target.selectedOptions).map((o) => o.value)}))} className="input h-40">{owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</select></Field><button onClick={save} className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm">Save Group</button></div></Modal>;
}

function Modal({ title, onClose, children }) { return <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"><div className="flex justify-between px-6 py-4 border-b"><h2 className="font-semibold">{title}</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-6">{children}</div></div></div>; }
function Field({ label, children }) { return <div><label className="text-xs font-medium text-slate-600">{label}</label>{React.cloneElement(children, { className: `${children.props.className || ""} w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm` })}</div>; }
