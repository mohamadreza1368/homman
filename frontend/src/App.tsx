import { useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { PathologyDrawer } from './components/PathologyDrawer';
import { AnatomyViewer } from './engine/AnatomyViewer';
import type { AnatomicalStructure } from './types/anatomy';

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<AnatomyViewer | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [stage, setStage] = useState<1 | 2>(1);
  const [selectedStructure, setSelectedStructure] = useState<AnatomicalStructure | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    const newViewer = new AnatomyViewer({
      container: containerRef.current,
      onStructureSelect: (structure) => {
        setSelectedStructure(structure);
      },
    });

    setViewer(newViewer);

    return () => {
      newViewer.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background select-none font-sans" dir="rtl">
      {/* Top Navigation */}
      <Navbar gender={gender} setGender={setGender} stage={stage} setStage={setStage} />

      {/* Main Workspace */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Right Sidebar (in RTL, it docks to the right) */}
        <Sidebar viewer={viewer} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {/* Center 3D Viewport Container */}
        <main className="flex-1 relative h-full">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Quick HUD overlay in viewport */}
          <div className="absolute top-4 right-4 bg-card/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground flex items-center gap-3">
            <span>چرخش: درگ چپ</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>حرکت (Pan): درگ راست</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>بزرگ‌نمایی: اسکرول</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-primary font-medium">کلیک: انتخاب عضو و آنالیز بالینی</span>
          </div>

          {/* Selected Structure Drawer (Stage 1 & 2 Details) */}
          <PathologyDrawer
            structure={selectedStructure}
            onClose={() => {
              setSelectedStructure(null);
              if (viewer) viewer.resetSelection();
            }}
            stage={stage}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
