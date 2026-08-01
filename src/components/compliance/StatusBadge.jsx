import { cn } from "@/lib/utils";

export function StatusBadge({ status, config, className }) {
  const cfg = config && config[status] ? config[status] : { color: "bg-slate-100 text-slate-700", label: status };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap", cfg.color, className)}>
      {cfg.label}
    </span>
  );
}