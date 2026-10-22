import React from 'react';
import { Layers, Activity } from 'lucide-react';

interface NavbarProps {
  gender: 'male' | 'female';
  setGender: (g: 'male' | 'female') => void;
  stage: 1 | 2;
  setStage: (s: 1 | 2) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ gender, setGender, stage, setStage }) => {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Title & Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-lg">
          H
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            پلتفرم هوشمند آناتومی و پاتوفیزیولوژی
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">
              v1.0-alpha
            </span>
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono">
            FMA v4.6 • SNOMED CT • OMOP CDM • Three.js WebXR
          </p>
        </div>
      </div>

      {/* Stage Selector */}
      <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
        <button
          onClick={() => setStage(1)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            stage === 1
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          مرحله اول: اطلس آناتومی
        </button>
        <button
          onClick={() => setStage(2)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            stage === 2
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          مرحله دوم: شبیه‌ساز بیماری‌ها
        </button>
      </div>

      {/* Gender & Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border text-xs">
          <button
            onClick={() => setGender('male')}
            className={`px-2.5 py-1 rounded transition-colors ${
              gender === 'male' ? 'bg-primary/30 text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            کالبد مرد (BodyParts3D)
          </button>
          <button
            onClick={() => setGender('female')}
            className={`px-2.5 py-1 rounded transition-colors ${
              gender === 'female' ? 'bg-primary/30 text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            کالبد زن (HuBMAP)
          </button>
        </div>
      </div>
    </header>
  );
};
