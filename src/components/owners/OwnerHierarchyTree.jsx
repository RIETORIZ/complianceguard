import React, { useState } from "react";
import { ChevronDown, ChevronRight, Building2, Users, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hierarchical org tree: Sector → Department (manager) → Division (manager) → Employee (job role).
 * `expanded` is a Set of unit ids controlling open/closed branches.
 */
export function OwnerHierarchyTree({ orgUnits, owners, search }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const ownerName = (id) => (id ? owners.find((o) => o.id === id)?.full_name : null);
  const q = search.trim().toLowerCase();
  const match = (t) => (q ? (t || "").toLowerCase().includes(q) : false);

  // does an owner match the search?
  const ownerMatches = (o) =>
    !q ||
    o.full_name?.toLowerCase().includes(q) ||
    o.work_email?.toLowerCase().includes(q) ||
    o.job_title?.toLowerCase().includes(q);

  // does a subtree (unit + descendants + owners) contain any search match?
  const subtreeHasMatch = (unitId) => {
    const childUnits = orgUnits.filter((u) => u.parent_id === unitId);
    const unitOwners = owners.filter((o) => belongsTo(o, unitId));
    if (orgUnits.find((u) => u.id === unitId)?.name?.toLowerCase().includes(q)) return true;
    if (unitOwners.some(ownerMatches)) return true;
    return childUnits.some((c) => subtreeHasMatch(c.id));
  };

  // owner belongs to a unit (most specific assignment)
  const belongsTo = (o, unitId) => {
    const unit = orgUnits.find((u) => u.id === unitId);
    if (!unit) return false;
    if (unit.type === "division") return o.division_id === unitId;
    if (unit.type === "department") return o.department_id === unitId && !o.division_id;
    if (unit.type === "sector") return o.sector_id === unitId && !o.department_id && !o.division_id;
    return false;
  };

  const sectors = orgUnits.filter((u) => u.type === "sector");
  const visibleSectors = sectors.filter((s) => !q || subtreeHasMatch(s.id));

  if (visibleSectors.length === 0)
    return <div className="text-center py-12 text-slate-400 text-sm">No matching owners or units.</div>;

  const renderUnit = (unit, level) => {
    const children = orgUnits.filter((u) => u.parent_id === unit.id);
    const unitOwners = owners.filter((o) => belongsTo(o, unit.id));
    const managerName = ownerName(unit.manager_id);
    if (q && !subtreeHasMatch(unit.id)) return null;
    const isOpen = expanded.has(unit.id);
    const hasChildren = children.length > 0 || unitOwners.length > 0;
    const indent = level * 20;

    return (
      <div key={unit.id} style={{ marginLeft: indent }}>
        <button
          onClick={() => hasChildren && toggle(unit.id)}
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-lg w-full text-left",
            "hover:bg-slate-50",
            level === 0 && "bg-slate-100/60"
          )}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          {level === 0 ? (
            <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          ) : level === 1 ? (
            <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className={cn("text-sm", level === 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
            {unit.name}
          </span>
          {managerName && level > 0 && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              · Manager: <span className="text-slate-600 font-medium">{managerName}</span>
            </span>
          )}
          {(children.length > 0 || unitOwners.length > 0) && (
            <span className="text-[10px] text-slate-400 ml-auto">{children.length + unitOwners.length}</span>
          )}
        </button>

        {isOpen && hasChildren && (
          <div className="border-l border-slate-200 ml-3 pl-2">
            {children.map((c) => renderUnit(c, level + 1))}
            {unitOwners.map((o) => renderEmployee(o, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderEmployee = (o, level) => {
    if (q && !ownerMatches(o)) return null;
    return (
      <div key={o.id} style={{ marginLeft: 0 }} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50">
        <span className="w-3.5" />
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs flex-shrink-0">
          {o.full_name?.[0]}
        </div>
        <span className="text-sm text-slate-800 font-medium">{o.full_name}</span>
        {!o.active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">INACTIVE</span>}
        {o.job_title ? (
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> {o.job_title}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">No job role</span>
        )}
        {o.is_primary_accountable && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Primary</span>
        )}
        {o.work_email && <span className="text-[11px] text-slate-400 ml-auto truncate">{o.work_email}</span>}
      </div>
    );
  };

  return <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-0.5">{visibleSectors.map((s) => renderUnit(s, 0))}</div>;
}