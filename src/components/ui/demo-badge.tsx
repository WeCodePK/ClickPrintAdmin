import * as React from "react";

export function DemoBadge() {
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-soft text-warning cursor-help"
      title="Backend endpoint not yet available. Showing demo data."
    >
      Demo data
    </span>
  );
}
