import { Html } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import {
  CLINICAL_PROCEDURES_CATALOG,
  type ClinicalProcedure,
} from "@/features/anatomy/clinicalProceduresCatalog";

export interface ClinicalProceduresOverlayProps {
  centres: Map<string, THREE.Vector3>;
}

export function ClinicalProceduresOverlay({ centres }: ClinicalProceduresOverlayProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const visible = useSceneStore((s) => s.clinicalProceduresVisible);
  const [selectedProcedure, setSelectedProcedure] = useState<ClinicalProcedure | null>(null);
  const [hoveredProcedure, setHoveredProcedure] = useState<ClinicalProcedure | null>(null);

  // Compute reference body anchor (spine or sternum)
  const baseAnchor = useMemo(() => {
    const sternum = centres.get("body_of_sternum") ?? centres.get("manubrium_of_sternum");
    if (sternum) return sternum.clone();
    return new THREE.Vector3(0.0, 1.28, 0.0);
  }, [centres]);

  if (!visible) return null;

  const activeProcedure = selectedProcedure ?? hoveredProcedure;

  return (
    <group name="clinical-procedures-hud-layer">
      {CLINICAL_PROCEDURES_CATALOG.map((proc) => {
        const isSelected = selectedProcedure?.id === proc.id;
        const isHovered = hoveredProcedure?.id === proc.id;
        const pos: [number, number, number] = [
          baseAnchor.x + proc.relativeTargetPosition[0],
          proc.relativeTargetPosition[1], // Absolute Y in anatomical model
          baseAnchor.z + proc.relativeTargetPosition[2],
        ];

        return (
          <group
            key={proc.id}
            position={pos}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProcedure(isSelected ? null : proc);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredProcedure(proc);
            }}
            onPointerOut={() => setHoveredProcedure(null)}
          >
            {/* Outer Target Reticle Ring */}
            <mesh>
              <ringGeometry args={[proc.ringRadius * 0.8, proc.ringRadius, 32]} />
              <meshBasicMaterial
                color={proc.colorHex}
                side={THREE.DoubleSide}
                transparent
                opacity={isSelected || isHovered ? 0.95 : 0.6}
              />
            </mesh>

            {/* Inner Center Bullseye Disc */}
            <mesh>
              <circleGeometry args={[proc.ringRadius * 0.35, 16]} />
              <meshBasicMaterial
                color={proc.colorHex}
                side={THREE.DoubleSide}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Needle Insertion Vector Guide */}
            <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0012, 0.0012, 0.035, 8]} />
              <meshStandardMaterial
                color={proc.colorHex}
                emissive={proc.colorHex}
                emissiveIntensity={0.6}
              />
            </mesh>

            {/* 3D Label Marker */}
            <Html distanceFactor={1.3} position={[0, proc.ringRadius + 0.015, 0]} center zIndexRange={[40, 10]}>
              <button
                type="button"
                dir="ltr"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProcedure(isSelected ? null : proc);
                }}
                onMouseEnter={() => setHoveredProcedure(proc)}
                onMouseLeave={() => setHoveredProcedure(null)}
                style={{ borderColor: proc.colorHex }}
                className={`cursor-pointer select-none whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-xl border backdrop-blur-md transition-all ${
                  isSelected || isHovered
                    ? "bg-slate-900/95 scale-110 ring-2 ring-white/60"
                    : "bg-slate-950/85 hover:bg-slate-900"
                }`}
              >
                {proc.shortLabelEn}
              </button>
            </Html>
          </group>
        );
      })}

      {/* Floating Detailed Clinical Procedure Card HUD */}
      {activeProcedure && (
        <Html
          zIndexRange={[100, 50]}
          position={[
            baseAnchor.x + activeProcedure.relativeTargetPosition[0],
            activeProcedure.relativeTargetPosition[1] + 0.08,
            baseAnchor.z + activeProcedure.relativeTargetPosition[2] + 0.03,
          ]}
          center
        >
          <div
            dir={fa ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-80 rounded-2xl border-2 bg-slate-950/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-xl"
            style={{ borderColor: activeProcedure.colorHex }}
          >
            <div className="flex items-center justify-between border-b border-slate-750 pb-2">
              <div>
                <h3 className="font-bold text-sm text-white">
                  {fa ? activeProcedure.nameFa : activeProcedure.nameEn}
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {activeProcedure.category.toUpperCase()}
                </span>
              </div>
              {selectedProcedure && (
                <button
                  type="button"
                  onClick={() => setSelectedProcedure(null)}
                  className="rounded p-1 text-slate-400 hover:text-white"
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto scrollbar-thin text-slate-200">
              {/* Landmark */}
              <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800">
                <span className="font-bold text-sky-300">
                  {fa ? "نشانه آناتومیک (Landmark): " : "Anatomical Landmark: "}
                </span>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-300">
                  {fa ? activeProcedure.anatomicalLandmarkFa : activeProcedure.anatomicalLandmarkEn}
                </p>
              </div>

              {/* Trajectory */}
              <div className="rounded-lg bg-emerald-950/30 p-2 border border-emerald-600/30">
                <span className="font-bold text-emerald-300">
                  {fa ? "مسیر و زاویه ورود سوزن (Trajectory): " : "Needle Trajectory: "}
                </span>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-200">
                  {fa ? activeProcedure.needleTrajectoryFa : activeProcedure.needleTrajectoryEn}
                </p>
              </div>

              {/* Danger Structure */}
              <div className="rounded-lg bg-rose-950/30 p-2 border border-rose-600/30">
                <span className="font-bold text-rose-300">
                  {fa ? "ساختار خطرساز ممنوعه (Danger Zone): " : "Danger Structure: "}
                </span>
                <p className="mt-0.5 text-[11px] leading-4 text-rose-200/90">
                  {fa ? activeProcedure.dangerStructureFa : activeProcedure.dangerStructureEn}
                </p>
              </div>

              {/* Tissue Layers */}
              <div>
                <span className="font-bold text-amber-300 text-[11px]">
                  {fa ? "لایه‌های بافتی عبوری (Tissue Depths):" : "Tissue Depths:"}
                </span>
                <ol className="mt-1 space-y-0.5 text-[10px] text-slate-300">
                  {activeProcedure.tissueLayers.map((layer, idx) => (
                    <li key={idx} className="rounded bg-slate-900/60 px-2 py-0.5">
                      {fa ? layer.fa : layer.en}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Clinical Indication */}
              <div className="text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  {fa ? "اندیکاسیون‌ها: " : "Indications: "}
                </span>
                {fa ? activeProcedure.clinicalIndicationFa : activeProcedure.clinicalIndicationEn}
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
