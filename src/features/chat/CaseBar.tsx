import { useState } from "react";

import { GrowingTextarea } from "@/components/GrowingTextarea";
import { whenLabel } from "@/features/study/whenLabel";
import type { Language, UserProfile } from "@/lib/schemas";
import { getStudySession, type CaseFile, type CaseSex } from "@/lib/studyDb";
import {
  activeCase,
  FILTER_PATIENTS_FROM,
  isFull,
  matchesQuery,
  reviewMaySeeTheAnswer,
  useCaseStore,
  visitLabel,
} from "@/stores/caseStore";
import { useChatStore } from "@/stores/chatStore";
import { askToConfirm } from "@/stores/confirmStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { ClinicalVitalsHUD } from "./ClinicalVitalsHUD";

/** Vertical constraint class applied to the open clinical record panel to guarantee scrolling. */
export const RECORD_MAX_HEIGHT = "max-h-[50vh]";

interface CaseBarProps {
  profile: UserProfile;
  language: Language;
}

/**
 * Top contextual toolbar for active simulated patient cases and clinical drills.
 * Handles patient selection, chart viewing, progressive documentation, and case authoring.
 */
export function CaseBar({ profile, language }: CaseBarProps) {
  const patientRegistry = useCaseStore((state) => state.cases);
  const selectedPatient = useCaseStore(activeCase);
  const choosePatient = useCaseStore((state) => state.select);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const [isComposing, setIsComposing] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [isRecordExpanded, setIsRecordExpanded] = useState(false);
  const [isWritingRecord, setIsWritingRecord] = useState(false);

  const activePatients = patientRegistry.filter((item) => !isFull(item));
  const requiresSearchFilter = activePatients.length >= FILTER_PATIENTS_FROM;
  const filteredPatients = requiresSearchFilter
    ? activePatients.filter((item) => matchesQuery(item, filterQuery))
    : activePatients;

  if (isComposing) {
    return (
      <CaseComposer
        profile={profile}
        language={language}
        onClose={() => setIsComposing(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-3 py-1.5 text-[10px]">
      {selectedPatient ? (
        <>
          <button
            type="button"
            onClick={() => setIsRecordExpanded(!isRecordExpanded)}
            aria-expanded={isRecordExpanded}
            title={isRecordExpanded ? "Hide the record" : "Show this patient's record"}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className="truncate rounded-full bg-sky-600/15 px-1.5 py-0.5 text-sky-300">
              {selectedPatient.title}
            </span>
            <span className="shrink-0 text-slate-500">
              {selectedPatient.sex === "female" ? (isPersian ? "زن" : "female") : isPersian ? "مرد" : "male"}
              {selectedPatient.age_years !== null && `, ${selectedPatient.age_years}`} ·{" "}
              {isPersian
                ? isFull(selectedPatient)
                  ? "تکمیل‌شده"
                  : `ویزیت ${selectedPatient.visit_count + 1}`
                : visitLabel(selectedPatient)}
            </span>
            <span className="shrink-0 text-slate-500">{isRecordExpanded ? "▴" : "▾"}</span>
          </button>

          {!isRecordExpanded && <ClinicalVitalsHUD patient={selectedPatient} compact />}

          <button
            type="button"
            onClick={() => {
              setIsRecordExpanded(true);
              setIsWritingRecord(true);
            }}
            title={
              isPersian
                ? "ثبت اطلاعات فعلی — وزن، فشار، نتایج تصویربرداری"
                : "Add what is known now — a weight, a pressure, what the imaging said"
            }
            className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 transition hover:border-sky-600 hover:text-sky-200"
          >
            {isPersian ? "+ پرونده" : "+ record"}
          </button>

          <button
            type="button"
            onClick={() => choosePatient(null)}
            title={
              isPersian
                ? "خروج از پرونده این بیمار. داده‌ای پاک نمی‌شود."
                : "Stop filing drills against this patient. Nothing is deleted."
            }
            className="rounded px-1 text-slate-500 transition hover:text-slate-200"
          >
            {isPersian ? "خروج" : "leave"}
          </button>

          {isRecordExpanded && (
            <PatientRecord
              patient={selectedPatient}
              writing={isWritingRecord}
              onWritingChange={setIsWritingRecord}
            />
          )}
        </>
      ) : (
        <>
          <span className="text-slate-500">{isPersian ? "تمرین موردی" : "One-off drill"}</span>

          {requiresSearchFilter && (
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={isPersian ? "یافتن بیمار…" : "Find a patient…"}
              className="w-28 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-sky-600"
            />
          )}

          {activePatients.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && choosePatient(e.target.value)}
              className="min-w-0 max-w-[11rem] rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px] text-slate-300 outline-none focus:border-sky-600"
            >
              <option value="">
                {filteredPatients.length === 0
                  ? isPersian
                    ? "بیماری یافت نشد"
                    : "No patient matches"
                  : isPersian
                    ? "ادامهٔ پرونده بیمار…"
                    : "Continue a patient…"}
              </option>
              {filteredPatients.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title} —{" "}
                  {isPersian
                    ? isFull(entry)
                      ? "تکمیل‌شده"
                      : `ویزیت ${entry.visit_count + 1}`
                    : visitLabel(entry)}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsComposing(true)}
            className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
          >
            {isPersian ? "بیمار جدید" : "New patient"}
          </button>
        </>
      )}
    </div>
  );
}

interface PatientRecordProps {
  patient: CaseFile;
  writing: boolean;
  onWritingChange: (writing: boolean) => void;
}

function PatientRecord({ patient, writing, onWritingChange }: PatientRecordProps) {
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

interface RecordComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecordComposer({ open, onOpenChange }: RecordComposerProps) {
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

interface CaseComposerProps {
  profile: UserProfile;
  language: Language;
  onClose: () => void;
}

function CaseComposer({ profile, language, onClose }: CaseComposerProps) {
  const createCase = useCaseStore((state) => state.open);
  const storeError = useCaseStore((state) => state.error);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const [title, setTitle] = useState("");
  const [sex, setSex] = useState<CaseSex>("female");
  const [ageYears, setAgeYears] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [findingsText, setFindingsText] = useState("");
  const [groundTruthAnswer, setGroundTruthAnswer] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && groundTruthAnswer.trim().length > 0;

  function parseNumberOrNull(val: string): number | null {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  async function handleSeal() {
    setIsBusy(true);
    try {
      const created = await createCase({
        id: crypto.randomUUID(),
        title: title.trim(),
        sex,
        age_years: parseNumberOrNull(ageYears),
        height_cm: parseNumberOrNull(heightCm),
        findings: findingsText.trim(),
        weight_kg: parseNumberOrNull(weightKg),
        ground_truth: groundTruthAnswer.trim(),
        profile,
        language,
      });
      if (created) onClose();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-slate-800 px-3 py-2 text-[10px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          {isPersian ? "بیمار فرضی جدید" : "New virtual patient"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-slate-500 transition hover:text-slate-200"
        >
          {isPersian ? "انصراف" : "cancel"}
        </button>
      </div>

      <p className="leading-snug text-amber-300/80">
        {isPersian
          ? "طراحی‌شده برای آموزش — هرگز مشخصات یک فرد واقعی را وارد نکنید. این پرونده در هر نوبت به هوش مصنوعی شما ارسال می‌شود."
          : "Invented for teaching — never a real person. The case is sent to your AI provider with every turn of the drill."}
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          isPersian
            ? "موضوع پرونده — مثلاً درد قفسه سینه، ۵۸ ساله"
            : "What the case is about — e.g. Chest pain, 58"
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <div className="flex items-center gap-1.5">
        <div className="flex overflow-hidden rounded border border-slate-700">
          {(["female", "male"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSex(opt)}
              aria-pressed={sex === opt}
              className={`px-2 py-0.5 transition ${
                sex === opt
                  ? "bg-slate-700/70 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {opt === "female" ? (isPersian ? "زن" : "Female") : isPersian ? "مرد" : "Male"}
            </button>
          ))}
        </div>
        <input
          value={ageYears}
          onChange={(e) => setAgeYears(e.target.value)}
          inputMode="numeric"
          placeholder={isPersian ? "سن" : "Age"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
        <input
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          inputMode="numeric"
          placeholder={isPersian ? "قد (cm)" : "cm"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
        <input
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          inputMode="decimal"
          placeholder={isPersian ? "وزن (kg)" : "kg"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
      </div>

      <p className="leading-snug text-slate-600">
        {isPersian
          ? "جنسیت بر استدلال تأثیر دارد. مدل سه‌بعدی در این نسخه فارغ از انتخاب شما ساختار پایه را نشان می‌دهد."
          : "Sex drives the reasoning. The 3D model in this build is male whichever you choose."}
      </p>

      <GrowingTextarea
        limit="24vh"
        value={findingsText}
        onChange={(e) => setFindingsText(e.target.value)}
        rows={2}
        placeholder={
          isPersian
            ? "آنچه در پرونده موجود است — علائم حیاتی، سابقه، آزمایش‌ها. کاربر این را می‌بیند."
            : "What is on the record — vitals, history, results. The reader sees this."
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 leading-relaxed outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <GrowingTextarea
        limit="24vh"
        value={groundTruthAnswer}
        onChange={(e) => setGroundTruthAnswer(e.target.value)}
        rows={3}
        placeholder={
          isPersian
            ? "علت و تشخیص واقعی. اکنون مهروموم شده و در زمان درخواست آشکار می‌شود."
            : "What is actually going on. Sealed now, revealed when you ask."
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 leading-relaxed outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <p className="leading-snug text-slate-600">
        {isPersian
          ? "قبل از هر تلاشی نوشته می‌شود و پس از آن غیرقابل ویرایش است — پاسخی که بعد از تلاش تعیین شود ارزش ارزیابی ندارد."
          : "Written before anything is attempted, and never editable afterwards — an answer decided once the attempt is in hand grades nothing."}
      </p>

      {storeError && <p className="leading-snug text-rose-400">{storeError}</p>}

      <button
        type="button"
        onClick={() => void handleSeal()}
        disabled={!canSubmit || isBusy}
        className="w-full rounded border border-sky-700/60 bg-sky-600/15 px-2 py-1 text-sky-200 transition hover:bg-sky-600/25 disabled:opacity-40"
      >
        {isPersian ? "مهروموم و شروع پرونده" : "Seal and open"}
      </button>
    </div>
  );
}
