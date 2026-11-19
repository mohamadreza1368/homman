import { useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BrandLogo } from "@/components/BrandLogo";
import { repairGluedHeadings } from "@/features/chat/repairMarkdown";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { usePrintStore } from "@/stores/printStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import {
  aiNotice,
  disclaimers,
  isPrintable,
  type PrintDocument,
  type PrintVisit,
} from "./printDocument";

/**
 * Overlay preview window displaying formatted, printable versions of study notes, transcripts, or clinical cases.
 */
export function PrintSheet() {
  const activeDocument = usePrintStore((state) => state.document);
  const dismissModal = usePrintStore((state) => state.close);

  useEffect(() => {
    if (!activeDocument) return;

    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") {
        dismissModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDocument, dismissModal]);

  if (!activeDocument) return null;

  return createPortal(
    <div
      data-print-root
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-6 backdrop-blur-sm"
    >
      <PrintToolbar onDismiss={dismissModal} />
      <article className="print-sheet mx-auto max-w-[820px] rounded bg-white px-12 py-10 text-slate-900 shadow-2xl">
        <table className="print-layout">
          <tbody>
            <tr>
              <td>
                <DocumentHeader doc={activeDocument} />
                {activeDocument.verdict && <CaseVerdictSection commentary={activeDocument.verdict} />}
                {activeDocument.structures.length > 0 && (
                  <CoveredStructuresSection structureList={activeDocument.structures} />
                )}
                {activeDocument.notes.length > 0 && <StudyNotesSection doc={activeDocument} />}
                {activeDocument.findings && <DocumentFindingsSection narrative={activeDocument.findings} />}
                {activeDocument.recordUpdates.length > 0 && (
                  <IntervalRecordUpdatesSection doc={activeDocument} />
                )}
                {activeDocument.symptoms.length > 0 && <PatientComplaintsSection doc={activeDocument} />}
                {activeDocument.visits.map((item) => (
                  <ClinicalVisitSection key={item.visitNo} visitItem={item} />
                ))}
                {activeDocument.exchanges.length > 0 && <TranscriptExchangesSection doc={activeDocument} />}
                {activeDocument.sealedAnswer && <GroundTruthAnswerSection answerText={activeDocument.sealedAnswer} />}
                {!isPrintable(activeDocument) && (
                  <p className="mt-8 text-sm italic text-slate-500">
                    There is nothing here yet to print.
                  </p>
                )}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <PrintComplianceFooter doc={activeDocument} />
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>,
    window.document.body,
  );
}

function PrintToolbar({ onDismiss }: { onDismiss: () => void }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  return (
    <div
      className="no-print mx-auto mb-4 flex max-w-[820px] items-start gap-2"
      dir={isPersian ? "rtl" : "ltr"}
    >
      <div className="text-[11px] leading-relaxed text-slate-400">
        <p>{isPersian ? "این پیش‌نمایش دقیقاً همان چیزی است که چاپ می‌شود." : "This is exactly what will be printed."}</p>
        <p className="text-slate-500">
          {isPersian ? (
            "در کادر چاپ، گزینه سرصفحه و پاورقی (Headers and footers) را غیرفعال کنید تا آدرس و تاریخ مرورگر درج نشود."
          ) : (
            <>
              In the print dialog, turn off{" "}
              <span className="text-slate-400">Headers and footers</span> — otherwise it
              stamps the page with its own date and address.
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto rounded border border-sky-600 bg-sky-600/15 px-3 py-1 text-xs text-sky-200 transition hover:bg-sky-600/30"
      >
        {isPersian ? "چاپ… یا ذخیره به صورت PDF" : "Print… or save as PDF"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
      >
        {isPersian ? "بستن · Esc" : "Close · Esc"}
      </button>
    </div>
  );
}

function formatFullTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayOnly(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DocumentHeader({ doc }: { doc: PrintDocument }) {
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

function CaseVerdictSection({ commentary }: { commentary: string }) {
  return (
    <section className="print-block mt-6 border-l-2 border-slate-400 pl-4">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        How it went
      </h2>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{commentary}</p>
    </section>
  );
}

function CoveredStructuresSection({ structureList }: { structureList: string[] }) {
  return (
    <section className="print-block mt-6">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Structures covered
      </h2>
      <p className="mt-1 text-[12px] italic leading-relaxed text-slate-700">
        {structureList.join(" · ")}
      </p>
    </section>
  );
}

function StudyNotesSection({ doc }: { doc: PrintDocument }) {
  return (
    <section className="mt-6">
      <SheetSubheading>Notes</SheetSubheading>
      <div className="mt-2 space-y-4">
        {doc.notes.map((item, idx) => (
          <div key={idx} className="print-block">
            <p className="text-[10px] text-slate-500">
              {item.structure && (
                <span className="italic text-slate-700">{item.structure} · </span>
              )}
              {formatFullTimestamp(item.when)}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentFindingsSection({ narrative }: { narrative: string }) {
  return (
    <section className="mt-6 print-block">
      <SheetSubheading>On the record</SheetSubheading>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{narrative}</p>
    </section>
  );
}

function IntervalRecordUpdatesSection({ doc }: { doc: PrintDocument }) {
  return (
    <section className="mt-6">
      <SheetSubheading>Added to the record</SheetSubheading>
      <div className="mt-2 space-y-2">
        {doc.recordUpdates.map((updateEntry, updateIdx) => (
          <div key={updateIdx} className="print-block">
            <p className="text-[10px] text-slate-500">
              <span className="font-semibold text-slate-700">
                Visit {updateEntry.visitNo}
              </span>
              {" · "}
              {formatFullTimestamp(updateEntry.when)}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
              {updateEntry.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PatientComplaintsSection({ doc }: { doc: PrintDocument }) {
  return (
    <section className="mt-6">
      <SheetSubheading>Presentation, as reported</SheetSubheading>
      <div className="mt-2 space-y-2">
        {doc.symptoms.map((complaint, index) => (
          <div key={index} className="print-block">
            <p className="text-[10px] text-slate-500">
              {complaint.structure && (
                <span className="italic text-slate-700">{complaint.structure} · </span>
              )}
              {formatFullTimestamp(complaint.when)}
              {complaint.severity !== null && (
                <span className="ml-2">severity {complaint.severity}/10</span>
              )}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed">{complaint.symptom}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClinicalVisitSection({ visitItem }: { visitItem: PrintVisit }) {
  return (
    <section className="mt-6">
      <SheetSubheading>
        Visit {visitItem.visitNo}
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
          {formatFullTimestamp(visitItem.when)}
        </span>
        {visitItem.score !== null && (
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">
            · {visitItem.score} / 100
          </span>
        )}
      </SheetSubheading>

      {visitItem.structures.length > 0 && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-slate-600">
          {visitItem.structures.join(" · ")}
        </p>
      )}

      <div className="mt-2 space-y-5">
        {visitItem.exchanges.map((chatStep, stepIdx) => (
          <div key={stepIdx}>
            <p className="print-keep-with-next text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {chatStep.role === "user" ? "Asked" : "Answered"}
              <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                {formatFullTimestamp(chatStep.when)}
              </span>
              {chatStep.model && (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  · by {chatStep.model}
                </span>
              )}
            </p>
            <div
              className={
                chatStep.role === "user"
                  ? "mt-1 border-l-2 border-slate-300 pl-3 text-[13px] leading-relaxed"
                  : "mt-1 text-[13px] leading-relaxed"
              }
            >
              <PaperStyledMarkdown>{repairGluedHeadings(chatStep.body)}</PaperStyledMarkdown>
            </div>
          </div>
        ))}
      </div>

      {visitItem.verdict && (
        <div className="mt-3 border-l-2 border-slate-400 pl-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Assessment
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">
            {visitItem.verdict}
          </p>
        </div>
      )}
    </section>
  );
}

function GroundTruthAnswerSection({ answerText }: { answerText: string }) {
  return (
    <section className="mt-6 print-block">
      <SheetSubheading>Authored answer — sealed when the case opened</SheetSubheading>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{answerText}</p>
    </section>
  );
}

function TranscriptExchangesSection({ doc }: { doc: PrintDocument }) {
  return (
    <section className="mt-6">
      <SheetSubheading>The conversation</SheetSubheading>
      <div className="mt-2 space-y-5">
        {doc.exchanges.map((exchange, index) => (
          <div key={index}>
            <p className="print-keep-with-next text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {exchange.role === "user" ? "Asked" : "Answered"}
              <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                {formatFullTimestamp(exchange.when)}
              </span>
              {exchange.model && (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  · by {exchange.model}
                </span>
              )}
            </p>
            <div
              className={
                exchange.role === "user"
                  ? "mt-1 border-l-2 border-slate-300 pl-3 text-[13px] leading-relaxed"
                  : "mt-1 text-[13px] leading-relaxed"
              }
            >
              <PaperStyledMarkdown>{repairGluedHeadings(exchange.body)}</PaperStyledMarkdown>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SheetSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="print-keep-with-next border-b border-slate-300 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
      {children}
    </h2>
  );
}

function PaperStyledMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children: c }) => <h3 className="mt-3 text-sm font-semibold">{c}</h3>,
        h2: ({ children: c }) => <h4 className="mt-3 text-[13px] font-semibold">{c}</h4>,
        h3: ({ children: c }) => (
          <h5 className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-600">
            {c}
          </h5>
        ),
        p: ({ children: c }) => <p className="mt-1.5">{c}</p>,
        ul: ({ children: c }) => <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{c}</ul>,
        ol: ({ children: c }) => <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">{c}</ol>,
        strong: ({ children: c }) => <strong className="font-semibold">{c}</strong>,
        em: ({ children: c }) => <em className="italic">{c}</em>,
        blockquote: ({ children: c }) => (
          <blockquote className="mt-1.5 border-l-2 border-slate-300 pl-3 text-slate-700">
            {c}
          </blockquote>
        ),
        a: ({ children: c }) => <span>{c}</span>,
        code: ({ children: c }) => (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{c}</code>
        ),
        pre: ({ children: c }) => (
          <pre className="print-block mt-1.5 overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">
            {c}
          </pre>
        ),
        table: ({ children: c }) => (
          <table className="print-block mt-2 w-full border-collapse text-[11px]">
            {c}
          </table>
        ),
        th: ({ children: c }) => (
          <th className="border border-slate-300 px-2 py-1 text-left font-semibold">
            {c}
          </th>
        ),
        td: ({ children: c }) => (
          <td className="border border-slate-300 px-2 py-1 align-top">{c}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function PrintComplianceFooter({ doc }: { doc: PrintDocument }) {
  return (
    <footer className="print-footer mt-10 border-t border-slate-300 pt-3 text-[9px] leading-snug text-slate-500">
      {disclaimers(doc.language).map((disclaimerText) => (
        <p key={disclaimerText}>{disclaimerText}</p>
      ))}
      {aiNotice(doc).map((disclosureText) => (
        <p key={disclosureText} className="mt-1">
          {disclosureText}
        </p>
      ))}
      <p className="mt-1">
        HOOMAAN {APP_VERSION_LABEL} · printed {formatFullTimestamp(doc.producedAt)}
      </p>
    </footer>
  );
}
