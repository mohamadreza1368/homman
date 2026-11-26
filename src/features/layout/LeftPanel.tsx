import { useState } from "react";

import { StudyPanel } from "@/features/study/StudyPanel";
import { AnatomyTree } from "@/features/tree/AnatomyTree";
import { UsagePanel } from "@/features/usage/UsagePanel";
import { ViewControls } from "@/features/viewer/ViewControls";
import { StatusWindow } from "@/features/help/StatusWindow";
import { StorageNotice } from "./StorageNotice";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { useStudyStore } from "@/stores/studyStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useNavigationStore } from "@/stores/navigationStore";
import { DiseasePanel } from "@/features/diseases/DiseasePanel";
import { BrandLogo } from "@/components/BrandLogo";
import { AnatomyQuiz } from "@/features/anatomy/AnatomyQuiz";
import { HeartLearningPath } from "@/features/anatomy/HeartLearningPath";
import { StructureEducation } from "@/features/anatomy/StructureEducation";
import { ClinicalAtlasHub } from "@/features/anatomy/ClinicalAtlasHub";

/**
 * Primary left sidebar container hosting Anatomy Tree, Disease Knowledgebase, Education,
 * Study Notebook, and Usage Accounting panels.
 */
export function LeftPanel() {
  const currentTab = useNavigationStore((state) => state.leftPanelTab);
  const setCurrentTab = useNavigationStore((state) => state.setLeftPanelTab);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isStatusVisible, setIsStatusVisible] = useState(false);

  const registeredNotesCount = useStudyStore((state) => state.stats?.notes ?? 0);
  const currentLanguage = useInterfaceLanguage((state) => state.language);
  const switchLanguage = useInterfaceLanguage((state) => state.setLanguage);
  const isPersian = currentLanguage === "fa";

  return (
    <div
      dir={isPersian ? "rtl" : "ltr"}
      className="flex h-full min-h-0 flex-col bg-slate-900/95 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-3 border-b border-teal-900/50 px-4 py-4">
        <BrandLogo variant="mark-dark" className="h-9 w-9" decorative />
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-[0.18em] text-white" dir="ltr">
            HOOMAAN STUDIO
          </div>
          <div className="mt-0.5 text-[10px] text-teal-300/80">
            {isPersian ? "فضای یادگیری بدن انسان" : "Explore the human body"}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-slate-800 bg-slate-950/40 px-1">
        <PanelTabButton active={currentTab === "atlas"} onClick={() => setCurrentTab("atlas")}>
          {isPersian ? "اطلس" : "Atlas"}
        </PanelTabButton>
        <PanelTabButton active={currentTab === "surgical"} onClick={() => setCurrentTab("surgical")}>
          {isPersian ? "جراحی" : "Surgical"}
        </PanelTabButton>
        <PanelTabButton active={currentTab === "diseases"} onClick={() => setCurrentTab("diseases")}>
          {isPersian ? "بیماری‌ها" : "Diseases"}
        </PanelTabButton>
        <PanelTabButton active={currentTab === "education"} onClick={() => setCurrentTab("education")}>
          {isPersian ? "آموزش" : "Learn"}
        </PanelTabButton>
        <PanelTabButton active={currentTab === "study"} onClick={() => setCurrentTab("study")}>
          {isPersian ? "مطالعه" : "Study"}
          {registeredNotesCount > 0 && (
            <span className="ml-1 rounded-full bg-teal-500/20 px-1.5 py-0.2 text-[9px] text-teal-300 ring-1 ring-teal-500/30">
              {registeredNotesCount}
            </span>
          )}
        </PanelTabButton>
        <PanelTabButton active={currentTab === "usage"} onClick={() => setCurrentTab("usage")}>
          {isPersian ? "مصرف" : "Usage"}
        </PanelTabButton>
      </div>

      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/20 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setIsStatusVisible(true)}
          className="rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-500 transition hover:bg-slate-800 hover:text-teal-300"
          title={`HOOMAAN ${APP_VERSION_LABEL} — click for status and log`}
        >
          {APP_VERSION_LABEL}
        </button>
        <div className="flex items-center gap-1" aria-label="Interface language">
          <button
            type="button"
            aria-pressed={isPersian}
            onClick={() => switchLanguage("fa")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              isPersian
                ? "bg-teal-600/90 text-white ring-1 ring-teal-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            aria-pressed={!isPersian}
            onClick={() => switchLanguage("en")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              !isPersian
                ? "bg-teal-600/90 text-white ring-1 ring-teal-400/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {isStatusVisible && <StatusWindow onClose={() => setIsStatusVisible(false)} />}

      <div className={`min-h-0 flex-1 ${currentTab === "atlas" ? "" : "hidden"}`}>
        <AnatomyTree />
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${currentTab === "surgical" ? "" : "hidden"}`}>
        <ClinicalAtlasHub />
      </div>
      <div className={`min-h-0 flex-1 ${currentTab === "diseases" ? "" : "hidden"}`}>
        <DiseasePanel />
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${currentTab === "education" ? "" : "hidden"}`}>
        <div className="space-y-4 p-4">
          {!isQuizActive && <StructureEducation />}
          <HeartLearningPath />
          <AnatomyQuiz onActiveChange={setIsQuizActive} />
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${currentTab === "study" ? "" : "hidden"}`}>
        <StudyPanel />
      </div>
      <div className={`min-h-0 flex-1 ${currentTab === "usage" ? "" : "hidden"}`}>
        <UsagePanel />
      </div>

      <StorageNotice />
      <ViewControls />
    </div>
  );
}

function PanelTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 flex-1 border-b-2 px-1 py-3 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-teal-300 ${
        active
          ? "border-teal-400 text-teal-100"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
