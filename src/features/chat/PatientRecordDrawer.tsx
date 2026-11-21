import { useState } from "react";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import { whenLabel } from "@/features/study/whenLabel";
import { getStudySession, type CaseFile } from "@/lib/studyDb";
import {
  reviewMaySeeTheAnswer,
  useCaseStore,
} from "@/stores/caseStore";
import { useChatStore } from "@/stores/chatStore";
import { askToConfirm } from "@/stores/confirmStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { ClinicalVitalsHUD } from "./ClinicalVitalsHUD";

export const RECORD_MAX_HEIGHT = "max-h-[50vh]";

export interface PatientRecordDrawerProps {
  patient: CaseFile;
  writing: boolean;
  onWritingChange: (writing: boolean) => void;
}

export function PatientRecordDrawer({ patient, writing, onWritingChange }: PatientRecordDrawerProps) {
  const symptomList = useCaseStore((state) => state.symptoms);
  const visitHistory = useCaseStore((state) => state.visits);
  const recordNotes = useCaseStore((state) => state.record);
  const deleteNote = useCaseStore((state) => state.unnote);
  const fetchSealedAnswer = useCaseStore((state) => state.reveal);
  const executeSceneAction = useSceneStore((state) => state.applyCommand);
  const setOrganHover = useSceneStore((state) => state.setHovered);
  const selectOrganList = useSceneStore((state) => state.selectMany);
  const restoreChatSession = useChatStore((state) => state.loadSession);
  const activeSessionId = useChatStore((state) => state.sessionId);
  const initiateChatSession = useChatStore((state) => state.beginSession);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const [revealedText, setRevealedText] = useState<string | null>(null);

  const canReviewUngraded = !reviewMaySeeTheAnswer(visitHistory, patient.revealed_at);

  const launchCaseReview = () => {
    initiateChatSession("review");
  };

  const handleUnsealConfirmation = async () => {
    const isApproved = await askToConfirm({
      title: isPersian ? "آیا پاسخ مهروموم‌شده باز شود؟" : "Open the sealed answer?",
      subject: patient.title,
      body: isPersian
        ? "این گزینه متنی را که هنگام گشایش پرونده نوشتید نشان می‌دهد. این اقدام ثبت می‌شود و پرونده به عنوان بازشده علامت‌گذاری می‌گردد. داده‌ای پاک نمی‌شود و پاسخ نیز قابل ویرایش نیست."
        : "This shows what you wrote when the case was opened, before anything had been attempted. It is recorded: from now on this case reads as opened, and a review of it may use the answer and the written verdicts. Nothing is deleted, and the answer itself cannot be edited.",
      confirmLabel: isPersian ? "نمایش پاسخ" : "Show me the answer",
    });

    if (isApproved) {
      const unsealed = await fetchSealedAnswer(patient.id);
      setRevealedText(unsealed);
    }
  };

  const handleShowRevealedAnswer = async () => {
    const unsealed = await fetchSealedAnswer(patient.id);
    setRevealedText(unsealed);
  };

  const handleReopenVisit = async (sessionId: string) => {
    try {
      const sessionDetail = await getStudySession(sessionId);
      if (!sessionDetail) return;
      restoreChatSession(sessionDetail);
      selectOrganList(sessionDetail.structures);
    } catch {
      useCaseStore.setState({ error: "Could not reopen that visit." });
    }
  };

  const physicalMetrics = [
    patient.age_years !== null &&
      (isPersian ? `${patient.age_years} سال` : `${patient.age_years} years`),
    patient.height_cm !== null &&
      (isPersian ? `${patient.height_cm} سانتی‌متر` : `${patient.height_cm} cm`),
    patient.weight_kg !== null &&
      (isPersian ? `${patient.weight_kg} کیلوگرم` : `${patient.weight_kg} kg`),
  ].filter((entry): entry is string => typeof entry === "string");

  return (
    <div
      className={`mt-1.5 w-full shrink-0 space-y-2 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-2 ${RECORD_MAX_HEIGHT}`}
    >
      {physicalMetrics.length > 0 && (
        <p className="text-slate-500">{physicalMetrics.join(" · ")}</p>
      )}

      <ClinicalVitalsHUD patient={patient} />

      {(patient.findings.trim() !== "" || recordNotes.length > 0) && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            {isPersian ? "در پرونده" : "On the record"}
          </p>
          {patient.findings.trim() !== "" && (
            <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-slate-400">
              {patient.findings}
            </p>
          )}

          {recordNotes.map((note) => (
            <div key={note.id} className="group mt-1 flex items-baseline gap-1.5">
              <span className="shrink-0 tabular-nums text-slate-600">
                {isPersian ? `ویزیت ${note.visit_no}` : `Visit ${note.visit_no}`}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed text-slate-400">
                {note.body}
              </span>
              <button
                type="button"
                onClick={() => void deleteNote(note.id)}
                title={isPersian ? "حذف این مورد" : "Remove this entry"}
                className="shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
              >
                ×
              </button>
            </div>
          ))}

          <RecordComposer open={writing} onOpenChange={onWritingChange} />
        </div>
      )}

      {patient.findings.trim() === "" && recordNotes.length === 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            {isPersian ? "در پرونده" : "On the record"}
          </p>
          <p className="mt-0.5 leading-snug text-slate-600">
            {isPersian
              ? "موردی در پرونده ثبت نشده است. آنچه را که از بیمار مشخص است بنویسید تا دستیار بتواند بر مبنای آن استدلال کند."
              : "Nothing on the record. This case was opened before findings had a place to go — write what is known and the assistant can reason from it."}
          </p>
          <RecordComposer open={writing} onOpenChange={onWritingChange} />
        </div>
      )}

      {symptomList.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            {isPersian ? "علائم ثبت‌شده بر بدن" : "Marked on the body"}
          </p>
          <div className="mt-0.5 space-y-0.5">
            {symptomList.map((sym) => (
              <button
                key={sym.id}
                type="button"
                onMouseEnter={() => setOrganHover(sym.organ_id)}
                onMouseLeave={() => setOrganHover(null)}
                onClick={() =>
                  executeSceneAction({ action: "focus_organ", organ_id: sym.organ_id })
                }
                className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left transition hover:bg-slate-800/60"
              >
                <span className="min-w-0 flex-1 truncate text-amber-300/90">
                  {sym.symptom}
                </span>
                {sym.organ_label && (
                  <span className="shrink-0 truncate italic text-slate-500">
                    {sym.organ_label}
                  </span>
                )}
                {sym.severity !== null && (
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {sym.severity}/10
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {visitHistory.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            {isPersian ? "ویزیت‌ها" : "Visits"}
          </p>
          <div className="mt-0.5 space-y-0.5">
            {visitHistory.map((v) => (
              <button
                key={v.session_id}
                type="button"
                disabled={v.session_id === activeSessionId}
                onClick={() => void handleReopenVisit(v.session_id)}
                title={
                  v.session_id === activeSessionId
                    ? isPersian
                      ? "در حال حاضر در این ویزیت هستید"
                      : "You are in this visit"
                    : v.verdict ?? (isPersian ? "بازگشایی مجدد این ویزیت" : "Reopen this visit")
                }
                className={`flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left transition ${
                  v.session_id === activeSessionId
                    ? "bg-sky-600/10 text-sky-300"
                    : "hover:bg-slate-800/60"
                }`}
              >
                <span className="shrink-0 text-slate-400">
                  {isPersian ? `ویزیت ${v.visit_no}` : `Visit ${v.visit_no}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {whenLabel(v.created_at)}
                </span>
                {v.score !== null && (
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {v.score}/100
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {symptomList.length === 0 && visitHistory.length === 0 && (
        <p className="leading-snug text-slate-600">
          {isPersian
            ? "هنوز چیزی ثبت نشده است. روی ساختار آناتومی راست‌کلیک کنید تا علائم گزارش‌شده را مشخص نمایید."
            : "Nothing recorded yet. Right-click a structure to mark what the patient reports there."}
        </p>
      )}

      {patient.revealed_at === null ? (
        <button
          type="button"
          onClick={() => void handleUnsealConfirmation()}
          className="w-full rounded border border-amber-800/60 py-1 text-amber-300/80 transition hover:border-amber-600 hover:text-amber-200"
        >
          {isPersian ? "افشای پاسخ مهروموم‌شده" : "Reveal the sealed answer"}
        </button>
      ) : revealedText === null ? (
        <button
          type="button"
          onClick={() => void handleShowRevealedAnswer()}
          title={
            isPersian
              ? `گشوده‌شده در ${whenLabel(patient.revealed_at)}`
              : `Opened ${whenLabel(patient.revealed_at)}`
          }
          className="w-full rounded border border-slate-700 py-1 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          {isPersian ? "نمایش پاسخ · از مهروموم خارج شده" : "Show the answer · no longer sealed"}
        </button>
      ) : (
        <div className="rounded border border-amber-800/40 bg-amber-950/20 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">
            {isPersian ? "پاسخ، همان‌طور که مهروموم کردید" : "The answer, as you sealed it"}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-amber-100/80">
            {revealedText}
          </p>
        </div>
      )}

      {(symptomList.length > 0 || visitHistory.length > 0) && (
        <button
          type="button"
          onClick={launchCaseReview}
          title={
            canReviewUngraded
              ? isPersian
                ? "خلاصهٔ این پرونده. پاسخ مهروموم‌شده تا نمره‌دهی همه ویزیت‌ها پنهان می‌ماند."
                : "Summarise this case. The sealed answer stays sealed while a visit is ungraded."
              : isPersian
                ? "خلاصهٔ این پرونده، شامل پاسخ"
                : "Summarise this case, including the answer"
          }
          className="w-full rounded border border-slate-700 py-1 text-slate-300 transition hover:border-sky-600 hover:text-sky-200"
        >
          {isPersian ? "مرور این پرونده" : "Review this case"}
          {canReviewUngraded && (
            <span className="ml-1 text-slate-600">
              {isPersian ? "· پاسخ مهروموم می‌ماند" : "· answer stays sealed"}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export function RecordComposer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const persistNote = useCaseStore((state) => state.note);
  const [noteContent, setNoteContent] = useState("");
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="mt-1 text-slate-600 transition hover:text-sky-300"
      >
        {isPersian ? "+ ثبت در پرونده" : "+ Add to the record"}
      </button>
    );
  }

  const handleSave = async () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return;
    const ok = await persistNote(trimmed);
    if (!ok) return;
    setNoteContent("");
    onOpenChange(false);
  };

  return (
    <div className="mt-1 space-y-1">
      <GrowingTextarea
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        autoFocus
        rows={2}
        placeholder={
          isPersian
            ? "آنچه اکنون مشخص است — وزن، فشار، نتایج تصویربرداری"
            : "What is known now — a weight, a pressure, what the imaging said"
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-700 focus:border-sky-600"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={noteContent.trim() === ""}
          className="rounded bg-sky-600 px-2 py-0.5 font-medium disabled:opacity-30"
        >
          {isPersian ? "افزودن" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setNoteContent("");
            onOpenChange(false);
          }}
          className="text-slate-500 transition hover:text-slate-300"
        >
          {isPersian ? "انصراف" : "Cancel"}
        </button>
        <span className="text-slate-700">
          {isPersian
            ? "موارد افزوده حفظ می‌شوند و جایگزین نمی‌گردند."
            : "Entries are kept, not replaced."}
        </span>
      </div>
    </div>
  );
}
