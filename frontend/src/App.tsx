import { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertOctagon } from 'lucide-react';
import { AnatomyHeader } from './components/AnatomyHeader';
import { AnatomyExplorerPanel } from './components/AnatomyExplorerPanel';
import { StructureDetailsCard } from './components/StructureDetailsCard';
import { CalloutLeaderLines } from './components/CalloutLeaderLines';
import { ViewCubeGizmo } from './components/ViewCubeGizmo';
import { CameraNavigationWidget } from './components/CameraNavigationWidget';
import { CrossSectionPanel } from './components/CrossSectionPanel';
import { PhysiologyPanel } from './components/PhysiologyPanel';
import { PathologyDrawer } from './components/PathologyDrawer';
import { MedicalDisclaimerModal } from './components/MedicalDisclaimerModal';
import { AnatomyViewer, type AnatomicalCallout } from './engine/AnatomyViewer';
import {
  buildStructureFromRecord,
  resolveCatalogRecord,
} from './data/anatomyRegistry';
import {
  loadDisclaimerAcceptance,
  saveDisclaimerAcceptance,
} from './data/disclaimerState';
import type { AnatomicalStructure, AnatomyRecord } from './types/anatomy';

function detectDefaultLiteMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  const lowMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return isSmallScreen || (typeof lowMem === 'number' && lowMem <= 4);
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<AnatomyViewer | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<AnatomicalStructure | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPercent, setLoadingPercent] = useState<number>(0);
  const [loadingBytesInfo, setLoadingBytesInfo] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [liteMode, setLiteMode] = useState<boolean>(() => detectDefaultLiteMode());

  // Mandatory Disclaimer & Help Gate
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(
    () => loadDisclaimerAcceptance() !== null
  );
  const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(
    () => loadDisclaimerAcceptance() === null
  );

  // Floating Panel Visibility States
  const [showExplorerPanel, setShowExplorerPanel] = useState(true);
  const [showCrossSection, setShowCrossSection] = useState(false);
  const [showPhysiology, setShowPhysiology] = useState(false);
  const [showPathologyDrawer, setShowPathologyDrawer] = useState(false);
  const [showCallouts, setShowCallouts] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const newViewer = new AnatomyViewer({
      container: containerRef.current,
      initialLiteMode: liteMode,
      onStructureSelect: (structure) => {
        setSelectedStructure(structure);
        if (!structure) {
          setShowPathologyDrawer(false);
        }
      },
      onLoadingProgress: (percent, loaded = 0, total = 0) => {
        setLoadingPercent(percent);
        setLoadingBytesInfo({ loaded, total });
      },
      onLoadingError: (messageFa) => {
        setLoadingError(messageFa);
      },
    });

    (window as unknown as { __viewer: AnatomyViewer }).__viewer = newViewer;
    setViewer(newViewer);

    return () => {
      newViewer.dispose();
    };
  }, []);

  const handleToggleLiteMode = () => {
    const next = !liteMode;
    setLiteMode(next);
    viewer?.setLiteMode(next);
  };

  const handleAcceptDisclaimer = () => {
    saveDisclaimerAcceptance();
    setDisclaimerAccepted(true);
    setShowDisclaimerModal(false);
  };

  const handleSelectCatalogRecord = (record: AnatomyRecord) => {
    if (!viewer) return;
    viewer.focusOnStructure(record.id);
    setSelectedStructure(buildStructureFromRecord(record));
  };

  const handleSelectCallout = (callout: AnatomicalCallout) => {
    if (!viewer) return;
    const record = resolveCatalogRecord(callout.id);
    if (record) {
      handleSelectCatalogRecord(record);
    } else {
      viewer.focusOnStructure(callout.query);
    }
  };

  const loadedMb = (loadingBytesInfo.loaded / (1024 * 1024)).toFixed(1);
  const totalMb = (loadingBytesInfo.total / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 select-none font-sans text-slate-100">
      {/* Mandatory Medical Educational Disclaimer Modal */}
      <MedicalDisclaimerModal
        isOpen={showDisclaimerModal}
        requiresAcceptance={!disclaimerAccepted}
        onAccept={handleAcceptDisclaimer}
        onClose={() => setShowDisclaimerModal(false)}
      />

      {/* Header Bar */}
      <AnatomyHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectSearchRecord={handleSelectCatalogRecord}
        showCrossSection={showCrossSection}
        setShowCrossSection={setShowCrossSection}
        showPhysiology={showPhysiology}
        setShowPhysiology={setShowPhysiology}
        liteMode={liteMode}
        onToggleLiteMode={handleToggleLiteMode}
        onOpenDisclaimer={() => setShowDisclaimerModal(true)}
        onToggleSidebar={() => setShowExplorerPanel(!showExplorerPanel)}
      />

      {/* Main 3D Interactive Viewport */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        <div
          ref={containerRef}
          data-testid="viewport-canvas-container"
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Real Byte-Level Loading Progress Indicator */}
        {!loadingError && loadingPercent >= 0 && loadingPercent < 100 && (
          <div
            data-testid="loading-progress-banner"
            dir="rtl"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur border border-sky-500/40 px-4 py-1.5 rounded-full flex items-center gap-2.5 shadow-xl text-xs text-sky-300"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>
              در حال دریافت مدل تشریحی: {loadingPercent}%
              {loadingBytesInfo.total > 0 ? ` (${loadedMb} از ${totalMb} مگابایت)` : ''}
            </span>
          </div>
        )}

        {/* Network / Model Error Banner with Retry */}
        {loadingError && (
          <div
            data-testid="loading-error-banner"
            dir="rtl"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-rose-950/95 border border-rose-500/50 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-2xl text-xs text-rose-100 max-w-lg"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{loadingError}</span>
            <button
              onClick={() => viewer?.retryLoad()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold shrink-0 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>تلاش مجدد</span>
            </button>
          </div>
        )}

        {/* 3D Interactive Callout Leader Lines */}
        <CalloutLeaderLines
          viewer={viewer}
          showCallouts={showCallouts}
          onSelectCallout={handleSelectCallout}
        />

        {/* Left Floating Anatomy Explorer Panel */}
        {showExplorerPanel && (
          <AnatomyExplorerPanel
            viewer={viewer}
            onClose={() => setShowExplorerPanel(false)}
          />
        )}

        {/* Top Right Structure Details Card */}
        <StructureDetailsCard
          structure={selectedStructure}
          onClose={() => {
            setSelectedStructure(null);
            setShowPathologyDrawer(false);
            viewer?.resetSelection();
          }}
          onIsolate={(recordId) => viewer?.isolateStructure(recordId)}
          onOpenPathology={() => setShowPathologyDrawer(true)}
          onOpenPhysiology={() => setShowPhysiology(true)}
          onReset={() => {
            setSelectedStructure(null);
            setShowPathologyDrawer(false);
            viewer?.resetSelection();
          }}
        />

        {/* Bottom Right 3D ViewCube Gizmo */}
        <ViewCubeGizmo viewer={viewer} />

        {/* Bottom Left Camera Navigation & Label Control Widget */}
        <CameraNavigationWidget
          viewer={viewer}
          showCallouts={showCallouts}
          onToggleCallouts={() => setShowCallouts(!showCallouts)}
        />

        {/* Cross Section Floating Panel */}
        {showCrossSection && (
          <CrossSectionPanel
            viewer={viewer}
            onClose={() => setShowCrossSection(false)}
          />
        )}

        {/* Educational Physiology Floating Panel */}
        {showPhysiology && (
          <PhysiologyPanel
            viewer={viewer}
            onClose={() => setShowPhysiology(false)}
          />
        )}

        {/* Controlled Educational Concepts / Pathology Drawer */}
        {showPathologyDrawer && (
          <PathologyDrawer
            structure={selectedStructure}
            onClose={() => setShowPathologyDrawer(false)}
            onIsolate={(recordId) => viewer?.isolateStructure(recordId)}
            onClearIsolate={() => viewer?.clearIsolation()}
            onApplyPreset={(recordId, presetType) =>
              viewer?.applyEducationalPreset(recordId, presetType)
            }
            onClearPreset={() => viewer?.clearEducationalPreset()}
          />
        )}
      </main>
    </div>
  );
}

export default App;
