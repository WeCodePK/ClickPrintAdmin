import * as React from "react";
import { DemoBadge } from "./demo-badge";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: "credit-wallet" | "print-request" | "accent" | "danger" | "warning";
  isDemo?: boolean;
}

export function StatCard({ label, value, icon, accentColor = "accent", isDemo }: StatCardProps) {
  return (
    <div className={`bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col gap-3 relative overflow-hidden group`}>
      <div className="flex justify-between items-start">
        <span className="text-muted text-sm font-medium">{label}</span>
        {icon && (
          <div className={`p-2 rounded-lg bg-[var(--color-${accentColor}-soft)] text-[var(--color-${accentColor})] opacity-80 group-hover:opacity-100 transition-opacity`}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {isDemo && <DemoBadge />}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-${accentColor})] opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  );
}
