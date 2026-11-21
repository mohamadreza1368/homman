import React from "react";

export interface CollapsibleHeaderProps {
  label: string;
  count?: number;
  action?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}

export function CollapsibleHeader({
  label,
  count,
  action,
  open,
  onToggle,
}: CollapsibleHeaderProps) {
  const headerContent = (
    <>
      {label}
      {count !== undefined && <span className="ml-2 text-slate-600">{count}</span>}
    </>
  );

  return (
    <div className="flex items-center gap-2 border-b border-slate-800/70 pb-1">
      <h2 className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            title={open ? `Fold ${label.toLowerCase()} away` : `Show ${label.toLowerCase()}`}
            className="flex items-center gap-1.5 transition hover:text-slate-300"
          >
            <span aria-hidden className="text-slate-600">
              {open ? "▾" : "▸"}
            </span>
            {headerContent}
          </button>
        ) : (
          headerContent
        )}
      </h2>
      <div className="ml-auto">{action}</div>
    </div>
  );
}
