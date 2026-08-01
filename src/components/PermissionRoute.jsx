import React from "react";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission, normalizeRole } from "@/lib/access-control";

export default function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  if (hasPermission(user, permission)) return children;
  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-red-200 rounded-2xl p-8 text-center">
      <ShieldX className="w-10 h-10 text-red-500 mx-auto mb-3" />
      <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
      <p className="text-sm text-slate-500 mt-2">
        Your role ({normalizeRole(user?.role)}) is not authorized for this module.
      </p>
    </div>
  );
}
