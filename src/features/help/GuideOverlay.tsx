import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { useCopy } from "@/features/chat/useCopy";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { MAX_SEVERITY, MAX_VISITS } from "@/lib/studyDb";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { FA_SECTIONS } from "./guideSectionsFa";

/** Dedicated contact email for inquiry, institution support, and custom builds. */
const CONTACT_EMAIL = "info@hoomaan.app";

export interface Section {
  id: string;
  nav: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "boundary",
    nav: "What this is",
    title: "An atlas that explains itself",
    body: (
      <>
        <p>
          HOOMAAN unites an interactive 3D anatomical atlas with an AI clinical tutor.
          Ask anatomical or functional questions, and the assistant coordinates with the
          viewport in real time — isolating candidate organs, rendering cross-sections,
          and pinpointing pathology regions so visual evidence matches each explanation.
        </p>
        <Callout>
          <strong>It is study material, and only that.</strong> HOOMAAN is not a
          medical device and gives no advice about any real person. If you describe
          symptoms — yours or anyone&apos;s — the assistant will decline and point you to a
          qualified professional. That boundary is deliberate and cannot be switched
          off.
        </Callout>
        <p>
          Everything stays on your machine except what the assistant needs to answer.
          The anatomy ships with the app and your journal lives in a local file. When
          you ask, HOOMAAN sends the AI provider whose key you supplied your
          question, the recent conversation, what is on screen — the structures
          selected, the scanner and the heart — and, in a case drill, the whole file is
          sent to your AI provider. Nothing goes anywhere else. A <em>Local model</em>{" "}
          keeps everything entirely on your own device and sends no data externally.
        </p>
        <Callout>
          <strong>Current atlas model:</strong> The workspace displays a standardized
          male adult anatomical atlas engineered for medical education. It does not
          reproduce every anatomical variation found in patient populations.
        </Callout>
        <Callout>
          <strong>Deliberate atlas boundaries:</strong> Several structures are excluded
          by design from this version. The gastrointestinal tract flows from duodenum to
          jejunum and continues into the colon, omitting the <em>ileum, caecum, rectum or
          anal canal</em>. The <em>meninges</em> (dura, arachnoid, pia) are absent, and
          <em>skin</em> is organized as regional surface zones rather than a continuous
          singular organ. The thoracic duct, vocal folds, and bronchopulmonary segments
          are also omitted, though all segmental bronchi remain present.
        </Callout>
        <p>
          Compound assemblies such as the skull, larynx, lungs, peritoneal reflections,
          and lumbosacral plexuses exist as discrete modular sub-meshes. Context menus
          and right-clicks allow selecting either individual elements or their parent groups.
        </p>
        <p>
          Fully realized systems include complete arterial and venous vascular trees,
          skeletal muscles, urinary and endocrine organs, the complete skeleton, the
          twelve cranial nerves, extensive lymphatic chains, and Couinaud hepatic segments.
        </p>
      </>
    ),
  },
  {
    id: "moving",
    nav: "Moving around",
    title: "Getting to what you want to see",
    body: (
      <>
        <Rows
          rows={[
            ["Drag", "Orbit around the model"],
            ["Right-drag", "Pan — slide the model sideways"],
            ["Scroll", "Zoom toward the pointer, not the centre"],
          ]}
        />
        <p>
          Camera zoom tracks your cursor position directly. Pointing at a fine branch
          and zooming navigates straight to that target rather than pulling toward the
          body center of mass.
        </p>
        <p>
          The <Ui>Atlas</Ui> tree on the left groups structures by anatomical system.
          Toggling a system off unloads its geometry dynamically to maintain peak
          rendering throughput.
        </p>
        <Callout>
          <strong>Orientation controls:</strong> The viewport footer offers rapid
          camera resets. <Ui>Fit</Ui> reframes either the entire atlas or the currently
          isolated selection. The <Ui>A P L R S</Ui> buttons jump to standard
          anatomical orientations: anterior, posterior, left/right lateral, and superior.
          <br />
          <br />
          These orientation buttons preserve your current magnification distance,
          allowing you to pivot around an active structure. Note that <Ui>L</Ui> refers
          to anatomical left of the model, not screen-space coordinates.
        </Callout>
        <Callout>
          <strong><Ui>Study views</Ui> split layout:</strong> Once an organ or system
          is isolated, enabling Study Views tiles the viewport into four synchronized
          angles. The top-left panel remains interactive for orbiting and selection, while
          the remaining three panels provide fixed <Ui>A</Ui> (anterior), <Ui>L</Ui>{" "}
          (left lateral), and <Ui>S</Ui> (superior) projections at matching scale.
        </Callout>
        <p>
          Interface preferences (active systems, translucency states, labels, background
          style) persist between runs. Temporary interaction states such as active lasso
          selections, isolations, or section slices reset cleanly upon new sessions.
        </p>
        <p>
          Each system supports four distinct visibility controls: checkbox to hide/show,
          <Ui>◐</Ui> to apply translucency (ghosting), <Ui>X-ray</Ui> to ghost all other
          surrounding systems, and <Ui>Solo</Ui> to exclusively isolate that system.
        </p>
        <Callout>
          <strong>Raycast depth probe:</strong> Hovering over any anatomical point
          populates the right-hand depth inspection panel from superficial surface to deep
          structures (e.g. skin, platysma, sternocleidomastoid, carotid sheath, and artery).
          <br />
          <br />
          Clicking the body pins this depth readout in place. You can hover lines for{" "}
          <Ui>solo</Ui> isolation or click <Ui>Isolate these …</Ui> to preserve the full
          surgical trajectory. Press <Ui>Esc</Ui> at any time to restore the complete model.
        </Callout>
        <p>
          Activating <Ui>Glass body</Ui> renders the atlas in translucent glass, while the
          structures intersecting the cursor ray are highlighted with an amber-white beam.
        </p>
      </>
    ),
  },
  {
    id: "section",
    nav: "Cross-sections",
    title: "Reading a section",
    body: (
      <>
        <p>
          The tomography scanner moves an illuminated section plane vertically along the
          craniocaudal axis. Releasing the slider with sectioning enabled cuts through
          the volume, presenting axial or coronal perspectives analogous to diagnostic CT.
        </p>
        <Rows
          rows={[
            ["Cut", "Volumetric dissection exposing structures deep to the plane"],
            ["Slab", "A clean 4 mm anatomical slice highlighting boundaries"],
          ]}
        />
        <p>
          The inspection header reports the corresponding vertebral milestone (such as{" "}
          <em>T8</em> or <em>L4–L5</em>), cross-sectional field diameter in centimeters,
          and total anatomical structures traversed by the cut.
        </p>
        <Rows
          rows={[
            ["Wheel", "Traverse slice depth in 1 cm increments"],
            ["Ctrl + Wheel", "Magnify centered on the cursor inside the slice"],
            ["Measure", "Click-drag across the slice to compute real millimeter distance"],
            ["Save", "Export high-resolution section frame to PNG"],
          ]}
        />
      </>
    ),
  },
  {
    id: "heart",
    nav: "The heart, beating",
    title: "Watching and hearing the heart",
    body: (
      <>
        <p>
          Toggling <Ui>Heartbeat</Ui> initiates procedural cardiac cycle animation.
          Atrial contraction precedes ventricular systole via simulated atrioventricular
          nodal conduction. A synchronized real-time rhythm strip tracks the cardiac phases.
        </p>
        <Callout>
          <strong>Physiological educational model:</strong> Dynamic heart motions and
          auscultation sounds (S1/S2) reflect classic textbook hemodynamic curves rather
          than diagnostic clinical telemetry of a specific patient.
        </Callout>
        <p>
          Auscultation mode plays synthesized heart tones in sync with valve closures.
          The rhythm dropdown allows exploring tachycardia, bradycardia, flutter,
          fibrillation, and heart block dynamics.
        </p>
      </>
    ),
  },
  {
    id: "breathing",
    nav: "Breathing",
    title: "Watching the body breathe",
    body: (
      <>
        <p>
          Enabling <Ui>Breathing</Ui> simulates thoracic and diaphragmatic mechanics across
          standard tidal (12 bpm) and deep diaphragmatic (6 bpm) patterns.
        </p>
        <p>
          During the inspiratory phase, diaphragmatic descent is coupled with pump-handle
          and bucket-handle ribcage expansion, lung expansion, and caudal displacement
          of the abdominal viscera.
        </p>
      </>
    ),
  },
  {
    id: "choosing",
    nav: "Choosing structures",
    title: "Selecting, isolating, dissecting",
    body: (
      <>
        <Rows
          rows={[
            ["Click", "Select a single anatomical structure"],
            ["Ctrl-Click", "Add or remove from multi-structure selection"],
            ["Double-Click", "Inspect hierarchical substructures"],
            ["Right-Click", "Open contextual dissection and scope menu"],
            ["Ctrl-Drag", "Draw lasso boundary to select all enclosed structures"],
          ]}
        />
        <p>
          Keyboard accelerators streamline dissection: press <Ui>I</Ui> to isolate all
          selected items, <Ui>H</Ui> to hide them from view, and <Ui>Esc</Ui> to reset
          visibility across all systems.
        </p>
      </>
    ),
  },
  {
    id: "assistant",
    nav: "The assistant",
    title: "Asking, and being shown",
    body: (
      <>
        <p>
          The assistant connects to any standard OpenAI-compatible API endpoint.
          Configure your preferred base URL, API key, and model name in <Ui>Settings</Ui>.
        </p>
        <Callout>
          Your secret keys are stored securely using your operating system keyring and
          are never exposed in plaintext within the web view or exported files.
        </Callout>
        <p>
          Beyond textual conversation, the tutor commands the 3D scene: reorienting the
          camera, isolating organs, adjusting lighting, and tagging anatomical names as
          clickable interactive pins that zoom directly to the structure.
        </p>
      </>
    ),
  },
  {
    id: "local",
    nav: "Local model",
    title: "A model on your own computer",
    body: (
      <>
        <p>
          HOOMAAN does not include a model and will not download one. If you want private,
          zero-cost offline inference, you can install Ollama on your system and run a
          compact instruct model such as <code>ollama pull gemma3:4b</code>.
        </p>
        <Callout>
          To use a local runner, point the Base URL in settings to{" "}
          <code>http://127.0.0.1:11434/v1</code>. Your question, the recent conversation
          and what you have selected go to Ollama on this computer, at its local address,
          and to nowhere else. Models that run on Ollama&apos;s servers are refused.
        </Callout>
        <p>
          It has no tools, responses are not saved to your journal.
          Local models make more mistakes than the large ones. Ollama also offers models that run on
          its servers; those should be evaluated under your own external policies.
        </p>
        <p>
          When interacting with smaller models, a button means the name is real, not that
          what was said about it is true. A question about a real person gets a fixed
          notice, not an answer, so it is not a guarantee. Because a small model keeps it
          less reliably, remember: It is a model on your computer, not a safeguard.
        </p>
      </>
    ),
  },
  {
    id: "cases",
    nav: "Case drills",
    title: "Practising instead of reading",
    body: (
      <>
        <p>
          In <Ui>Case</Ui> mode, the assistant presents clinical vignettes: chief
          complaints, history of present illness, and physical examination findings.
        </p>
        <p>
          You evaluate differential diagnoses, identify affected anatomical structures,
          and propose workups. The assistant critiques clinical reasoning and assigns a
          diagnostic accuracy score out of 100.
        </p>
      </>
    ),
  },
  {
    id: "patients",
    nav: "Virtual patients",
    title: "A case you can follow across visits",
    body: (
      <>
        <p>
          Virtual patient cases simulate longitudinal clinical follow-ups. You configure
          patient demographics, initial baseline vitals, and track evolution over up to{" "}
          {MAX_VISITS} visits.
        </p>
        <p>
          Symptom severity scales from 0 to {MAX_SEVERITY}. Right-clicking anatomical
          regions links pain loci or tenderness directly to 3D structures.
        </p>
        <p>
          Underlying diagnoses remain sealed until clinical exploration is finalized.
          Selecting Case Summary compiles a comprehensive diagnostic evaluation report.
        </p>
      </>
    ),
  },
  {
    id: "journal",
    nav: "Your journal",
    title: "What you write down, and what you have done",
    body: (
      <>
        <p>
          The <Ui>Study</Ui> tab archives your learning history locally in SQLite.
          You can append private clinical notes to any anatomical item and review past
          case exercises.
        </p>
        <p>
          The print feature compiles a clean, publication-ready study sheet suitable for
          direct printing or PDF archiving.
        </p>
      </>
    ),
  },
  {
    id: "memory",
    nav: "Study memory",
    title: "Your journal, as a map of memories",
    body: (
      <>
        <p>
          The <Ui>Memory Lab</Ui> transforms study milestones into an interactive 3D
          holographic memory palace mapped onto cortical landmarks.
        </p>
        <p>
          Memory nodes glow according to retention intervals. Clicking any node
          recalls related clinical interactions, notes, and anatomical references.
        </p>
      </>
    ),
  },
  {
    id: "usage",
    nav: "What it costs",
    title: "Tokens, and where they went",
    body: (
      <>
        <p>
          The <Ui>Usage</Ui> panel breaks down token consumption across prompt input and
          completion output for each AI session.
        </p>
        <p>
          This telemetry ensures transparent estimation of third-party API costs and token
          quotas across all study drills.
        </p>
      </>
    ),
  },
  {
    id: "bridge",
    nav: "Another agent",
    title: "Letting a program you already pay for drive this one",
    body: (
      <>
        <p>
          HOOMAAN features a local control bridge via named pipes / domain sockets,
          enabling IDEs, scripts, or external AI agents (like Claude Desktop or custom
          Python tools) to orchestrate the atlas.
        </p>
        <p>
          External agents can navigate viewpoints, isolate structures, toggle cross-sections,
          and query scene status via strict typed JSON-RPC protocols.
        </p>
      </>
    ),
  },
  {
    id: "keys",
    nav: "Keyboard",
    title: "Shortcuts",
    body: (
      <>
        <Rows
          rows={[
            ["I", "Isolate selected structures"],
            ["H", "Hide selected structures"],
            ["Esc", "Restore all structures"],
            ["F", "Fit camera to model / selection"],
            ["A", "Anterior viewpoint"],
            ["P", "Posterior viewpoint"],
            ["L", "Left lateral viewpoint"],
            ["R", "Right lateral viewpoint"],
            ["S", "Superior viewpoint"],
            ["+", "Zoom in one increment"],
            ["-", "Zoom out one increment"],
            ["?", "Open this guide overlay"],
          ]}
        />
      </>
    ),
  },
  {
    id: "regulations",
    nav: "Regulations",
    title: "Regulatory transparency",
    body: (
      <>
        <p>
          HOOMAAN operates under complete regulatory transparency and strict educational
          boundaries:
        </p>
        <Callout>
          <strong>Educational classification statement:</strong> In accordance with{" "}
          <strong>Regulation (EU) 2017/745 (MDR)</strong>, this application is designed
          solely for academic anatomical instruction and simulation. It is not an
          approved medical device, delivers no patient diagnostics or therapeutic plans,
          and this statement is not a certificate of medical conformity.
        </Callout>
        <p>
          Development adheres to the ethical governance mandates of{" "}
          <strong>Regulation (EU) 2024/1689</strong> (EU Artificial Intelligence Act) and
          data privacy safeguards under <strong>Regulation (EU) 2016/679</strong> (GDPR).
          No personal telemetry or user activity tracking is ever gathered.
        </p>
        <p>
          When submitting case drills, the whole file is sent to your AI provider under
          your configured credentials; no intermediary proxy servers retain or inspect
          your study queries.
        </p>
        <p className="text-[11px] text-slate-500">
          Questions about any of this, or about use in an institution:{" "}
          <span className="select-all text-slate-300">{CONTACT_EMAIL}</span>
        </p>
      </>
    ),
  },
  {
    id: "credits",
    nav: "Credits",
    title: "Who built this, and what it is made of",
    body: (
      <>
        <Credit
          role="Product Design & Architecture"
          name="HOOMAAN Engineering"
          badge="HOOMAAN"
        >
          Engineered as a high-fidelity 3D human anatomy educational platform and
          interactive clinical case simulator.
        </Credit>

        <Credit
          role="Licensing & Terms"
          name="HOOMAAN Medical Atlas"
          badge="BSL 1.1"
        >
          The HOOMAAN software application is licensed under the{" "}
          <strong>Business Source License 1.1</strong>. It is free for educational
          learning, non-commercial research, and personal study. Commercial deployments,
          revenue-generating clinics, and closed redistributed bundles require an
          authorized commercial agreement. The application codebase transitions to
          open source four years after its release under its designated transition terms.
          This software license does not reach the anatomy meshes and labels, which
          remain under their upstream open licenses.
        </Credit>

        <ContactCard />

        <h3 className="pt-2 text-[13px] font-semibold text-slate-200">
          Anatomical Geometry & Attribution
        </h3>
        <Rows
          rows={[
            ["BodyParts3D", "Database Center for Life Science (DBCLS), Japan — CC BY-SA 2.1 JP"],
            ["Z-Anatomy", "Libre 3D anatomy atlas derived from BodyParts3D — CC BY-SA 4.0"],
            ["Terminologia Anatomica 2", "Standardized Latin medical taxonomy via TA2"],
            ["HOOMAAN Atlas", "Optimization, Draco compression, and identifier schema — CC BY-SA 4.0"],
          ]}
        />

        <h3 className="pt-2 text-[13px] font-semibold text-slate-200">
          Core Technologies
        </h3>
        <p>
          Built upon open source: <Ui>Tauri</Ui> for the lightweight desktop runtime,{" "}
          <Ui>React</Ui> and <Ui>React Three Fiber</Ui> with <Ui>three.js</Ui> for WebGL
          rendering, Google <Ui>Draco</Ui> for 3D compression, <Ui>Rust</Ui> and{" "}
          <Ui>SQLite</Ui> for persistent journal storage, and <Ui>Python</Ui> with{" "}
          <Ui>Pydantic</Ui> for structured tutor orchestration.
        </p>
        <p className="pt-2 text-[11px] text-slate-500">
          HOOMAAN {APP_VERSION_LABEL}. Application source under Business Source License 1.1;
          anatomical models under CC BY-SA 4.0 and CC BY 4.0.
        </p>
      </>
    ),
  },
];

export function GuideOverlay({ onClose }: { onClose: () => void }) {
  const language = useInterfaceLanguage((s) => s.language);
  const setLanguage = useInterfaceLanguage((s) => s.setLanguage);
  const fa = language === "fa";
  const sections = fa ? FA_SECTIONS : SECTIONS;
  const [active, setActive] = useState(sections[0]!.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px" },
    );
    for (const section of sections) {
      const node = root.querySelector(`#${section.id}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div
      dir={fa ? "rtl" : "ltr"}
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={fa ? "راهنمای کارکرد هومان" : "How HOOMAAN works"}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <nav
          className={`hidden w-44 shrink-0 flex-col gap-0.5 ${
            fa ? "border-l" : "border-r"
          } border-slate-800 bg-slate-950/40 p-3 sm:flex`}
        >
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            {fa ? "راهنما" : "Guide"}
          </p>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                scrollRef.current
                  ?.querySelector(`#${section.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={`rounded px-2 py-1 ${fa ? "text-right" : "text-left"} text-[11px] transition ${
                active === section.id
                  ? "bg-sky-600/15 text-sky-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {section.nav}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-100">
              <BrandLogo variant="mark-dark" className="h-5 w-auto shrink-0" decorative />
              {fa ? "راهنمای کارکرد هومان" : "How HOOMAAN works"}
            </h2>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-0.5 rounded-full border border-slate-700/80 bg-slate-950/80 p-0.5"
                aria-label={fa ? "تغییر زبان راهنما" : "Guide language"}
              >
                <button
                  type="button"
                  onClick={() => setLanguage("fa")}
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                    fa ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  فارسی
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                    !fa ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  English
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                {fa ? "شروع کاوش" : "Start exploring"}
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-4 pb-7">
                <h3 className="mb-2 text-[13px] font-semibold text-slate-100">
                  {section.title}
                </h3>
                <div className="space-y-2.5 text-[12px] leading-relaxed text-slate-400">
                  {section.body}
                </div>
              </section>
            ))}
            <p className="border-t border-slate-800 pt-3 text-[10px] text-slate-600">
              {fa ? (
                <>
                  این پنجره را در هر زمان با زدن روی علامت <Ui>؟</Ui> در بالای صفحه باز کنید.
                  داده‌های آناتومی از Z-Anatomy تحت مجوز CC BY-SA 4.0.
                </>
              ) : (
                <>
                  Reopen this any time with <Ui>?</Ui> at the top of the window. Anatomy
                  from Z-Anatomy, CC BY-SA 4.0 — see NOTICE.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <h4 className="pt-1.5 text-[12px] font-semibold text-slate-200">{children}</h4>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-700/70 bg-slate-950/50 px-3 py-2 text-slate-300">
      {children}
    </div>
  );
}

export function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded border border-slate-800">
      {rows.map(([gesture, effect], index) => (
        <div
          key={gesture}
          className={`flex gap-3 px-3 py-1.5 ${
            index % 2 === 0 ? "bg-slate-950/40" : ""
          }`}
        >
          <kbd className="w-28 shrink-0 font-sans text-[11px] font-medium text-sky-300">
            {gesture}
          </kbd>
          <span className="text-[12px] text-slate-400">{effect}</span>
        </div>
      ))}
    </div>
  );
}

export function Ui({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-slate-200">{children}</span>;
}

export function ContactCard() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const { copied, copy } = useCopy();
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {fa ? "تماس و ارتباط" : "Contact"}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="select-all text-base font-semibold text-slate-100">{CONTACT_EMAIL}</span>
        <button
          type="button"
          onClick={() => void copy(CONTACT_EMAIL)}
          className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 transition hover:border-sky-600 hover:text-sky-300"
        >
          {copied ? (fa ? "کپی شد" : "Copied") : fa ? "کپی آدرس" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
        {fa
          ? "پشتیبانی، ویژگی‌های سفارشی و استفاده در دانشگاه‌ها، مراکز درمانی و محیط‌های آموزشی بالینی."
          : "Direct support, institutional licensing, and educational inquiries: " + CONTACT_EMAIL}
      </p>
    </div>
  );
}

export function Credit({
  role,
  name,
  badge,
  children,
}: {
  role: string;
  name: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {role}
      </p>
      <p className="mt-1 text-base font-semibold text-slate-100">{name}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-sky-400">
        {badge}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}
