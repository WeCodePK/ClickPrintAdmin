import * as React from "react";
import { DemoBadge } from "./demo-badge";

type AccentColor =
  | "credit-wallet"
  | "print-request"
  | "accent"
  | "danger"
  | "warning"
  | "neutral";

// Written out in full because Tailwind can only extract literal class names.
const ACCENTS: Record<AccentColor, { icon: string; value: string; bar: string }> = {
  accent: { icon: "bg-accent-soft text-accent", value: "text-accent", bar: "bg-accent" },
  danger: { icon: "bg-danger-soft text-danger", value: "text-danger", bar: "bg-danger" },
  warning: { icon: "bg-warning-soft text-warning", value: "text-warning", bar: "bg-warning" },
  neutral: { icon: "bg-surface-muted text-muted", value: "text-muted", bar: "bg-muted" },
  "credit-wallet": {
    icon: "bg-[var(--color-credit-wallet)]/10 text-[var(--color-credit-wallet)]",
    value: "text-[var(--color-credit-wallet)]",
    bar: "bg-[var(--color-credit-wallet)]",
  },
  "print-request": {
    icon: "bg-[var(--color-print-request)]/10 text-[var(--color-print-request)]",
    value: "text-[var(--color-print-request)]",
    bar: "bg-[var(--color-print-request)]",
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: AccentColor;
  /** Tints the number with the accent colour instead of the default foreground. */
  colorValue?: boolean;
  isDemo?: boolean;
}

export function StatCard({ label, value, icon, accentColor = "accent", colorValue, isDemo }: StatCardProps) {
  const accent = ACCENTS[accentColor];

  return (
    <div className={`bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col gap-3 relative overflow-hidden group`}>
      <div className="flex justify-between items-start">
        <span className="text-muted text-sm font-medium">{label}</span>
        {icon && (
          <div className={`p-2 rounded-lg ${accent.icon} opacity-80 group-hover:opacity-100 transition-opacity`}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold ${colorValue ? accent.value : "text-foreground"}`}>{value}</span>
        {isDemo && <DemoBadge />}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${accent.bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  );
}
