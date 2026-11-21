import { activeCase, reviewReadiness, useCaseStore } from "@/stores/caseStore";

/**
 * Overview of patient case findings and visits prior to review synthesis.
 */
export function ReviewIntro({ onAsk, disabled }: { onAsk: () => void; disabled: boolean }) {
  const targetPatient = useCaseStore(activeCase);
  const caseSymptoms = useCaseStore((state) => state.symptoms);
  const pastVisits = useCaseStore((state) => state.visits);
  const patientRecord = useCaseStore((state) => state.record);

  if (!targetPatient) {
    return (
      <div className="space-y-2 pt-6 text-center text-xs text-slate-500">
        <p>No patient is open.</p>
        <p className="text-slate-600">
          A review is always about a case. Pick one above, or start a new
          conversation.
        </p>
      </div>
    );
  }

  const analysisProfile = reviewReadiness(targetPatient, caseSymptoms, pastVisits, patientRecord);
  const summaryInputs = [
    analysisProfile.complaints > 0 &&
      `${analysisProfile.complaints} ${analysisProfile.complaints === 1 ? "complaint" : "complaints"} marked on the body`,
    !analysisProfile.bare && "the findings on the record",
    analysisProfile.updates > 0 &&
      `${analysisProfile.updates} later ${analysisProfile.updates === 1 ? "entry" : "entries"}`,
    analysisProfile.visits > 0 && `${analysisProfile.visits} ${analysisProfile.visits === 1 ? "visit" : "visits"}`,
  ].filter((item): item is string => typeof item === "string");

  return (
    <div className="space-y-3 pt-6 text-center text-xs text-slate-500">
      <p>Reading the file back on {targetPatient.title}.</p>
      <p className="text-slate-600">
        What was presented, what has been reasoned, and where the gaps are.
        Nothing is written into the record.
      </p>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onAsk}
          className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-30"
        >
          Summarise this case
        </button>
      </div>

      <div className="mx-auto max-w-[19rem] space-y-1.5 pt-1 text-left text-[10px] leading-snug text-slate-600">
        {summaryInputs.length > 0 && <p>It reads {summaryInputs.join(", ")}.</p>}

        {analysisProfile.visits === 0 && (
          <p className="text-amber-500/70">
            No visit has been recorded yet, so there is no reasoning to review —
            only what you have marked.
          </p>
        )}

        {analysisProfile.bare && (
          <p className="text-amber-500/70">
            This case carries no findings, so the summary has the complaints and
            the visits and nothing else to reason from. Add what is known from
            the patient record above — the sealed answer stays sealed either
            way.
          </p>
        )}

        {analysisProfile.ungraded > 0 && (
          <p>
            The sealed answer stays sealed: {analysisProfile.ungraded} of {analysisProfile.visits}{" "}
            {analysisProfile.visits === 1 ? "visit is" : "visits are"} ungraded, and so are
            their verdicts. Grade them and a review may use both.
          </p>
        )}

        {analysisProfile.visits > 0 && analysisProfile.ungraded === 0 && (
          <p>Every visit is graded, so the sealed answer is included.</p>
        )}
      </div>
    </div>
  );
}
