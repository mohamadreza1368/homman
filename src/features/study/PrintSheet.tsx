import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePrintStore } from "@/stores/printStore";
import { isPrintable } from "./printDocument";
import { DocumentHeader } from "./PrintDocumentHeader";
import {
  CaseVerdictSection,
  ClinicalVisitSection,
  CoveredStructuresSection,
  DocumentFindingsSection,
  GroundTruthAnswerSection,
  IntervalRecordUpdatesSection,
  PatientComplaintsSection,
  PrintComplianceFooter,
  StudyNotesSection,
  TranscriptExchangesSection,
} from "./PrintDocumentSections";
import { PrintToolbar } from "./PrintToolbar";

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
