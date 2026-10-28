import { useState } from 'react';
import type { AnatomyViewer } from '../engine/AnatomyViewer';

interface Props {
  viewer: AnatomyViewer | null;
}

export function ViewCubeGizmo({ viewer }: Props) {
  const [activeFace, setActiveFace] = useState<string | null>(null);

  const handleClick = (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'isometric', faceName: string) => {
    setActiveFace(faceName);
    viewer?.setViewOrientation(view);
  };

  return (
    <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center select-none" dir="ltr">
      <div className="relative w-20 h-20 perspective-[500px]">
        {/* Isometric 3D Cube container */}
        <div
          className="w-full h-full relative transition-transform duration-300"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-25deg) rotateY(-35deg)',
          }}
        >
          {/* Top Face */}
          <button
            onClick={() => handleClick('top', 'T')}
            className={`absolute inset-0 w-16 h-16 border border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-sky-600 hover:text-white text-xs font-bold flex items-center justify-center transition-colors shadow-md ${
              activeFace === 'T' ? 'bg-sky-500 text-white' : ''
            }`}
            style={{
              transform: 'rotateX(90deg) translateZ(32px)',
            }}
            title="نمای از بالا (Top View)"
          >
            T
          </button>

          {/* Front Face (C / Front) */}
          <button
            onClick={() => handleClick('front', 'C')}
            className={`absolute inset-0 w-16 h-16 border border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-sky-600 hover:text-white text-xs font-bold flex items-center justify-center transition-colors shadow-md ${
              activeFace === 'C' ? 'bg-sky-500 text-white' : ''
            }`}
            style={{
              transform: 'rotateY(0deg) translateZ(32px)',
            }}
            title="نمای قدامی / روبه‌رو (Front View)"
          >
            C
          </button>

          {/* Right Face (E / Elevation) */}
          <button
            onClick={() => handleClick('right', 'E')}
            className={`absolute inset-0 w-16 h-16 border border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-sky-600 hover:text-white text-xs font-bold flex items-center justify-center transition-colors shadow-md ${
              activeFace === 'E' ? 'bg-sky-500 text-white' : ''
            }`}
            style={{
              transform: 'rotateY(90deg) translateZ(32px)',
            }}
            title="نمای جانبی راست (Right Side)"
          >
            E
          </button>

          {/* Left Face */}
          <button
            onClick={() => handleClick('left', 'L')}
            className={`absolute inset-0 w-16 h-16 border border-slate-700 bg-slate-800/80 text-slate-400 hover:bg-sky-600 hover:text-white text-xs font-bold flex items-center justify-center transition-colors shadow-md ${
              activeFace === 'L' ? 'bg-sky-500 text-white' : ''
            }`}
            style={{
              transform: 'rotateY(-90deg) translateZ(32px)',
            }}
            title="نمای جانبی چپ (Left Side)"
          >
            L
          </button>

          {/* Back Face */}
          <button
            onClick={() => handleClick('back', 'B')}
            className={`absolute inset-0 w-16 h-16 border border-slate-700 bg-slate-800/80 text-slate-400 hover:bg-sky-600 hover:text-white text-xs font-bold flex items-center justify-center transition-colors shadow-md ${
              activeFace === 'B' ? 'bg-sky-500 text-white' : ''
            }`}
            style={{
              transform: 'rotateY(180deg) translateZ(32px)',
            }}
            title="نمای خلفی / پشت (Back View)"
          >
            B
          </button>
        </div>
      </div>

      {/* Quick Reset Button */}
      <button
        onClick={() => handleClick('isometric', 'ISO')}
        className="mt-2 text-[10px] text-slate-400 hover:text-sky-400 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800 backdrop-blur"
      >
        ریست ۳ بعدی (ISO)
      </button>
    </div>
  );
}
