import { Html } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

import {
  landmarksForOrgan,
  type SurfaceLandmark,
} from "@/features/anatomy/surfaceLandmarksCatalog";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

export interface SurfaceLandmarksLayerProps {
  boxes: Map<string, THREE.Box3>;
  revision: number;
}

export function SurfaceLandmarksLayer({ boxes, revision }: SurfaceLandmarksLayerProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const [activeLandmark, setActiveLandmark] = useState<SurfaceLandmark | null>(null);

  const pins = useMemo(() => {
    const targetId = selectedOrganIds.at(-1);
    if (!targetId) return [];
    const landmarks = landmarksForOrgan(targetId);
    if (landmarks.length === 0) return [];
    const box = boxes.get(targetId);
    if (!box || box.isEmpty()) return [];

    return landmarks.map((lm) => {
      const [nx, ny, nz] = lm.normalizedBoxPos;
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(box.min.x, box.max.x, nx),
        THREE.MathUtils.lerp(box.min.y, box.max.y, ny),
        THREE.MathUtils.lerp(box.min.z, box.max.z, nz),
      );
      return { landmark: lm, position: pos };
    });
  }, [selectedOrganIds, boxes, revision]);

  if (pins.length === 0) return null;

  return (
    <group name="ta2-surface-landmarks-layer">
      {pins.map(({ landmark, position }) => {
        const isActive = activeLandmark?.id === landmark.id;
        return (
          <group key={landmark.id} position={position}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setActiveLandmark(isActive ? null : landmark);
              }}
            >
              <sphereGeometry args={[0.0055, 14, 14]} />
              <meshStandardMaterial
                color={isActive ? "#fbbf24" : "#38bdf8"}
                emissive={isActive ? "#f59e0b" : "#0284c7"}
                emissiveIntensity={isActive ? 1.2 : 0.7}
              />
            </mesh>

            <Html distanceFactor={1.1} position={[0, 0.012, 0]} center zIndexRange={[50, 20]}>
              <button
                type="button"
                dir={fa ? "rtl" : "ltr"}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveLandmark(isActive ? null : landmark);
                }}
                className={`cursor-pointer select-none whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold shadow-lg border transition-all ${
                  isActive
                    ? "bg-amber-950/95 border-amber-400 text-amber-200 scale-105"
                    : "bg-slate-950/85 border-sky-500/60 text-sky-200 hover:bg-slate-900"
                }`}
              >
                {fa ? landmark.nameFa : landmark.nameEn}
              </button>
            </Html>

            {isActive && (
              <Html zIndexRange={[100, 50]} position={[0, 0.04, 0]} center>
                <div
                  dir={fa ? "rtl" : "ltr"}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto w-64 rounded-xl border border-amber-400/60 bg-slate-950/95 p-3 text-xs text-white shadow-2xl backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between border-b border-slate-800 pb-1.5">
                    <div>
                      <h4 className="font-bold text-amber-300">
                        {fa ? landmark.nameFa : landmark.nameEn}
                      </h4>
                      <p dir="ltr" className="text-[10px] font-mono text-slate-400">
                        {landmark.ta2Id} · {landmark.ta2Latin}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveLandmark(null)}
                      className="rounded p-1 text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-300">
                    {fa ? landmark.clinicalNoteFa : landmark.clinicalNoteEn}
                  </p>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
