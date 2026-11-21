import { useState } from "react";
import type { Language, UserProfile } from "@/lib/schemas";
import {
  activeCase,
  FILTER_PATIENTS_FROM,
  isFull,
  matchesQuery,
  useCaseStore,
  visitLabel,
} from "@/stores/caseStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { CaseComposer } from "./CaseComposer";
import { ClinicalVitalsHUD } from "./ClinicalVitalsHUD";
import { PatientRecordDrawer, RECORD_MAX_HEIGHT } from "./PatientRecordDrawer";

export { RECORD_MAX_HEIGHT };

export interface CaseBarProps {
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
            <PatientRecordDrawer
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
