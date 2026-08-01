import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@/lib/router";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, FolderTree, Users, Flag, ClipboardList, Bell, FileText, Settings, ShieldCheck, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, normalizeRole } from "@/lib/access-control";

const NAV = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, permission: "dashboard_view" },
  { label: "Audits", path: "/audits", icon: ShieldCheck, permission: "audits_view" },
  { label: "Frameworks", path: "/frameworks", icon: FolderTree, permission: "frameworks_view" },
  { label: "Findings", path: "/findings", icon: Flag, permission: "audits_view" },
  { label: "Correction Plans", path: "/correction-plans", icon: ClipboardList, permission: "audits_view" },
  { label: "Owners", path: "/owners", icon: Users, permission: "owners_view" },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Reports", path: "/reports", icon: FileText, permission: "reports_view" },
  { label: "Administration", path: "/admin", icon: Settings, permission: "admin_view" },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.Notification.filter({ is_read: false }, "-created_date", 100)
      .then((n) => setUnreadCount(n.length))
      .catch(() => {});
    const unsub = base44.entities.Notification.subscribe(() => {
      base44.entities.Notification.filter({ is_read: false }, "-created_date", 100)
        .then((n) => setUnreadCount(n.length))
        .catch(() => {});
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">Compliance</div>
            <div className="text-[10px] text-slate-500 leading-tight">Management Tool</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.filter((item) => !item.permission || hasPermission(user, item.permission)).map((item) => {
            const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-semibold">
              {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">{user?.full_name || user?.email || "User"}</div>
              <div className="text-[10px] text-slate-500 truncate">{normalizeRole(user?.role)}</div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-700" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-600" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="text-base font-semibold text-slate-900">
              {NAV.filter((n) => !n.permission || hasPermission(user, n.permission)).find((n) => n.path === "/" ? location.pathname === "/" : location.pathname.startsWith(n.path))?.label || "Compliance"}
            </div>
          </div>
          <Link to="/notifications" className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>
            )}
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}