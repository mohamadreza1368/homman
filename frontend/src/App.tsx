import { useEffect, useRef, useState } from 'react';
import { AnatomyHeader } from './components/AnatomyHeader';
import { AnatomyExplorerPanel } from './components/AnatomyExplorerPanel';
import { StructureDetailsCard } from './components/StructureDetailsCard';
import { CalloutLeaderLines } from './components/CalloutLeaderLines';
import { ViewCubeGizmo } from './components/ViewCubeGizmo';
import { CrossSectionPanel } from './components/CrossSectionPanel';
import { PhysiologyPanel } from './components/PhysiologyPanel';
import { PathologyDrawer } from './components/PathologyDrawer';
import { AnatomyViewer, type AnatomicalCallout } from './engine/AnatomyViewer';
import type { AnatomicalStructure } from './types/anatomy';

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<AnatomyViewer | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<AnatomicalStructure | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPercent, setLoadingPercent] = useState<number>(0);

  // Floating Panel Visibility States
  const [showExplorerPanel, setShowExplorerPanel] = useState(true);
  const [showCrossSection, setShowCrossSection] = useState(false);
  const [showPhysiology, setShowPhysiology] = useState(false);
  const [showPathologyDrawer, setShowPathologyDrawer] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const newViewer = new AnatomyViewer({
      container: containerRef.current,
      onStructureSelect: (structure) => {
        setSelectedStructure(structure);
      },
      onLoadingProgress: (percent) => {
        setLoadingPercent(percent);
      }
    });

    setViewer(newViewer);

    return () => {
      newViewer.dispose();
    };
  }, []);

  // Handle clicking callout label lines
  const handleSelectCallout = (callout: AnatomicalCallout) => {
    if (!viewer) return;

    viewer.focusOnStructure(callout.id);

    // Map callout to anatomical structure for details card
    const struct: AnatomicalStructure = {
      fmaId: callout.id,
      snomedBodyStructureId: 'SNOMED_' + callout.id,
      nameEn: callout.labelEn,
      nameFa: callout.labelFa,
      systemCategory: callout.system as AnatomicalStructure['systemCategory'],
      genderModel: 'male',
      meshNodeName: callout.id,
      descriptionEn: `${callout.labelEn} is an essential anatomical landmark in the human ${callout.system} system.`,
      descriptionFa: `عضو تشریحی ${callout.labelFa} متعلق به سیستم ${callout.system} انسان.`
    };

    setSelectedStructure(struct);
  };

  // Search filter
  useEffect(() => {
    if (!viewer || !searchQuery.trim()) return;
    viewer.focusOnStructure(searchQuery.trim());
  }, [searchQuery, viewer]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 select-none font-sans text-slate-100">
      {/* 1. Header Bar matching target design */}
      <AnatomyHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showCrossSection={showCrossSection}
        setShowCrossSection={setShowCrossSection}
        showPhysiology={showPhysiology}
        setShowPhysiology={setShowPhysiology}
        onToggleSidebar={() => setShowExplorerPanel(!showExplorerPanel)}
      />

      {/* 2. Main 3D Interactive Viewport */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* Canvas container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* 3. Streaming Progress Indicator */}
        {loadingPercent > 0 && loadingPercent < 100 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur border border-sky-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-2.5 shadow-xl text-xs text-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>بارگذاری اطلس ۲,۲۳۴ قطعه‌ای: {loadingPercent}%</span>
          </div>
        )}

        {/* 4. 3D Interactive Callout Leader Lines */}
        <CalloutLeaderLines
          viewer={viewer}
          onSelectCallout={handleSelectCallout}
        />

        {/* 5. Left Floating Anatomy Explorer Panel */}
        {showExplorerPanel && (
          <AnatomyExplorerPanel
            viewer={viewer}
            onClose={() => setShowExplorerPanel(false)}
          />
        )}

        {/* 6. Top Right Structure Details Card */}
        <StructureDetailsCard
          structure={selectedStructure}
          onClose={() => {
            setSelectedStructure(null);
            viewer?.resetSelection();
          }}
          onIsolate={(fmaId) => viewer?.isolateStructure(fmaId)}
          onOpenPathology={() => setShowPathologyDrawer(true)}
          onOpenPhysiology={() => setShowPhysiology(true)}
          onReset={() => viewer?.resetSelection()}
        />

        {/* 7. Bottom Right 3D ViewCube Gizmo */}
        <ViewCubeGizmo viewer={viewer} />

        {/* 8. Cross Section Floating Panel */}
        {showCrossSection && (
          <CrossSectionPanel
            viewer={viewer}
            onClose={() => setShowCrossSection(false)}
          />
        )}

        {/* 9. Physiology Floating Panel */}
        {showPhysiology && (
          <PhysiologyPanel viewer={viewer} />
        )}

        {/* 10. Pathology Knowledge Graph Drawer */}
        {showPathologyDrawer && (
          <PathologyDrawer
            structure={selectedStructure}
            onClose={() => setShowPathologyDrawer(false)}
            stage={2}
            onIsolate={(fmaId) => viewer?.isolateStructure(fmaId)}
            onClearIsolate={() => viewer?.clearIsolation()}
          />
        )}
      </main>
    </div>
  );
}

export default App;
