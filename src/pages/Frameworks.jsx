import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/compliance";
import { FolderTree, ChevronRight, ChevronDown, Plus, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NCA_FRAMEWORKS = [
  { code: "ECC", name: "Essential Cybersecurity Controls", description: "Essential baseline cybersecurity controls" },
  { code: "DCC", name: "Digital Cybersecurity Controls", description: "Digital cybersecurity controls framework" },
  { code: "CSCC", name: "Critical Systems Cybersecurity Controls", description: "Controls for critical systems" },
  { code: "CCC", name: "Cloud Cybersecurity Controls", description: "Cloud cybersecurity controls" },
  { code: "TCC", name: "Telecom Cybersecurity Controls", description: "Telecommunications cybersecurity controls" },
  { code: "OTCC", name: "Operational Technology Cybersecurity Controls", description: "OT cybersecurity controls (site-based)" },
  { code: "OSMACC", name: "Open Source Management & Audit Cybersecurity Controls", description: "Open source management controls" },
];

export default function Frameworks() {
  const [frameworks, setFrameworks] = useState([]);
  const [domains, setDomains] = useState([]);
  const [controls, setControls] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddControl, setShowAddControl] = useState(null);

  const load = async () => {
    try {
      const [f, d, c, e, con] = await Promise.all([
        base44.entities.Framework.list("-created_date", 200),
        base44.entities.Domain.list("-created_date", 500),
        base44.entities.Control.list("-created_date", 500),
        base44.entities.ExpectedEvidence.list("-created_date", 500),
        base44.entities.EvidenceCondition.list("-created_date", 500),
      ]);
      setFrameworks(f); setDomains(d); setControls(c); setEvidence(e); setConditions(con);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const controlsByDomain = (fwId, domId) => controls.filter((c) => c.framework_id === fwId && c.domain_id === domId && !c.parent_id);
  const subControls = (cid) => controls.filter((c) => c.parent_id === cid);
  const evidenceFor = (cid) => evidence.filter((e) => e.control_id === cid);
  const conditionsFor = (eeId) => conditions.filter((c) => c.expected_evidence_id === eeId);

  const addCustomControl = async (fwId, domId, title, text) => {
    if (!title) return;
    const ctrl = await base44.entities.Control.create({
      framework_id: fwId, domain_id: domId, title, official_text: text, control_type: "custom", is_custom: true, priority: "medium", active: true,
    });
    await logAudit({ action: "control_added", recordType: "Control", recordId: ctrl.id, recordName: title, newValue: ctrl });
    setShowAddControl(null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Framework Library</h1>
        <p className="text-sm text-slate-500 mt-1">Hierarchical regulatory structure: Framework → Domain → Control → Sub-control → Expected Evidence → Evidence Conditions. Official regulatory wording is protected.</p>
      </div>

      {frameworks.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No frameworks seeded yet. Run the seed data from the Administration page.</p>
        </div>
      )}

      <div className="space-y-3">
        {frameworks.map((fw) => {
          const fwDomains = domains.filter((d) => d.framework_id === fw.id && !d.parent_id);
          return (
            <div key={fw.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => toggle(fw.id)} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50">
                {expanded[fw.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{fw.code}</div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-slate-900 text-sm">{fw.name}</div>
                  <div className="text-xs text-slate-500">{fw.description}</div>
                </div>
                <span className="text-xs text-slate-400">{fwDomains.length} domains</span>
              </button>
              {expanded[fw.id] && (
                <div className="pl-8 border-t border-slate-100">
                  {fwDomains.map((dom) => (
                    <DomainRow key={dom.id} domain={dom} frameworkId={fw.id}
                      controls={controlsByDomain(fw.id, dom.id)} subControls={subControls}
                      evidenceFor={evidenceFor} conditionsFor={conditionsFor}
                      expanded={expanded} toggle={toggle}
                      onAddControl={(title, text) => addCustomControl(fw.id, dom.id, title, text)} showAddControl={showAddControl === dom.id} setShowAddControl={setShowAddControl} />
                  ))}
                  {fwDomains.length === 0 && <div className="p-4 text-sm text-slate-400">No domains defined.</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DomainRow({ domain, frameworkId, controls, subControls, evidenceFor, conditionsFor, expanded, toggle, onAddControl, showAddControl, setShowAddControl }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <div className="border-l-2 border-slate-100 ml-2">
      <button onClick={() => toggle(domain.id)} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
        {expanded[domain.id] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <span className="font-medium text-sm text-slate-800">{domain.code || ""} {domain.name}</span>
        <span className="text-xs text-slate-400">({controls.length})</span>
      </button>
      {expanded[domain.id] && (
        <div className="pl-6 pb-2">
          {controls.map((ctrl) => (
            <ControlRow key={ctrl.id} control={ctrl} subControls={subControls} evidenceFor={evidenceFor} conditionsFor={conditionsFor} expanded={expanded} toggle={toggle} />
          ))}
          {showAddControl ? (
            <div className="bg-slate-50 rounded-lg p-3 mt-2 space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom control title" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5" />
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Control requirement text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 h-16" />
              <div className="flex gap-2">
                <button onClick={() => { onAddControl(title, text); setTitle(""); setText(""); }} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg">Add control</button>
                <button onClick={() => setShowAddControl(null)} className="text-xs text-slate-500 px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddControl(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mt-1 px-2 py-1">
              <Plus className="w-3.5 h-3.5" /> Add custom control
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ControlRow({ control, subControls, evidenceFor, conditionsFor, expanded, toggle }) {
  const subs = subControls(control.id);
  const evs = evidenceFor(control.id);
  return (
    <div className="border-l-2 border-slate-100 ml-2">
      <button onClick={() => toggle(control.id)} className="w-full flex items-start gap-2 px-4 py-2 hover:bg-slate-50 text-left">
        {expanded[control.id] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 mt-0.5" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-800 flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{control.control_number}</span>
            {control.title}
            {control.is_custom && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">CUSTOM</span>}
          </div>
        </div>
      </button>
      {expanded[control.id] && (
        <div className="pl-6 pb-2 space-y-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1 font-semibold">Official Regulatory Text (Protected)</div>
            {control.official_text || "—"}
          </div>
          {control.internal_notes && <div className="text-xs text-slate-500 px-3"><span className="font-semibold">Notes:</span> {control.internal_notes}</div>}
          {subs.map((sc) => (
            <div key={sc.id} className="pl-4 border-l-2 border-slate-100">
              <div className="text-sm text-slate-700"><span className="font-mono text-xs text-slate-500">{sc.control_number}</span> {sc.title}</div>
            </div>
          ))}
          {evs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-3">Expected Evidence</div>
              {evs.map((e) => (
                <div key={e.id} className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
                  <div className="text-sm font-medium text-slate-800 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-blue-500" />{e.name}</div>
                  {e.description && <div className="text-xs text-slate-500 mt-0.5">{e.description}</div>}
                  {conditionsFor(e.id).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">Acceptance Conditions</div>
                      {conditionsFor(e.id).map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <ShieldCheck className={cn("w-3 h-3", c.is_mandatory ? "text-red-500" : "text-slate-400")} />
                          {c.name}
                          {!c.is_mandatory && <span className="text-[10px] text-slate-400">(optional)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}