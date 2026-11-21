import { BrandLogo } from "@/components/BrandLogo";
import type { PrintDocument } from "./printDocument";

export function formatDayOnly(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatFullTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentHeader({ doc }: { doc: PrintDocument }) {
  return (
    <header className="border-b border-slate-300 pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <BrandLogo variant="full-light" className="mb-2 h-11 w-auto" />
        HOOMAAN · Study journal
      </p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight">{doc.heading}</h1>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-600">
        {doc.facts.map((meta) => (
          <div key={meta.label} className="flex gap-1.5">
            <dt className="text-slate-500">{meta.label}:</dt>
            <dd className="font-medium text-slate-800">{meta.value}</dd>
          </div>
        ))}
        {doc.createdAt !== null && (
          <div className="flex gap-1.5">
            <dt className="text-slate-500">Started:</dt>
            <dd className="font-medium text-slate-800">{formatDayOnly(doc.createdAt)}</dd>
          </div>
        )}
        {doc.updatedAt !== null && (
          <div className="flex gap-1.5">
            <dt className="text-slate-500">Last worked on:</dt>
            <dd className="font-medium text-slate-800">{formatDayOnly(doc.updatedAt)}</dd>
          </div>
        )}
      </dl>
    </header>
  );
}
