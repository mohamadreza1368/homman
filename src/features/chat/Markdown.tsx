import { memo, useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useScanStore } from "@/stores/scanStore";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import type { RhythmId } from "@/features/viewer/rhythms";

import {
  collectOrganRefs,
  linkifyOrganRefs,
  REF_SCHEME,
  RHYTHM_SCHEME,
  SLICE_SCHEME,
} from "./organRefs";
import { repairGluedHeadings } from "./repairMarkdown";
import { useCopy } from "./useCopy";

/**
 * Renders assistant output.
 *
 * The model writes Markdown — headings, lists, emphasis, the occasional table
 * of diagnostic findings. Showing that raw would bury the structure it uses to
 * teach, so it is rendered. Only Markdown is parsed: raw HTML is not enabled,
 * which keeps model output from becoming a markup injection vector inside the
 * webview.
 */
function CodeBlock({ children }: { children: React.ReactNode }) {
  const text = String(children).replace(/\n$/, "");
  const { copied, copy } = useCopy();

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        onClick={() => void copy(text)}
        className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-200"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

/**
 * A numbered pin tying a phrase in the answer to a structure in the viewport.
 *
 * Hovering highlights the mesh, clicking flies the camera to it — the same
 * store the assistant's own tools write to, so a click and a tool call put the
 * scene in exactly the same state.
 */
function OrganPin({ organId, label }: { organId: string; label: string }) {
  const organ = useSceneStore((s) => s?.organs?.[organId]);
  const setHovered = useSceneStore((s) => s?.setHovered);
  const focusReference = useSceneStore((s) => s?.focusReference);
  if (!organ) return null;

  const name = organLabel(organ);

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered?.(organId)}
      onMouseLeave={() => setHovered?.(null)}
      onFocus={() => setHovered?.(organId)}
      onBlur={() => setHovered?.(null)}
      onClick={() => focusReference?.(organId, Number(label))}
      title={`Show ${name}`}
      aria-label={`Show ${name}`}
      className="mx-0.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-sky-500/25 px-1 align-super text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/40 transition hover:bg-sky-400/50 hover:text-white hover:ring-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      {label}
    </button>
  );
}

/**
 * A cardiac rhythm interactive pill: clicking plays the rhythm and focuses on heart.
 */
function RhythmPin({ rhythmId, label }: { rhythmId: string; label: string }) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");

  const handleClick = () => {
    useHeartStore.setState({ enabled: true });
    useHeartStore.getState().setRhythm?.(rhythmId as RhythmId);
    useHeartStore.getState().setSound?.(true);
    useSceneStore.getState().focusReference?.("cor_ventriculus_sinister", 1);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={fa ? `پخش ریتم قلبی ${label} در مدل سه‌بعدی` : `Play heart rhythm ${label} in 3D scene`}
      className="mx-1 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 text-[11px] font-medium text-rose-300 shadow-sm transition hover:border-rose-400 hover:bg-rose-900/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
    >
      <span className="inline-block animate-pulse text-rose-400">♥</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * A tomographic slice interactive pill: clicking sets the scanner level to that vertebra or organ.
 */
function SlicePin({ target, label }: { target: string; label: string }) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");

  const handleClick = () => {
    useScanStore.setState({ enabled: true, axial: true });
    useSceneStore.getState().applyCommand?.({ action: "scan_at_structure", organ_id: target });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={fa ? `حرکت مقطع اسکنر به تراز ${label}` : `Navigate CT slice to ${label}`}
      className="mx-1 inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-medium text-cyan-300 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-900/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
    >
      <span className="inline-block text-cyan-400">⌖</span>
      <span>{label}</span>
    </button>
  );
}

export const Markdown = memo(function Markdown({
  children,
  structurePins = true,
}: {
  children: string;
  structurePins?: boolean;
}) {
  const organs = useSceneStore((s) => s?.organs);

  const source = useMemo(() => {
    const repaired = repairGluedHeadings(children);
    if (!structurePins) return repaired;
    const refs = collectOrganRefs(repaired, (organId) => organId in organs);
    return linkifyOrganRefs(repaired, refs);
  }, [children, organs, structurePins]);

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
          h1: ({ children }) => (
            <h3 className="mt-3 text-sm font-semibold text-slate-100">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-3 text-[13px] font-semibold text-slate-100">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {children}
            </h5>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-4 marker:text-slate-600">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-4 marker:text-slate-600">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-50">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-sky-700/60 pl-3 text-slate-400">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => {
            if (
              structurePins &&
              href &&
              (href.startsWith(REF_SCHEME) || href.startsWith("anatria-ref:"))
            ) {
              const prefix = href.startsWith(REF_SCHEME) ? REF_SCHEME : "anatria-ref:";
              return (
                <OrganPin
                  organId={href.slice(prefix.length)}
                  label={String(children)}
                />
              );
            }
            if (structurePins && href && href.startsWith(RHYTHM_SCHEME)) {
              return (
                <RhythmPin
                  rhythmId={href.slice(RHYTHM_SCHEME.length)}
                  label={String(children)}
                />
              );
            }
            if (structurePins && href && href.startsWith(SLICE_SCHEME)) {
              return (
                <SlicePin
                  target={href.slice(SLICE_SCHEME.length)}
                  label={String(children)}
                />
              );
            }
            return (
              <span className="text-sky-400 underline decoration-dotted" title={href}>
                {children}
              </span>
            );
          },
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <CodeBlock>{children}</CodeBlock>
            ) : (
              <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-sky-200">
                {children}
              </code>
            ),
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-700 px-2 py-1 text-left font-semibold text-slate-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-800 px-2 py-1 align-top">{children}</td>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
