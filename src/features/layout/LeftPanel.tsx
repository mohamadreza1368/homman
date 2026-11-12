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
import { DiseasePanel } from "@/features/diseases/DiseasePanel";
import { BrandLogo } from "@/components/BrandLogo";

type Tab = "atlas" | "diseases" | "study" | "usage";

/**
 * The left column: the atlas, the student's own journal, and what the
 * assistant has cost.
 *
 * All three panels stay mounted and are hidden with CSS rather than unmounted.
 * The tree carries which systems are expanded and where the list is scrolled —
 * state that is expensive to rebuild and infuriating to lose because you
 * glanced at a note. The journal, symmetrically, keeps a half-written note.
 *
 * Consumption is a tab here rather than anything in the assistant panel. It is
 * a separate activity from asking a question: you come looking for it once,
 * when a bill surprises you, and it would tax every reading of every answer if
 * it lived alongside them. The one number that does belong next to an answer —
 * what that answer cost — is already there, as a single faint line.
 */
export function LeftPanel() {
  const [tab, setTab] = useState<Tab>("atlas");
  const [status, setStatus] = useState(false);
  const noteCount = useStudyStore((s) => s.stats?.notes ?? 0);
  const language = useInterfaceLanguage((s) => s.language);
  const setLanguage = useInterfaceLanguage((s) => s.setLanguage);
  const fa = language === 'fa';

  return (
    <div dir={fa ? "rtl" : "ltr"} className="flex h-full min-h-0 flex-col bg-[#09151c]">
      <div className="flex items-center gap-3 border-b border-teal-900/50 px-4 py-4">
        <BrandLogo variant="mark-dark" className="h-9 w-9" decorative />
        <div className="min-w-0"><div className="text-sm font-bold tracking-[0.18em] text-white" dir="ltr">HOMMAN</div><div className="mt-0.5 text-[10px] text-teal-300/80">{fa ? "فضای یادگیری بدن انسان" : "Explore the human body"}</div></div>
      </div>
      <div className="flex shrink-0 border-b border-slate-800 px-1">
        <TabButton active={tab === "atlas"} onClick={() => setTab("atlas")}>
          {fa ? 'اطلس' : 'Atlas'}
        </TabButton>
        <TabButton active={tab === "diseases"} onClick={() => setTab("diseases")}>
          {fa ? 'بیماری‌ها' : 'Diseases'}
        </TabButton>
        <TabButton active={tab === "study"} onClick={() => setTab("study")}>
          {fa ? 'مطالعه' : 'Study'}
          {noteCount > 0 && (
            <span className="ml-1 rounded-full bg-slate-700/70 px-1 text-[9px] text-slate-300">
              {noteCount}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "usage"} onClick={() => setTab("usage")}>
          {fa ? 'مصرف' : 'Usage'}
        </TabButton>
        {/*
          Sits in the tab strip rather than in a dialog, because the question it
          answers — "which build is this?" — is asked by someone reporting a
          problem or comparing two plates, and both of those are worse errands
          if the answer is three clicks deep. `shrink-0` keeps the three tabs
          sharing the width as they did before.
        */}
        <button
          type="button"
          onClick={() => setStatus(true)}
          className="shrink-0 self-center px-2 text-[10px] font-medium tabular-nums text-slate-600 transition hover:text-slate-300"
          title={`HOOMAAN ${APP_VERSION_LABEL} — click for status and log`}
        >
          {APP_VERSION_LABEL}
        </button>
      </div>
      <div className="flex justify-end gap-1 border-b border-slate-800 px-3 py-2" aria-label="Interface language">
        <button type="button" aria-pressed={fa} onClick={() => setLanguage('fa')} className={`rounded-lg px-2 py-1 text-xs ${fa ? 'bg-teal-700 text-white' : 'text-slate-400'}`}>فارسی</button>
        <button type="button" aria-pressed={!fa} onClick={() => setLanguage('en')} className={`rounded-lg px-2 py-1 text-xs ${!fa ? 'bg-teal-700 text-white' : 'text-slate-400'}`}>English</button>
      </div>

      {/* Rendered from here rather than from `App`, because the button that
          opens it lives here and the two have no reason to know about a third
          place. It covers the whole window by its own positioning. */}
      {status && <StatusWindow onClose={() => setStatus(false)} />}

      <div className={`min-h-0 flex-1 ${tab === "atlas" ? "" : "hidden"}`}>
        <AnatomyTree />
      </div>
      <div className={`min-h-0 flex-1 ${tab === "diseases" ? "" : "hidden"}`}>
        <DiseasePanel />
      </div>
      <div className={`min-h-0 flex-1 ${tab === "study" ? "" : "hidden"}`}>
        <StudyPanel />
      </div>
      <div className={`min-h-0 flex-1 ${tab === "usage" ? "" : "hidden"}`}>
        <UsagePanel />
      </div>

      {/*
        Below all three tabs rather than inside one. How the model is drawn is
        not a property of the tab you happen to be reading: someone taking notes
        in Study needs the body turned to glass exactly as much as someone
        browsing the tree, and used to have to leave the tab to do it.
      */}
      {/* Above the controls rather than below them, so it is the last thing
          read before the settings it is about — and so it never lands in the
          strip's wrapping row, which is the one part of this column that can
          be pushed out of a short window. */}
      <StorageNotice />
      <ViewControls />
    </div>
  );
}

function TabButton({
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
