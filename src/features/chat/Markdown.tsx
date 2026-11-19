import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { RhythmId } from "@/features/viewer/rhythms";
import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useScanStore } from "@/stores/scanStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";

import {
  collectOrganRefs,
  linkifyOrganRefs,
  REF_SCHEME,
  RHYTHM_SCHEME,
  SLICE_SCHEME,
} from "./organRefs";
import { repairGluedHeadings } from "./repairMarkdown";
import { useCopy } from "./useCopy";

function CodeSnippetContainer({ children }: { children: ReactNode }) {
  const codeString = String(children).replace(/\n$/, "");
  const { copied, copy } = useCopy();

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
        <code>{codeString}</code>
      </pre>
      <button
        type="button"
        onClick={() => void copy(codeString)}
        className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-200"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

function InteractiveOrganPin({ organId, label }: { organId: string; label: string }) {
  const organ = useSceneStore((state) => state?.organs?.[organId]);
  const highlightOrgan = useSceneStore((state) => state?.setHovered);
  const zoomToRef = useSceneStore((state) => state?.focusReference);

  if (!organ) return null;

  const organTitle = organLabel(organ);

  return (
    <button
      type="button"
      onMouseEnter={() => highlightOrgan?.(organId)}
      onMouseLeave={() => highlightOrgan?.(null)}
      onFocus={() => highlightOrgan?.(organId)}
      onBlur={() => highlightOrgan?.(null)}
      onClick={() => zoomToRef?.(organId, Number(label))}
      title={`Show ${organTitle}`}
      aria-label={`Show ${organTitle}`}
      className="mx-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-sky-500/25 px-1 align-super text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/40 transition hover:bg-sky-400/50 hover:text-white hover:ring-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      {label}
    </button>
  );
}

function InteractiveRhythmPin({ rhythmId, label }: { rhythmId: string; label: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const activateRhythm = () => {
    useHeartStore.setState({ enabled: true });
    useHeartStore.getState().setRhythm?.(rhythmId as RhythmId);
    useHeartStore.getState().setSound?.(true);
    useSceneStore.getState().focusReference?.("cor_ventriculus_sinister", 1);
  };

  return (
    <button
      type="button"
      onClick={activateRhythm}
      title={isPersian ? `پخش ریتم قلبی ${label} در مدل سه‌بعدی` : `Play heart rhythm ${label} in 3D scene`}
      className="mx-1 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 text-[11px] font-medium text-rose-300 shadow-sm transition hover:border-rose-400 hover:bg-rose-900/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
    >
      <span className="inline-block animate-pulse text-rose-400">♥</span>
      <span>{label}</span>
    </button>
  );
}

function InteractiveSlicePin({ target, label }: { target: string; label: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const activateSlice = () => {
    useScanStore.setState({ enabled: true, axial: true });
    useSceneStore.getState().applyCommand?.({ action: "scan_at_structure", organ_id: target });
  };

  return (
    <button
      type="button"
      onClick={activateSlice}
      title={isPersian ? `حرکت مقطع اسکنر به تراز ${label}` : `Navigate CT slice to ${label}`}
      className="mx-1 inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-medium text-cyan-300 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-900/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
    >
      <span className="inline-block text-cyan-400">⌖</span>
      <span>{label}</span>
    </button>
  );
}

interface MarkdownProps {
  children: string;
  structurePins?: boolean;
}

/**
 * Rich formatted markdown renderer designed for assistant messages and medical records.
 * Integrates interactive pins linked to 3D organs, electrocardiogram rhythms, and CT slices.
 */
export const Markdown = memo(function Markdown({
  children,
  structurePins = true,
}: MarkdownProps) {
  const organCatalog = useSceneStore((state) => state?.organs);

  const formattedContent = useMemo(() => {
    const repaired = repairGluedHeadings(children);
    if (!structurePins) return repaired;
    const detectedRefs = collectOrganRefs(repaired, (id) => id in organCatalog);
    return linkifyOrganRefs(repaired, detectedRefs);
  }, [children, organCatalog, structurePins]);

  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          structurePins &&
          (url.startsWith(REF_SCHEME) ||
            url.startsWith("anatria-ref:") ||
            url.startsWith(RHYTHM_SCHEME) ||
            url.startsWith(SLICE_SCHEME))
            ? url
            : defaultUrlTransform(url)
        }
        components={{
          img: structurePins ? "img" : ({ alt }) => <span>{alt}</span>,
          h1: ({ children: headerText }) => (
            <h3 className="mt-3 text-sm font-semibold text-slate-100">{headerText}</h3>
          ),
          h2: ({ children: headerText }) => (
            <h4 className="mt-3 text-[13px] font-semibold text-slate-100">{headerText}</h4>
          ),
          h3: ({ children: headerText }) => (
            <h5 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {headerText}
            </h5>
          ),
          p: ({ children: paragraphContent }) => <p>{paragraphContent}</p>,
          ul: ({ children: listItems }) => (
            <ul className="list-disc space-y-1 pl-4 marker:text-slate-600">{listItems}</ul>
          ),
          ol: ({ children: listItems }) => (
            <ol className="list-decimal space-y-1 pl-4 marker:text-slate-600">{listItems}</ol>
          ),
          strong: ({ children: boldContent }) => (
            <strong className="font-semibold text-slate-50">{boldContent}</strong>
          ),
          em: ({ children: italicContent }) => (
            <em className="italic text-slate-300">{italicContent}</em>
          ),
          blockquote: ({ children: quoteContent }) => (
            <blockquote className="border-l-2 border-sky-700/60 pl-3 text-slate-400">
              {quoteContent}
            </blockquote>
          ),
          a: ({ children: linkContent, href }) => {
            if (
              structurePins &&
              href &&
              (href.startsWith(REF_SCHEME) || href.startsWith("anatria-ref:"))
            ) {
              const prefix = href.startsWith(REF_SCHEME) ? REF_SCHEME : "anatria-ref:";
              return (
                <InteractiveOrganPin
                  organId={href.slice(prefix.length)}
                  label={String(linkContent)}
                />
              );
            }
            if (structurePins && href && href.startsWith(RHYTHM_SCHEME)) {
              return (
                <InteractiveRhythmPin
                  rhythmId={href.slice(RHYTHM_SCHEME.length)}
                  label={String(linkContent)}
                />
              );
            }
            if (structurePins && href && href.startsWith(SLICE_SCHEME)) {
              return (
                <InteractiveSlicePin
                  target={href.slice(SLICE_SCHEME.length)}
                  label={String(linkContent)}
                />
              );
            }
            return (
              <span className="text-sky-400 underline decoration-dotted" title={href}>
                {linkContent}
              </span>
            );
          },
          code: ({ children: codeContent, className }) =>
            className?.includes("language-") ? (
              <CodeSnippetContainer>{codeContent}</CodeSnippetContainer>
            ) : (
              <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-sky-200">
                {codeContent}
              </code>
            ),
          pre: ({ children: preContent }) => <>{preContent}</>,
          table: ({ children: tableContent }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">{tableContent}</table>
            </div>
          ),
          th: ({ children: cellContent }) => (
            <th className="border-b border-slate-700 px-2 py-1 text-left font-semibold text-slate-300">
              {cellContent}
            </th>
          ),
          td: ({ children: cellContent }) => (
            <td className="border-b border-slate-800 px-2 py-1 align-top">{cellContent}</td>
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
});
