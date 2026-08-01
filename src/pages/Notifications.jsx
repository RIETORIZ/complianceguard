import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCheck, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_COLOR = {
  new_evidence_request: "bg-blue-100 text-blue-700",
  upcoming_deadline: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  submission: "bg-emerald-100 text-emerald-700",
  rejection: "bg-red-100 text-red-700",
  revision_request: "bg-amber-100 text-amber-700",
  approval: "bg-emerald-100 text-emerald-700",
  evidence_expiration: "bg-orange-100 text-orange-700",
  finding: "bg-red-100 text-red-700",
  overdue_corrective_action: "bg-red-100 text-red-700",
  escalation: "bg-purple-100 text-purple-700",
  audit_assigned: "bg-blue-100 text-blue-700",
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      const n = await base44.entities.Notification.list("-sent_at", 200);
      setNotifications(n);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const unsub = base44.entities.Notification.subscribe(() => load()); return unsub; }, []);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) await base44.entities.Notification.update(n.id, { is_read: true, read_at: new Date().toISOString() });
    load();
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Center</h1>
          <p className="text-sm text-slate-500 mt-1">In-app notifications. Email uses a development adapter (logged) until real credentials are configured.</p>
        </div>
        <button onClick={markAllRead} className="flex items-center gap-2 text-sm border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"><CheckCheck className="w-4 h-4" /> Mark all read</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setFilter("all")} className={cn("text-sm px-3 py-1.5 rounded-lg", filter === "all" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600")}>All</button>
        <button onClick={() => setFilter("unread")} className={cn("text-sm px-3 py-1.5 rounded-lg", filter === "unread" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600")}>Unread ({notifications.filter((n) => !n.is_read).length})</button>
      </div>
      <div className="space-y-2">
        {filtered.map((n) => (
          <div key={n.id} className={cn("bg-white rounded-xl border p-4 flex items-start gap-3", n.is_read ? "border-slate-200" : "border-blue-200 bg-blue-50/30")}>
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", TYPE_COLOR[n.type] || "bg-slate-100 text-slate-600")}>
              {n.delivery_mode === "end_of_day" ? <Clock className="w-4 h-4" /> : n.channel === "email" ? <Mail className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">{n.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-400">{n.delivery_mode === "end_of_day" ? "End-of-day" : "Immediate"} · {n.delivery_status}</span>
                <span className="text-[10px] text-slate-400">{new Date(n.sent_at).toLocaleString()}</span>
              </div>
            </div>
            {n.link && <a href={n.link} className="text-xs text-blue-600 underline">Open</a>}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No notifications.</div>}
      </div>
    </div>
  );
}