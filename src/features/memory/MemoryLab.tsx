import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Markdown } from "@/features/chat/Markdown";
import { stripOrganRefs } from "@/features/chat/organRefs";
import { loadManifest, meshUrl } from "@/lib/manifest";
import type { ManifestOrgan } from "@/lib/schemas";
import {
  getStudySession,
  listNotes,
  listStudySessions,
  type SessionDetail,
  type StudyNote,
} from "@/lib/studyDb";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";

import "./memoryLab.css";
import { EraseQueue, RESTORE_WINDOW_S } from "./eraseQueue";
import { createLabSound, storedLabSound, storeLabSound, type LabSound } from "./labSound";
import { calloutPlacement, freeMargins, studiedRowsFor, type Box } from "./layout";
import { byMonth, memoriesFrom, stepMemory, tally, type Memory, type MemoryKind } from "./memories";
import { createBodyHologram, type BodyHologram } from "./scene/bodyHologram";
import type { BrainStructure } from "./scene/brainLoader";
import { studiedIds, studiedOrgans, type StudiedOrgan } from "./studied";
import {
  createMemoryScene,
  type GraphicsStatus,
  type LabPhase,
  type MemoryScene,
} from "./scene/memoryScene";

const CLASSIFICATION_TITLES: Record<MemoryKind, string> = {
  session: "STUDY SESSION",
  case: "CASE VISIT",
  note: "NOTE",
};

type ViewportLayoutTier = "wide" | "medium" | "compact";

function computeLayoutTier(width: number, height: number): ViewportLayoutTier {
  if (width < 960 || height < 600) return "compact";
  if (width < 1320 || height < 780) return "medium";
  return "wide";
}

const EXCLUDE_SURFACE_FILTER = /^(Hairs of|Eyelashes|Pubic hairs)/;
const LOCAL_STORAGE_FOCUS_KEY = "hoomaan.memory.focus.v1";

function retrievePersistedFocus(): boolean {
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_FOCUS_KEY) === "on";
  } catch {
    return false;
  }
}

function persistFocusSetting(active: boolean): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FOCUS_KEY, active ? "on" : "off");
  } catch {
    // Gracefully ignore local storage restrictions
  }
}

const EXTENDED_LOAD_WARNING_DELAY_MS = 15000;
const CONTEXT_RESTORE_TIMEOUT_MS = 6000;
const ERASE_HOLD_DURATION_MS = 1400;

function evaluateGraphicsAdvisory(
  hasNoHardwareWebGL: boolean,
  gpuStatus: GraphicsStatus | null,
): string | null {
  if (hasNoHardwareWebGL) {
    return "THIS COMPUTER CANNOT DRAW THE HOLOGRAM · EVERY MEMORY IS STILL HERE TO READ";
  }
  if (!gpuStatus) return null;
  if (gpuStatus.lost) {
    return "THE GRAPHICS CARD RESET · RESTORING THE HOLOGRAM…";
  }
  if (gpuStatus.adapter === "software") {
    return "NO GRAPHICS ACCELERATION ON THIS COMPUTER · RUNNING LIGHT";
  }
  if (gpuStatus.eased) {
    return "EFFECTS EASED TO KEEP THE HOLOGRAM SMOOTH ON THIS COMPUTER";
  }
  return null;
}

type MemoryInspectionState =
  | { state: "loading" }
  | { state: "session"; detail: SessionDetail }
  | { state: "note"; note: StudyNote }
  | { state: "missing" };

const REUSABLE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatEpochTimestamp = (ms: number) => REUSABLE_TIMESTAMP_FORMATTER.format(ms);

function formatDiagnosticError(err: unknown): string {
  const messageStr = err instanceof Error ? err.message : String(err);
  if (/fetch|network|load/i.test(messageStr)) {
    return "The brain hologram could not be loaded. Your memories are safe — try again.";
  }
  return `The hologram stopped: ${messageStr}`;
}

export function MemoryLab({ onClose }: { onClose: () => void }) {
  const containerRootRef = useRef<HTMLDivElement>(null);
  const webglStageRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const avatarInstanceRef = useRef<BodyHologram | null>(null);
  const audioSynthRef = useRef<LabSound | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const leftPanelRef = useRef<HTMLElement>(null);
  const rightPanelRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const calloutTagRef = useRef<HTMLDivElement>(null);

  const sceneInstanceRef = useRef<MemoryScene | null>(null);
  const eraseBufferRef = useRef(new EraseQueue());

  const [memoryList, setMemoryList] = useState<Memory[] | null>(null);
  const [cachedNotesMap, setCachedNotesMap] = useState<Map<string, StudyNote>>(new Map());
  const [displayErrorMessage, setDisplayErrorMessage] = useState<string | null>(null);
  const [currentHoloPhase, setCurrentHoloPhase] = useState<LabPhase>("boot");
  const [mappedMemoryCount, setMappedMemoryCount] = useState(0);

  const [hoveredMemoryKey, setHoveredMemoryKey] = useState<string | null>(null);
  const [selectedMemoryKey, setSelectedMemoryKey] = useState<string | null>(null);
  const [activeInspection, setActiveInspection] = useState<MemoryInspectionState | null>(null);
  const [erasedKeysSet, setErasedKeysSet] = useState<Set<string>>(new Set());
  const [pendingEraseItem, setPendingEraseItem] = useState<{ key: string; left: number } | null>(null);

  const [isHoldingErase, setIsHoldingErase] = useState(false);
  const [currentTier, setCurrentTier] = useState<ViewportLayoutTier>(() =>
    computeLayoutTier(window.innerWidth, window.innerHeight),
  );
  const [isRailNavOpen, setIsRailNavOpen] = useState(false);
  const [isExpandedReader, setIsExpandedReader] = useState(false);
  const [isHelpGuideVisible, setIsHelpGuideVisible] = useState(false);

  const [isAudioEnabled, setIsAudioEnabled] = useState(storedLabSound);
  const [isFocusReaderActive, setIsFocusReaderActive] = useState(retrievePersistedFocus);
  const focusStateTracker = useRef(isFocusReaderActive);

  const [hardwareGraphicsStatus, setHardwareGraphicsStatus] = useState<GraphicsStatus | null>(null);
  const [isSoftwareOnlyFallback, setIsSoftwareOnlyFallback] = useState(false);
  const [isSlowInitialLoad, setIsSlowInitialLoad] = useState(false);
  const [anatomicalAtlas, setAnatomicalAtlas] = useState<readonly ManifestOrgan[]>([]);

  const [associatedOrganList, setAssociatedOrganList] = useState<StudiedOrgan[] | null>([]);
  const [pinnedOrganNode, setPinnedOrganNode] = useState<string | null>(null);
  const [hoveredOrganNode, setHoveredOrganNode] = useState<string | null>(null);
  const [isAllOrgansUnfolded, setIsAllOrgansUnfolded] = useState(false);
  const [isOrganCameraZoomed, setIsOrganCameraZoomed] = useState(false);
  const [visibleOrganRowCount, setVisibleOrganRowCount] = useState(4);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const memoryLookupMap = useMemo(
    () => new Map((memoryList ?? []).map((m) => [m.key, m])),
    [memoryList],
  );

  const availableLiveMemories = useMemo(
    () => (memoryList ?? []).filter((m) => !erasedKeysSet.has(m.key)),
    [memoryList, erasedKeysSet],
  );

  // Load clinical sessions and study notes
  useEffect(() => {
    let unmounted = false;
    Promise.all([listStudySessions(null, null, null, 1000), listNotes(null, null, 1000)])
      .then(([sessions, fetchedNotes]) => {
        if (unmounted) return;
        setCachedNotesMap(new Map(fetchedNotes.map((entry) => [String(entry.id), entry])));
        setMemoryList(memoriesFrom(sessions, fetchedNotes));
      })
      .catch((err: unknown) => {
        if (!unmounted) setDisplayErrorMessage(String(err));
      });

    return () => {
      unmounted = true;
    };
  }, []);

  // Initialize 3D scene and male anatomical avatar
  useEffect(() => {
    const stageDom = webglStageRef.current;
    if (!stageDom || !memoryList || memoryList.length === 0) return;

    let cancelled = false;
    const sceneStoreRef = useSceneStore.getState();
    const existingAtlas = sceneStoreRef.genderModel === "male" ? sceneStoreRef.manifest : null;

    (existingAtlas ? Promise.resolve(existingAtlas) : loadManifest("male"))
      .then((atlasManifest) => {
        if (cancelled) return;
        setAnatomicalAtlas(atlasManifest.organs);

        const brainNodes: BrainStructure[] = atlasManifest.organs
          .filter((organ) => organ.path?.includes("Brain") && organ.mesh_file === "nervous_male.glb")
          .map((organ) => ({
            node: organ.node,
            name: organ.name_en.replace(/\s*\((left|right)\)$/, ""),
            latin: organ.ta2_latin,
            region: organ.path![organ.path!.indexOf("Brain") + 1] ?? "Brain",
            side: /\(left\)$/.test(organ.name_en)
              ? "left"
              : /\(right\)$/.test(organ.name_en)
                ? "right"
                : "midline",
          }));

        try {
          sceneInstanceRef.current = createMemoryScene(stageDom, {
            meshUrl: meshUrl("nervous_male.glb"),
            structures: brainNodes,
            dracoPath: "/draco/",
            memories: memoryList.map(({ key, kind }) => ({ key, kind })),
            onGraphics: setHardwareGraphicsStatus,
            onHover: setHoveredMemoryKey,
            onSelect: setSelectedMemoryKey,
            onPhase: (nextStage, count) => {
              setCurrentHoloPhase(nextStage);
              setMappedMemoryCount(count);
            },
            onError: (reason) => setDisplayErrorMessage(formatDiagnosticError(reason)),
          });
          sceneInstanceRef.current.setFilm(!focusStateTracker.current);
        } catch {
          setIsSoftwareOnlyFallback(true);
          setIsRailNavOpen(true);
          return;
        }

        const avatarDom = avatarContainerRef.current;
        const mainFrame = containerRootRef.current;
        if (!avatarDom || !mainFrame || !sceneInstanceRef.current) return;

        const bodySurfaceStructures: BrainStructure[] = atlasManifest.organs
          .filter((organ) => organ.mesh_file === "regional_male.glb" && !EXCLUDE_SURFACE_FILTER.test(organ.name_en))
          .map((organ) => ({
            node: organ.node,
            name: organ.name_en,
            latin: organ.ta2_latin,
            region: "Body",
            side: "midline",
          }));

        avatarInstanceRef.current = createBodyHologram(avatarDom, {
          meshUrl: meshUrl("regional_male.glb"),
          structures: bodySurfaceStructures,
          dracoPath: "/draco/",
          host: sceneInstanceRef.current,
          frame: mainFrame,
          fileUrl: meshUrl,
          onError: () => {
            avatarInstanceRef.current?.dispose();
            avatarInstanceRef.current = null;
          },
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setDisplayErrorMessage(formatDiagnosticError(err));
      });

    return () => {
      cancelled = true;
      sceneInstanceRef.current?.dispose();
      sceneInstanceRef.current = null;
      avatarInstanceRef.current?.dispose();
      avatarInstanceRef.current = null;
    };
  }, [memoryList, reconnectAttempts]);

  useEffect(() => {
    focusStateTracker.current = isFocusReaderActive;
    persistFocusSetting(isFocusReaderActive);
    sceneInstanceRef.current?.setFilm(!isFocusReaderActive);
  }, [isFocusReaderActive]);

  // Loading timer & hardware fault resilience
  useEffect(() => {
    setIsSlowInitialLoad(false);
    if (!memoryList || memoryList.length === 0 || currentHoloPhase !== "boot" || isSoftwareOnlyFallback) {
      return;
    }
    const timer = window.setTimeout(() => setIsSlowInitialLoad(true), EXTENDED_LOAD_WARNING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [memoryList, currentHoloPhase, isSoftwareOnlyFallback, reconnectAttempts]);

  useEffect(() => {
    if (!hardwareGraphicsStatus?.lost) return;
    const timer = window.setTimeout(() => {
      setDisplayErrorMessage(
        "The graphics card reset and the hologram did not come back. Your memories are safe — try again.",
      );
    }, CONTEXT_RESTORE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [hardwareGraphicsStatus?.lost]);

  // Sound effects integration
  useEffect(() => {
    audioSynthRef.current = createLabSound(storedLabSound());
    return () => {
      audioSynthRef.current?.close();
      audioSynthRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioSynthRef.current?.setEnabled(isAudioEnabled);
    storeLabSound(isAudioEnabled);
  }, [isAudioEnabled]);

  useEffect(() => {
    audioSynthRef.current?.phase(currentHoloPhase);
  }, [currentHoloPhase]);

  useEffect(() => {
    if (currentHoloPhase === "mapping" && mappedMemoryCount > 0) {
      audioSynthRef.current?.mapped(mappedMemoryCount - 1, memoryList?.length ?? 1);
    }
  }, [currentHoloPhase, mappedMemoryCount, memoryList]);

  useEffect(() => {
    const memoryKind = hoveredMemoryKey
      ? memoryList?.find((m) => m.key === hoveredMemoryKey)?.kind
      : undefined;
    if (memoryKind) {
      audioSynthRef.current?.hover(memoryKind);
    }
  }, [hoveredMemoryKey, memoryList]);

  useEffect(() => {
    const memoryKind = selectedMemoryKey
      ? memoryList?.find((m) => m.key === selectedMemoryKey)?.kind
      : undefined;
    audioSynthRef.current?.select(memoryKind ?? null);
  }, [selectedMemoryKey, memoryList]);

  // Resolve organs discussed in current memory inspection
  useEffect(() => {
    const recognizedIdSet = new Set(anatomicalAtlas.map((item) => item.organ_id));
    const extractedOrgans =
      activeInspection?.state === "session"
        ? studiedIds(
            activeInspection.detail.structures,
            activeInspection.detail.messages
              .filter((msg) => msg.role === "assistant")
              .map((msg) => msg.content),
            (id) => recognizedIdSet.has(id),
          )
        : activeInspection?.state === "note"
          ? studiedIds(
              activeInspection.note.organ_id ? [activeInspection.note.organ_id] : [],
              [activeInspection.note.body],
              (id) => recognizedIdSet.has(id),
            )
          : [];

    const resolvedOrganProfiles = studiedOrgans(extractedOrgans, anatomicalAtlas);
    const figureAvatar = avatarInstanceRef.current;

    if (!figureAvatar || resolvedOrganProfiles.length === 0) {
      void figureAvatar?.show([]);
      setAssociatedOrganList([]);
      return;
    }

    let isOutdated = false;
    setAssociatedOrganList(null);

    void figureAvatar.show(resolvedOrganProfiles).then((verifiedMeshIds) => {
      if (isOutdated) return;
      const verifiedSet = new Set(verifiedMeshIds);
      setAssociatedOrganList(resolvedOrganProfiles.filter((item) => verifiedSet.has(item.id)));
    });

    return () => {
      isOutdated = true;
    };
  }, [activeInspection, anatomicalAtlas]);

  useEffect(() => {
    setPinnedOrganNode(null);
    setHoveredOrganNode(null);
    setIsAllOrgansUnfolded(false);
    setIsOrganCameraZoomed(false);
  }, [associatedOrganList]);

  useEffect(() => {
    avatarInstanceRef.current?.zoom(isOrganCameraZoomed, pinnedOrganNode);
  }, [isOrganCameraZoomed, pinnedOrganNode]);

  const activeHighlightedOrgan = hoveredOrganNode ?? pinnedOrganNode;
  useEffect(() => {
    avatarInstanceRef.current?.pick(activeHighlightedOrgan);
  }, [activeHighlightedOrgan]);

  const handleOrganHover = useCallback((id: string | null) => {
    setHoveredOrganNode(id);
    if (id) {
      audioSynthRef.current?.hover("case");
    }
  }, []);

  useEffect(() => {
    avatarInstanceRef.current?.setPresence(isRailNavOpen ? 0.15 : 1);
  }, [isRailNavOpen]);

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
  }, [selectedMemoryKey, isRailNavOpen, isExpandedReader, currentTier, currentHoloPhase, memoryList]);

  // Erase queue flush and execution
  const executeJournalDeletions = useCallback(async (keysToPurge: string[]) => {
    const store = useStudyStore.getState();
    for (const key of keysToPurge) {
      const [type, strId] = key.split(":") as [string, string];
      const isSuccessful =
        type === "note" ? await store.removeNote(Number(strId)) : await store.removeSession(strId);
      if (!isSuccessful) {
        setDisplayErrorMessage("A memory could not be erased. It is still in your journal.");
      }
    }
  }, []);

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

  const dispatchMemoryErase = useCallback((key: string) => {
    eraseBufferRef.current.erase(key, Date.now());
    sceneInstanceRef.current?.erase(key);
    audioSynthRef.current?.erase();
    setErasedKeysSet((prev) => new Set(prev).add(key));
    setPendingEraseItem({ key, left: RESTORE_WINDOW_S });
    setSelectedMemoryKey(null);
    sceneInstanceRef.current?.select(null);
  }, []);

  const dispatchMemoryRestore = useCallback((key: string) => {
    if (!eraseBufferRef.current.restore(key)) return;
    sceneInstanceRef.current?.restore(key);
    audioSynthRef.current?.restore();
    setErasedKeysSet((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setPendingEraseItem(null);
  }, []);

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

  const selectMemoryItem = useCallback((key: string | null) => {
    setSelectedMemoryKey(key);
    sceneInstanceRef.current?.select(key);
    if (key === null) {
      setIsExpandedReader(false);
    }
    if (key !== null && activeTierTracker.current === "compact") {
      setIsRailNavOpen(false);
    }
  }, []);

  const toggleExpandedReader = useCallback(() => setIsExpandedReader((exp) => !exp), []);

  const onHoldBegin = useCallback(() => {
    setIsHoldingErase(true);
    audioSynthRef.current?.holdStart();
  }, []);

  const onHoldCancel = useCallback(() => {
    setIsHoldingErase(false);
    audioSynthRef.current?.holdEnd();
  }, []);

  const onHoldCompleted = useCallback(
    (key: string) => {
      setIsHoldingErase(false);
      audioSynthRef.current?.holdEnd();
      dispatchMemoryErase(key);
    },
    [dispatchMemoryErase],
  );

  // Floating memory pointer callout alignment
  const activeFocusKey = isExpandedReader ? null : (hoveredMemoryKey ?? selectedMemoryKey);

  useEffect(() => {
    let animId = 0;
    const alignCallout = () => {
      animId = requestAnimationFrame(alignCallout);
      const calloutEl = calloutTagRef.current;
      if (!calloutEl) return;

      const screenPos = activeFocusKey ? sceneInstanceRef.current?.screenPosition(activeFocusKey) : null;
      if (!screenPos) {
        calloutEl.style.opacity = "0";
        return;
      }

      calloutEl.style.opacity = "1";
      calloutEl.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;

      const tagContainer = calloutEl.querySelector<HTMLElement>(".ml-tag");
      const hostFrame = containerRootRef.current?.getBoundingClientRect();
      if (!tagContainer || !hostFrame) return;

      const getLateralPanelBounds = (panel: HTMLElement | null): DOMRect | null => {
        if (!panel || panel.offsetParent === null) return null;
        if (panel.classList.contains("ml-hidden") || panel.classList.contains("ml-wide")) return null;
        const rect = panel.getBoundingClientRect();
        return rect.width < hostFrame.width * 0.55 ? rect : null;
      };

      let minLeftBound = 0;
      for (const p of [avatarContainerRef.current, leftPanelRef.current]) {
        const bounds = getLateralPanelBounds(p);
        if (bounds) {
          minLeftBound = Math.max(minLeftBound, bounds.right - hostFrame.left);
        }
      }

      const readerBounds = getLateralPanelBounds(rightPanelRef.current);
      const maxRightBound = readerBounds ? readerBounds.left - hostFrame.left : hostFrame.width;
      const naturalTagWidth =
        Math.max(...[...tagContainer.children].map((child) => child.scrollWidth)) + 32;

      const placement = calloutPlacement(screenPos.x, naturalTagWidth, minLeftBound, maxRightBound);
      calloutEl.classList.toggle("ml-flip", placement.side === "left");
      tagContainer.style.maxWidth = `${placement.maxWidth}px`;
    };

    animId = requestAnimationFrame(alignCallout);
    return () => cancelAnimationFrame(animId);
  }, [activeFocusKey]);

  // Global hotkeys
  const activeKeysList = useMemo(
    () => availableLiveMemories.map((m) => m.key),
    [availableLiveMemories],
  );

  useEffect(() => {
    const handleGlobalKeyDown = (evt: KeyboardEvent) => {
      if (evt.ctrlKey || evt.altKey || evt.metaKey) return;

      if (isHelpGuideVisible) {
        if (evt.key === "Escape" || evt.key === "?") {
          setIsHelpGuideVisible(false);
        }
        return;
      }

      if (evt.key === "?") {
        setIsHelpGuideVisible(true);
        return;
      }

      const targetTag = (evt.target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [contenteditable='true']",
      );

      if (
        (evt.key === "ArrowLeft" || evt.key === "ArrowRight") &&
        !targetTag &&
        currentHoloPhase === "live" &&
        !evt.repeat
      ) {
        const nextKey = stepMemory(activeKeysList, selectedMemoryKey, evt.key === "ArrowLeft" ? -1 : 1);
        if (nextKey && nextKey !== selectedMemoryKey) {
          selectMemoryItem(nextKey);
        }
        evt.preventDefault();
        return;
      }

      if (
        evt.key === "Enter" &&
        selectedMemoryKey &&
        !targetTag &&
        !(evt.target as HTMLElement | null)?.closest?.("button, a")
      ) {
        setIsExpandedReader((w) => !w);
        evt.preventDefault();
        return;
      }

      if (evt.key === "Escape") {
        if (isExpandedReader) {
          setIsExpandedReader(false);
        } else if (selectedMemoryKey) {
          selectMemoryItem(null);
        } else if (isRailNavOpen) {
          setIsRailNavOpen(false);
        } else {
          handleLabDismissal();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
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
        {inspectedMemoryRecord && associatedOrganList !== null && associatedOrganList.length > 0 && (
          <div className="ml-studied" aria-live="polite">
            <span>STUDIED IN THIS MEMORY</span>
            <div className={`ml-studied-list ${isAllOrgansUnfolded ? "ml-all" : ""}`}>
              {(isAllOrgansUnfolded
                ? associatedOrganList
                : associatedOrganList.slice(0, visibleOrganRowCount)
              ).map((organ) => (
                <button
                  type="button"
                  key={organ.id}
                  className={organ.id === activeHighlightedOrgan ? "ml-on" : ""}
                  aria-pressed={organ.id === pinnedOrganNode}
                  title={
                    organ.id === pinnedOrganNode
                      ? "Show them all again"
                      : "Show it alone in the figure"
                  }
                  onPointerEnter={() => handleOrganHover(organ.id)}
                  onPointerLeave={() => setHoveredOrganNode(null)}
                  onFocus={() => handleOrganHover(organ.id)}
                  onBlur={() => setHoveredOrganNode(null)}
                  onClick={() =>
                    setPinnedOrganNode((prev) => (prev === organ.id ? null : organ.id))
                  }
                >
                  {organ.name}
                </button>
              ))}
            </div>

            <div className="ml-studied-tools">
              {associatedOrganList.length > visibleOrganRowCount && (
                <button
                  type="button"
                  className="ml-tool"
                  aria-expanded={isAllOrgansUnfolded}
                  onClick={() => setIsAllOrgansUnfolded((all) => !all)}
                >
                  {isAllOrgansUnfolded
                    ? "SHOW FEWER"
                    : `+${associatedOrganList.length - visibleOrganRowCount} MORE`}
                </button>
              )}
              <button
                type="button"
                className="ml-tool"
                aria-pressed={isOrganCameraZoomed}
                title={
                  isOrganCameraZoomed
                    ? "Back to the whole figure"
                    : pinnedOrganNode
                      ? "Move in on the chosen structure"
                      : "Move in on what was studied — click a name first to go to that one"
                }
                onClick={() => {
                  if (!isOrganCameraZoomed) {
                    setIsAllOrgansUnfolded(false);
                  }
                  setIsOrganCameraZoomed(!isOrganCameraZoomed);
                }}
              >
                {isOrganCameraZoomed ? "⊖ WHOLE BODY" : "⊕ ZOOM IN"}
              </button>
            </div>
          </div>
        )}

        {inspectedMemoryRecord && associatedOrganList === null && (
          <div className="ml-studied">
            <span>LOCATING…</span>
          </div>
        )}
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
            onClick={() => setIsFocusReaderActive((active) => !active)}
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
            onClick={() => setIsAudioEnabled((enabled) => !enabled)}
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
                setReconnectAttempts((prev) => prev + 1);
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

const CONTROL_GUIDE_CATALOG: readonly {
  title: string;
  items: readonly (readonly [string, string])[];
}[] = [
  {
    title: "THE BRAIN",
    items: [
      [
        "Point at a light",
        "Every light is a memory: cyan a study session, amber a case visit, violet a note. Pointing names it.",
      ],
      ["Click a light", "Opens that memory in the reader on the right."],
      ["Drag", "Turns the brain."],
      [
        "The strip at the bottom",
        "Every memory in the order you made it. Point or click, the same as on the brain.",
      ],
    ],
  },
  {
    title: "THE KEYS",
    items: [
      ["← →", "The previous or next memory, in the order you made them."],
      ["Enter", "Reads the open memory large, or back at the side."],
      [
        "Esc",
        "Steps back one thing at a time — the large reader, the memory, the index — and then leaves.",
      ],
      ["?", "Opens and closes this guide."],
    ],
  },
  {
    title: "THE READER",
    items: [
      ["⤢ / ⤡", "Reads the memory large, or back at the side."],
      ["Close", "Puts the memory away."],
      [
        "Hold to erase",
        "Hold until the bar fills. The memory dissolves and Restore brings it back for eight seconds; after that it is deleted from your journal for good.",
      ],
    ],
  },
  {
    title: "THE FIGURE",
    items: [
      ["Amber inside the body", "The structures the open memory was about, named underneath."],
      [
        "Point at a name",
        "Shows that structure alone, the others dimmed. Click it to keep it so; click again to see them all.",
      ],
      [
        "+ More / Show fewer",
        "Unfolds the rest of the list when there are more than the screen has room for.",
      ],
      [
        "⊕ Zoom in / ⊖ Whole body",
        "Moves in on the chosen structure — or on all of them — and holds the figure still; drag to turn it. Whole body steps back.",
      ],
      ["Drag", "Turns the figure."],
    ],
  },
  {
    title: "AT THE TOP",
    items: [
      ["Memory index", "The counts, the months and your most recent memories."],
      ["Focus", "Clears the film texture and sharpens the text for reading; the hologram keeps moving."],
      ["Sound", "Turns the tones that answer what you do on or off."],
      ["Exit", "Back to the atlas."],
    ],
  },
];

const LabHelp = memo(function LabHelp({ onClose }: { onClose: () => void }) {
  return (
    <section className="ml-panel ml-help" role="dialog" aria-label="How this screen works">
      <h3>
        HOW THIS SCREEN WORKS
        <button
          type="button"
          className="ml-expand"
          onClick={onClose}
          aria-label="Close the guide"
          title="Close (Esc)"
        >
          ✕
        </button>
      </h3>
      <div className="ml-help-body">
        {CONTROL_GUIDE_CATALOG.map((section) => (
          <div key={section.title} className="ml-help-group">
            <h4>{section.title}</h4>
            <dl>
              {section.items.map(([shortcut, description]) => (
                <div key={shortcut}>
                  <dt>{shortcut}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="ml-help-foot">
          Everything here is read from this computer; nothing is sent anywhere.
        </p>
      </div>
    </section>
  );
});

const MemoryIndex = memo(function MemoryIndex({
  live,
  selected,
  onChoose,
}: {
  live: Memory[];
  selected: string | null;
  onChoose: (key: string | null) => void;
}) {
  const kindTally = useMemo(() => tally(live), [live]);
  const monthDist = useMemo(() => byMonth(live), [live]);
  const maxBucketCount = Math.max(1, ...monthDist.map((m) => m.count));
  const recentHistory = useMemo(() => [...live].reverse().slice(0, 12), [live]);

  return (
    <>
      <h3>
        MEMORY INDEX <span>{String(live.length).padStart(3, "0")}</span>
      </h3>
      {(["session", "case", "note"] as const).map((kind) => (
        <div key={kind} className="ml-count">
          <i className={`ml-dot ml-${kind}`} />
          <span>{CLASSIFICATION_TITLES[kind]}S</span>
          <b>{kindTally[kind]}</b>
        </div>
      ))}
      <h3 className="ml-gap">BY MONTH</h3>
      <div className="ml-months">
        {monthDist.map((m) => (
          <div key={m.month} className="ml-month" title={`${m.month}: ${m.count}`}>
            <i style={{ height: `${(m.count / maxBucketCount) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="ml-months-scale">
        <span>{monthDist[0]?.month}</span>
        <span>{monthDist[monthDist.length - 1]?.month}</span>
      </div>
      <h3 className="ml-gap">RECENT</h3>
      <ol className="ml-recent">
        {recentHistory.map((m) => (
          <li key={m.key}>
            <button
              type="button"
              onClick={() => onChoose(m.key)}
              className={m.key === selected ? "ml-on" : ""}
            >
              <i className={`ml-dot ml-${m.kind}`} />
              <em>{m.title}</em>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
});

const MemoryReader = memo(function MemoryReader({
  memory,
  reading,
  wide,
  holding,
  onToggleWide,
  onClose,
  onHoldStart,
  onHoldEnd,
  onHoldDone,
}: {
  memory: Memory;
  reading: MemoryInspectionState | null;
  wide: boolean;
  holding: boolean;
  onToggleWide: () => void;
  onClose: (key: null) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldDone: (key: string) => void;
}) {
  return (
    <>
      <h3>
        {CLASSIFICATION_TITLES[memory.kind]} <span>{formatEpochTimestamp(memory.at)}</span>
        <button
          type="button"
          className="ml-expand"
          onClick={onToggleWide}
          title={wide ? "Back to the side" : "Read it large"}
          aria-pressed={wide}
        >
          {wide ? "⤡" : "⤢"}
        </button>
      </h3>
      <div className="ml-reading-title">{memory.title}</div>
      <div className="ml-reading">
        {reading?.state === "loading" && <p className="ml-faint">RECALLING…</p>}
        {reading?.state === "missing" && (
          <p className="ml-faint">This memory is no longer in the journal.</p>
        )}
        {reading?.state === "note" && <p className="ml-note">{stripOrganRefs(reading.note.body)}</p>}
        {reading?.state === "session" && (
          <>
            {reading.detail.session.score !== null && (
              <p className="ml-score">
                SCORE {reading.detail.session.score}
                {reading.detail.session.verdict ? ` · ${reading.detail.session.verdict}` : ""}
              </p>
            )}
            {reading.detail.messages.map((msg, idx) => (
              <div key={idx} className={`ml-message ml-${msg.role}`}>
                <span>{msg.role === "user" ? "YOU" : "ASSISTANT"}</span>
                {msg.role === "assistant" ? (
                  <Markdown structurePins={false}>{stripOrganRefs(msg.content)}</Markdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="ml-actions">
        <button type="button" className="ml-close-reading" onClick={() => onClose(null)}>
          CLOSE
        </button>
        <button
          type="button"
          className={`ml-erase ${holding ? "ml-holding" : ""}`}
          style={{ ["--ml-hold" as string]: `${ERASE_HOLD_DURATION_MS}ms` }}
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerLeave={onHoldEnd}
          onAnimationEnd={() => onHoldDone(memory.key)}
          title="Hold to erase this memory from your journal"
        >
          <i />
          HOLD TO ERASE
        </button>
      </div>
    </>
  );
});

const Timeline = memo(function Timeline({
  memories,
  erased,
  selected,
  onChoose,
  onHover,
}: {
  memories: Memory[];
  erased: Set<string>;
  selected: string | null;
  onChoose: (key: string | null) => void;
  onHover: (key: string | null) => void;
}) {
  const extractKeyFromEvent = (evtTarget: EventTarget | null) => {
    const tickKey = (evtTarget as HTMLElement | null)?.closest<HTMLElement>(".ml-tick")?.dataset.key;
    return tickKey && !erased.has(tickKey) ? tickKey : null;
  };

  return (
    <div
      className="ml-timeline"
      aria-label="Memories in the order they were made"
      onClick={(e) => {
        const foundKey = extractKeyFromEvent(e.target);
        if (foundKey) onChoose(foundKey);
      }}
      onMouseOver={(e) => onHover(extractKeyFromEvent(e.target))}
      onMouseLeave={() => onHover(null)}
    >
      {memories.map((entry) => (
        <button
          type="button"
          key={entry.key}
          data-key={entry.key}
          className={`ml-tick ml-${entry.kind} ${erased.has(entry.key) ? "ml-gone" : ""} ${
            entry.key === selected ? "ml-on" : ""
          }`}
          aria-label={`${entry.title}, ${formatEpochTimestamp(entry.at)}`}
        />
      ))}
    </div>
  );
});

export default MemoryLab;
