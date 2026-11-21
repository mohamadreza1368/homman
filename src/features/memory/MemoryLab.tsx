/**
 * HOOMAAN Memory Laboratory - Spatial Knowledge Journal
 *
 * Clean-room component providing 3D neural memory visualization,
 * clinical session inspection, anatomical organ correlation, and spaced review.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStudySession } from "@/lib/studyDb";
import { useStudyStore } from "@/stores/studyStore";

import "./memoryLab.css";
import { EraseQueue, RESTORE_WINDOW_S } from "./eraseQueue";
import { freeMargins, studiedRowsFor, type Box } from "./layout";
import { studiedIds, studiedOrgans, type StudiedOrgan } from "./studied";
import {
  CLASSIFICATION_TITLES,
  computeLayoutTier,
  CONTEXT_RESTORE_TIMEOUT_MS,
  evaluateGraphicsAdvisory,
  EXTENDED_LOAD_WARNING_DELAY_MS,
  formatEpochTimestamp,
  type MemoryInspectionState,
  type ViewportLayoutTier,
} from "./memoryLabUtils";
import { LabHelp } from "./LabHelp";
import { MemoryIndex } from "./MemoryIndex";
import { MemoryReader } from "./MemoryReader";
import { MemoryTimeline as Timeline } from "./MemoryTimeline";
import { useMemoryDataLoader } from "./useMemoryDataLoader";
import { useHologramLabScene } from "./useHologramLabScene";
import { StudiedOrgansPanel } from "./StudiedOrgansPanel";
import { useMemoryCallout } from "./useMemoryCallout";
import { useMemoryHotkeys } from "./useMemoryHotkeys";

export function MemoryLab({ onClose }: { onClose: () => void }) {
  const containerRootRef = useRef<HTMLDivElement>(null);
  const webglStageRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);

  const headerRef = useRef<HTMLElement>(null);
  const leftPanelRef = useRef<HTMLElement>(null);
  const rightPanelRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const calloutTagRef = useRef<HTMLDivElement>(null);

  const eraseBufferRef = useRef(new EraseQueue());

  const [hoveredMemoryKey, setHoveredMemoryKey] = useState<string | null>(null);
  const [selectedMemoryKey, setSelectedMemoryKey] = useState<string | null>(null);
  const [activeInspection, setActiveInspection] = useState<MemoryInspectionState | null>(null);
  const [erasedKeysSet, setErasedKeysSet] = useState<Set<string>>(new Set());
  const [pendingEraseItem, setPendingEraseItem] = useState<{ key: string; left: number } | null>(null);

  const [isHoldingErase, setIsHoldingErase] = useState(false);
  const [currentTier, setCurrentTier] = useState<ViewportLayoutTier>(() =>
    computeLayoutTier(
      typeof window !== "undefined" ? window.innerWidth : 1024,
      typeof window !== "undefined" ? window.innerHeight : 768,
    ),
  );
  const [isRailNavOpen, setIsRailNavOpen] = useState(false);
  const [isExpandedReader, setIsExpandedReader] = useState(false);
  const [isHelpGuideVisible, setIsHelpGuideVisible] = useState(false);
  const [isSlowInitialLoad, setIsSlowInitialLoad] = useState(false);

  const [associatedOrganList, setAssociatedOrganList] = useState<StudiedOrgan[] | null>([]);
  const [pinnedOrganNode, setPinnedOrganNode] = useState<string | null>(null);
  const [hoveredOrganNode, setHoveredOrganNode] = useState<string | null>(null);
  const [isAllOrgansUnfolded, setIsAllOrgansUnfolded] = useState(false);
  const [isOrganCameraZoomed, setIsOrganCameraZoomed] = useState(false);
  const [visibleOrganRowCount, setVisibleOrganRowCount] = useState(4);

  // Data loader hook
  const {
    memoryList,
    cachedNotesMap,
    displayErrorMessage,
    setDisplayErrorMessage,
  } = useMemoryDataLoader();

  // 3D Scene hook
  const {
    sceneInstanceRef,
    avatarInstanceRef,
    audioSynthRef,
    currentHoloPhase,
    mappedMemoryCount,
    hardwareGraphicsStatus,
    isSoftwareOnlyFallback,
    anatomicalAtlas,
    isAudioEnabled,
    toggleAudio,
    isFocusReaderActive,
    toggleFocusReader,
    reconnect,
  } = useHologramLabScene({
    containerRootRef,
    webglStageRef,
    avatarContainerRef,
    memoryList,
    onHoverMemory: setHoveredMemoryKey,
    onSelectMemory: (key) => selectMemoryItem(key),
    onError: setDisplayErrorMessage,
  });

  const availableLiveMemories = useMemo(() => {
    if (!memoryList) return [];
    return memoryList.filter((item) => !erasedKeysSet.has(item.key));
  }, [memoryList, erasedKeysSet]);

  const memoryLookupMap = useMemo(
    () => new Map(memoryList?.map((m) => [m.key, m])),
    [memoryList],
  );

  const activeHighlightedOrgan = hoveredOrganNode ?? pinnedOrganNode;

  // Slow initial loading detection timer
  useEffect(() => {
    if (currentHoloPhase !== "boot") {
      setIsSlowInitialLoad(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIsSlowInitialLoad(true),
      EXTENDED_LOAD_WARNING_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [currentHoloPhase]);

  // Sync studied organs from active inspection
  useEffect(() => {
    setPinnedOrganNode(null);
    setHoveredOrganNode(null);
    setIsAllOrgansUnfolded(false);
    setIsOrganCameraZoomed(false);

    if (!selectedMemoryKey || !activeInspection) {
      setAssociatedOrganList([]);
      return;
    }

    if (activeInspection.state === "loading") {
      setAssociatedOrganList(null);
      const timer = window.setTimeout(() => {
        setAssociatedOrganList((prev) => (prev === null ? [] : prev));
      }, CONTEXT_RESTORE_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }

    if (activeInspection.state === "note") {
      const organ = anatomicalAtlas.find((item) => item.organ_id === activeInspection.note.organ_id);
      setAssociatedOrganList(
        organ
          ? [
              {
                id: organ.organ_id,
                name: organ.name_en,
                file: organ.mesh_file,
                node: organ.node,
              },
            ]
          : [],
      );
      return;
    }

    if (activeInspection.state === "session") {
      const atlasSet = new Set(anatomicalAtlas.map((item) => item.organ_id));
      const ids = studiedIds(
        activeInspection.detail.structures,
        activeInspection.detail.messages.map((m) => m.content),
        (id) => atlasSet.has(id),
      );
      setAssociatedOrganList(anatomicalAtlas.length > 0 ? studiedOrgans(ids, anatomicalAtlas) : []);
    }
  }, [selectedMemoryKey, activeInspection, anatomicalAtlas]);

  // Project studied organs onto the 3D avatar hologram
  useEffect(() => {
    const avatar = avatarInstanceRef.current;
    if (!avatar) return;

    if (!associatedOrganList || associatedOrganList.length === 0) {
      void avatar.show([]);
      return;
    }

    const payload = associatedOrganList.map((item) => ({
      id: item.id,
      node: item.node,
      file: item.file,
    }));
    void avatar.show(payload);
  }, [associatedOrganList, avatarInstanceRef]);

  useEffect(() => {
    avatarInstanceRef.current?.pick(activeHighlightedOrgan);
  }, [activeHighlightedOrgan, avatarInstanceRef]);

  useEffect(() => {
    avatarInstanceRef.current?.zoom(isOrganCameraZoomed, pinnedOrganNode);
  }, [isOrganCameraZoomed, pinnedOrganNode, avatarInstanceRef]);

  const handleOrganHover = useCallback(
    (organId: string | null) => {
      setHoveredOrganNode(organId);
      if (organId) audioSynthRef.current?.hover("note");
    },
    [audioSynthRef],
  );

  useEffect(() => {
    avatarInstanceRef.current?.setPresence(isRailNavOpen ? 0.15 : 1);
  }, [isRailNavOpen, avatarInstanceRef]);

  // Viewport layout responsiveness and dynamic stage margins
  useEffect(() => {
    const hostEl = containerRootRef.current;
    if (!hostEl) return;

    const performMeasurement = () => {
      setCurrentTier(computeLayoutTier(hostEl.clientWidth, hostEl.clientHeight));
      setVisibleOrganRowCount(studiedRowsFor(avatarContainerRef.current?.clientHeight ?? 0));

      const hostRect = hostEl.getBoundingClientRect();
      const registeredPanels: Box[] = [];

      for (const panelRef of [avatarContainerRef, leftPanelRef, rightPanelRef, footerRef]) {
        const p = panelRef.current;
        if (!p || p.classList.contains("ml-hidden") || p.classList.contains("ml-wide")) continue;
        if (p.offsetParent === null) continue;

        const bounds = p.getBoundingClientRect();
        registeredPanels.push({
          left: bounds.left - hostRect.left,
          top: bounds.top - hostRect.top,
          right: bounds.right - hostRect.left,
          bottom: bounds.bottom - hostRect.top,
        });
      }

      sceneInstanceRef.current?.setFocus(
        freeMargins(registeredPanels, hostEl.clientWidth, hostEl.clientHeight),
      );
    };

    const debounceTimer = window.setTimeout(performMeasurement, 40);
    const ro = new ResizeObserver(performMeasurement);
    ro.observe(hostEl);

    return () => {
      window.clearTimeout(debounceTimer);
      ro.disconnect();
    };
  }, [
    selectedMemoryKey,
    isRailNavOpen,
    isExpandedReader,
    currentTier,
    currentHoloPhase,
    memoryList,
    sceneInstanceRef,
  ]);

  // Erase queue flush and execution
  const executeJournalDeletions = useCallback(
    async (keysToPurge: string[]) => {
      const store = useStudyStore.getState();
      for (const key of keysToPurge) {
        const [type, strId] = key.split(":") as [string, string];
        const isSuccessful =
          type === "note" ? await store.removeNote(Number(strId)) : await store.removeSession(strId);
        if (!isSuccessful) {
          setDisplayErrorMessage("A memory could not be erased. It is still in your journal.");
        }
      }
    },
    [setDisplayErrorMessage],
  );

  useEffect(() => {
    const intervalTimer = window.setInterval(() => {
      const currentMs = Date.now();
      const readyForDeletion = eraseBufferRef.current.due(currentMs);
      if (readyForDeletion.length > 0) {
        void executeJournalDeletions(readyForDeletion);
      }
      setPendingEraseItem((prev) => {
        if (!prev) return null;
        if (!eraseBufferRef.current.isPending(prev.key)) return null;
        return {
          key: prev.key,
          left: eraseBufferRef.current.secondsLeft(prev.key, currentMs),
        };
      });
    }, 250);

    return () => window.clearInterval(intervalTimer);
  }, [executeJournalDeletions]);

  const handleLabDismissal = useCallback(() => {
    const queuedItems = eraseBufferRef.current.flush();
    if (queuedItems.length > 0) {
      void executeJournalDeletions(queuedItems);
    }
    onClose();
  }, [executeJournalDeletions, onClose]);

  const dispatchMemoryErase = useCallback(
    (key: string) => {
      eraseBufferRef.current.erase(key, Date.now());
      sceneInstanceRef.current?.erase(key);
      audioSynthRef.current?.erase();
      setErasedKeysSet((prev) => new Set(prev).add(key));
      setPendingEraseItem({ key, left: RESTORE_WINDOW_S });
      setSelectedMemoryKey(null);
      sceneInstanceRef.current?.select(null);
    },
    [audioSynthRef, sceneInstanceRef],
  );

  const dispatchMemoryRestore = useCallback(
    (key: string) => {
      if (!eraseBufferRef.current.restore(key)) return;
      sceneInstanceRef.current?.restore(key);
      audioSynthRef.current?.restore();
      setErasedKeysSet((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setPendingEraseItem(null);
    },
    [audioSynthRef, sceneInstanceRef],
  );

  // Inspect selected memory details
  useEffect(() => {
    if (!selectedMemoryKey) {
      setActiveInspection(null);
      return;
    }

    const targetMemory = memoryLookupMap.get(selectedMemoryKey);
    if (!targetMemory) return;

    if (targetMemory.kind === "note") {
      const studyNote = cachedNotesMap.get(targetMemory.id);
      setActiveInspection(studyNote ? { state: "note", note: studyNote } : { state: "missing" });
      return;
    }

    setActiveInspection({ state: "loading" });
    let isStale = false;

    getStudySession(targetMemory.id)
      .then((sessionData) => {
        if (!isStale) {
          setActiveInspection(
            sessionData ? { state: "session", detail: sessionData } : { state: "missing" },
          );
        }
      })
      .catch(() => {
        if (!isStale) setActiveInspection({ state: "missing" });
      });

    return () => {
      isStale = true;
    };
  }, [selectedMemoryKey, memoryLookupMap, cachedNotesMap]);

  const activeTierTracker = useRef(currentTier);
  activeTierTracker.current = currentTier;

  const selectMemoryItem = useCallback(
    (key: string | null) => {
      setSelectedMemoryKey(key);
      sceneInstanceRef.current?.select(key);
      if (key === null) {
        setIsExpandedReader(false);
      }
      if (key !== null && activeTierTracker.current === "compact") {
        setIsRailNavOpen(false);
      }
    },
    [sceneInstanceRef],
  );

  const toggleExpandedReader = useCallback(() => setIsExpandedReader((exp) => !exp), []);

  const onHoldBegin = useCallback(() => {
    setIsHoldingErase(true);
    audioSynthRef.current?.holdStart();
  }, [audioSynthRef]);

  const onHoldCancel = useCallback(() => {
    setIsHoldingErase(false);
    audioSynthRef.current?.holdEnd();
  }, [audioSynthRef]);

  const onHoldCompleted = useCallback(
    (key: string) => {
      setIsHoldingErase(false);
      audioSynthRef.current?.holdEnd();
      dispatchMemoryErase(key);
    },
    [audioSynthRef, dispatchMemoryErase],
  );

  // Floating memory pointer callout alignment
  const activeFocusKey = isExpandedReader ? null : (hoveredMemoryKey ?? selectedMemoryKey);

  useMemoryCallout({
    calloutTagRef,
    containerRootRef,
    avatarContainerRef,
    leftPanelRef,
    rightPanelRef,
    sceneInstanceRef,
    activeFocusKey,
  });

  // Global hotkeys
  const activeKeysList = useMemo(
    () => availableLiveMemories.map((m) => m.key),
    [availableLiveMemories],
  );

  useMemoryHotkeys({
    isHelpGuideVisible,
    setIsHelpGuideVisible,
    isExpandedReader,
    setIsExpandedReader,
    selectedMemoryKey,
    selectMemoryItem,
    isRailNavOpen,
    setIsRailNavOpen,
    handleLabDismissal,
    currentHoloPhase,
    activeKeysList,
  });

  const totalRegisteredMemories = memoryList?.length ?? 0;
  const isIntroSequenceActive = currentHoloPhase !== "live" && !isSoftwareOnlyFallback;
  const advisoryStatusNotice = evaluateGraphicsAdvisory(isSoftwareOnlyFallback, hardwareGraphicsStatus);
  const activeCalloutMemory = activeFocusKey ? memoryLookupMap.get(activeFocusKey) : undefined;
  const inspectedMemoryRecord = selectedMemoryKey ? memoryLookupMap.get(selectedMemoryKey) : undefined;

  return (
    <div
      ref={containerRootRef}
      className={`ml-root ${isFocusReaderActive ? "ml-focus" : ""}`}
      data-size={currentTier}
      role="dialog"
      aria-label="Study memory"
      onPointerDown={() => audioSynthRef.current?.resume()}
      onClick={() => {
        if (!isIntroSequenceActive) return;
        sceneInstanceRef.current?.skipIntro();
        avatarInstanceRef.current?.skipIntro();
      }}
    >
      <div ref={webglStageRef} className="ml-stage" />

      <div
        ref={avatarContainerRef}
        className={`ml-body ${totalRegisteredMemories > 0 && !isSoftwareOnlyFallback ? "" : "ml-hidden"}`}
      >
        <StudiedOrgansPanel
          associatedOrganList={inspectedMemoryRecord ? associatedOrganList : []}
          activeHighlightedOrgan={activeHighlightedOrgan}
          pinnedOrganNode={pinnedOrganNode}
          isAllOrgansUnfolded={isAllOrgansUnfolded}
          visibleOrganRowCount={visibleOrganRowCount}
          isOrganCameraZoomed={isOrganCameraZoomed}
          onOrganHover={handleOrganHover}
          onOrganPin={(id) => setPinnedOrganNode((prev) => (prev === id ? null : id))}
          onToggleUnfold={() => setIsAllOrgansUnfolded((all) => !all)}
          onToggleZoom={() => {
            if (!isOrganCameraZoomed) {
              setIsAllOrgansUnfolded(false);
            }
            setIsOrganCameraZoomed(!isOrganCameraZoomed);
          }}
        />
      </div>

      <div className="ml-hud">
        <header ref={headerRef} className="ml-head">
          <div className="ml-title">STUDY MEMORY</div>
          <div className="ml-sub">
            YOUR JOURNAL · {availableLiveMemories.length} MEMORIES · STORED ON THIS COMPUTER
          </div>
        </header>

        <div className="ml-corner">
          <button
            type="button"
            className={`ml-help-toggle ${isHelpGuideVisible ? "ml-on" : ""}`}
            onClick={() => setIsHelpGuideVisible((v) => !v)}
            aria-expanded={isHelpGuideVisible}
            aria-label="How this screen works"
            title="How this screen works (?)"
          >
            ?
          </button>
          <button
            type="button"
            className={`ml-focus-toggle ${isFocusReaderActive ? "ml-on" : ""}`}
            onClick={toggleFocusReader}
            aria-pressed={isFocusReaderActive}
            title={
              isFocusReaderActive
                ? "Bring the film texture back"
                : "Clear the film texture and sharpen the text for reading"
            }
          >
            <i aria-hidden>◎</i>
            FOCUS {isFocusReaderActive ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className={`ml-sound ${isAudioEnabled ? "ml-on" : ""}`}
            onClick={toggleAudio}
            aria-pressed={isAudioEnabled}
            title={isAudioEnabled ? "Turn the lab's sound off" : "Turn the lab's sound on"}
          >
            <i aria-hidden>
              <b />
              <b />
              <b />
              <b />
            </i>
            SOUND {isAudioEnabled ? "ON" : "OFF"}
          </button>
          <button type="button" className="ml-exit" onClick={handleLabDismissal}>
            EXIT <span aria-hidden>✕</span>
          </button>
        </div>

        {memoryList && memoryList.length === 0 && (
          <div className="ml-empty">
            <b>NO MEMORIES YET</b>
            Every conversation with the assistant, every case and every note you keep becomes a
            memory here.
          </div>
        )}

        {totalRegisteredMemories > 0 && (
          <>
            {!isIntroSequenceActive && (
              <button
                type="button"
                className={`ml-rail ${isRailNavOpen ? "ml-on" : ""}`}
                onClick={() => setIsRailNavOpen((open) => !open)}
                aria-expanded={isRailNavOpen}
              >
                <span aria-hidden>{isRailNavOpen ? "▴" : "▾"}</span> MEMORY INDEX ·{" "}
                {availableLiveMemories.length}
              </button>
            )}

            <section
              ref={leftPanelRef}
              className={`ml-panel ml-left ${
                isIntroSequenceActive || !isRailNavOpen ? "ml-hidden" : ""
              }`}
            >
              <MemoryIndex
                live={availableLiveMemories}
                selected={selectedMemoryKey}
                onChoose={selectMemoryItem}
              />
            </section>

            <section
              ref={rightPanelRef}
              className={`ml-panel ml-right ${inspectedMemoryRecord ? "" : "ml-hidden"} ${
                isExpandedReader ? "ml-wide" : ""
              }`}
              aria-live="polite"
            >
              {inspectedMemoryRecord && (
                <MemoryReader
                  memory={inspectedMemoryRecord}
                  reading={activeInspection}
                  wide={isExpandedReader}
                  holding={isHoldingErase}
                  onToggleWide={toggleExpandedReader}
                  onClose={selectMemoryItem}
                  onHoldStart={onHoldBegin}
                  onHoldEnd={onHoldCancel}
                  onHoldDone={onHoldCompleted}
                />
              )}
            </section>

            <footer ref={footerRef} className="ml-bottom">
              {isIntroSequenceActive ? (
                <>
                  <div className="ml-row">
                    <div className="ml-status">
                      {currentHoloPhase === "boot" &&
                        (isSlowInitialLoad
                          ? "STILL LOADING · THIS COMPUTER IS TAKING LONGER THAN USUAL"
                          : "ACCESSING STUDY MEMORY")}
                      {currentHoloPhase === "deploy" && "DEPLOYING HOLOGRAPHIC PROJECTION"}
                      {currentHoloPhase === "materialize" && "RECONSTRUCTING NEURAL SURFACE"}
                      {currentHoloPhase === "mapping" &&
                        `MAPPING STUDY MEMORY · ${
                          memoryLookupMap
                            .get(memoryList![Math.max(0, mappedMemoryCount - 1)]!.key)
                            ?.title.toUpperCase() ?? ""
                        }`}
                    </div>
                    <div className="ml-percent">
                      {mappedMemoryCount}
                      <small>/ {totalRegisteredMemories} MAPPED</small>
                    </div>
                  </div>
                  <div className="ml-bar">
                    <i
                      style={{
                        width: `${(mappedMemoryCount / totalRegisteredMemories) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="ml-skip">CLICK TO SKIP</div>
                </>
              ) : (
                <Timeline
                  memories={memoryList!}
                  erased={erasedKeysSet}
                  selected={selectedMemoryKey}
                  onChoose={selectMemoryItem}
                  onHover={setHoveredMemoryKey}
                />
              )}
            </footer>
          </>
        )}

        <div ref={calloutTagRef} className="ml-callout" aria-hidden>
          <svg width="160" height="60">
            <circle cx="0" cy="0" r="9" />
            <polyline points="0,0 34,-30 150,-30" />
          </svg>
          {activeCalloutMemory && (
            <div className="ml-tag">
              <b>{activeCalloutMemory.title}</b>
              <span>
                {CLASSIFICATION_TITLES[activeCalloutMemory.kind]} ·{" "}
                {formatEpochTimestamp(activeCalloutMemory.at)}
              </span>
            </div>
          )}
        </div>

        {isHelpGuideVisible && <LabHelp onClose={() => setIsHelpGuideVisible(false)} />}

        {pendingEraseItem && (
          <div className="ml-toast" role="status">
            <span>MEMORY ERASED</span>
            <button type="button" onClick={() => dispatchMemoryRestore(pendingEraseItem.key)}>
              RESTORE ({pendingEraseItem.left})
            </button>
          </div>
        )}

        {advisoryStatusNotice && !displayErrorMessage && (
          <div className="ml-notice" role="status">
            {advisoryStatusNotice}
          </div>
        )}

        {displayErrorMessage && (
          <div className="ml-error" role="alert">
            <span>{displayErrorMessage}</span>
            <button
              type="button"
              onClick={() => {
                setDisplayErrorMessage(null);
                reconnect();
              }}
            >
              RETRY
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryLab;
