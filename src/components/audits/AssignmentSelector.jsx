import React from "react";
import AssignmentTable from "@/components/audits/AssignmentTable";
import SelectedPersonnelTable from "@/components/audits/SelectedPersonnelTable";

export default function AssignmentSelector({ form, setForm, owners, groups, orgUnits, personnel }) {
  const sectors = orgUnits.filter((unit) => unit.type === "sector" && unit.active !== false);
  const departments = orgUnits.filter((unit) => unit.type === "department" && (!form.sector_id || unit.parent_id === form.sector_id) && unit.active !== false);
  const divisions = orgUnits.filter((unit) => unit.type === "division" && (!form.department_id || unit.parent_id === form.department_id) && unit.active !== false);
  const toggleMany = (key, id) => setForm((previous) => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter((value) => value !== id) : [...previous[key], id] }));
  const chooseUnit = (key, id) => setForm((previous) => key === "sector_id" ? { ...previous, sector_id: previous.sector_id === id ? "" : id, department_id: "", division_id: "" } : key === "department_id" ? { ...previous, department_id: previous.department_id === id ? "" : id, division_id: "" } : { ...previous, division_id: previous.division_id === id ? "" : id });
  const unitRows = (units) => units.map((unit) => ({ id: unit.id, label: unit.name, detail: unit.code || unit.type }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <AssignmentTable title="People" rows={owners.filter((owner) => owner.active !== false).map((owner) => ({ id: owner.id, label: owner.full_name, detail: `${owner.job_title || "No job role"} · ${owner.work_email || "No email"}` }))} selectedIds={form.owner_ids} onToggle={(id) => toggleMany("owner_ids", id)} />
        <AssignmentTable title="Groups" rows={groups.filter((group) => group.active !== false).map((group) => ({ id: group.id, label: group.name, detail: `${(group.member_ids || []).length} people` }))} selectedIds={form.group_ids} onToggle={(id) => toggleMany("group_ids", id)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <AssignmentTable title="Sectors" rows={unitRows(sectors)} selectedIds={form.sector_id ? [form.sector_id] : []} onToggle={(id) => chooseUnit("sector_id", id)} />
        <AssignmentTable title="Departments" rows={unitRows(departments)} selectedIds={form.department_id ? [form.department_id] : []} onToggle={(id) => chooseUnit("department_id", id)} emptyText="Select a sector to filter departments." />
        <AssignmentTable title="Divisions" rows={unitRows(divisions)} selectedIds={form.division_id ? [form.division_id] : []} onToggle={(id) => chooseUnit("division_id", id)} emptyText="Select a department to filter divisions." />
      </div>
      <SelectedPersonnelTable personnel={personnel} />
    </div>
  );
}