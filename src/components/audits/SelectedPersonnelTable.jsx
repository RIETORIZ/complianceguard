import React from "react";

export default function SelectedPersonnelTable({ personnel }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
        <span>Selected personnel</span><span>{personnel.length}</span>
      </div>
      <div className="max-h-56 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Person</th><th className="px-3 py-2 text-left">Job role</th><th className="px-3 py-2 text-left">Selected through</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {personnel.map((person) => <tr key={person.id}><td className="px-3 py-2"><div className="font-medium text-slate-800">{person.full_name}</div><div className="text-slate-400">{person.work_email || "—"}</div></td><td className="px-3 py-2 text-slate-600">{person.job_title || "—"}</td><td className="px-3 py-2 text-slate-600">{person.sources.join(", ")}</td></tr>)}
          </tbody>
        </table>
        {!personnel.length && <div className="px-3 py-5 text-center text-xs text-slate-400">Select a person, group, sector, department, or division.</div>}
      </div>
    </div>
  );
}