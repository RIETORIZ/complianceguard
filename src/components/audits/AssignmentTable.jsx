import React from "react";
import { Check } from "lucide-react";

export default function AssignmentTable({ title, rows, selectedIds, onToggle, emptyText = "No options available." }) {
  return (
    <div data-assignment-table={title.toLowerCase()} className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{title}</div>
      <div className="max-h-48 overflow-y-auto">
        {rows.map((row) => {
          const selected = selectedIds.includes(row.id);
          return (
            <button type="button" key={row.id} aria-pressed={selected} onClick={() => onToggle(row.id)} className={`flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2 text-left text-xs ${selected ? "bg-emerald-50" : "bg-white hover:bg-slate-50"}`}>
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                {selected && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1"><span className="block font-medium text-slate-800">{row.label}</span>{row.detail && <span className="block truncate text-slate-400">{row.detail}</span>}</span>
            </button>
          );
        })}
        {!rows.length && <div className="px-3 py-4 text-xs text-slate-400">{emptyText}</div>}
      </div>
    </div>
  );
}