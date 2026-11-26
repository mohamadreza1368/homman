import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useHeartStore } from "@/stores/heartStore";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import {
  CONDUCTION_NODES,
  CONDUCTION_PATHS,
  PRECORDIAL_ELECTRODES,
  calculateNodeExcitation,
  type PrecordialElectrode,
} from "./conductionSystem";

export interface CardiacConductionLayerProps {
  centres: Map<string, THREE.Vector3>;
}

const DEFAULT_CARDIAC_CENTER = new THREE.Vector3(0.02, 1.28, 0.04);
const DEFAULT_CHEST_CENTER = new THREE.Vector3(0.0, 1.28, 0.12);

export function CardiacConductionLayer({ centres }: CardiacConductionLayerProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const conductionVisible = useSceneStore((s) => s.conductionSystemVisible);
  const ecgLeadsVisible = useSceneStore((s) => s.ecgLeadsVisible);
  const isHeartBeating = useHeartStore((s) => s.enabled);

  const [hoveredLead, setHoveredLead] = useState<PrecordialElectrode | null>(null);

  // Compute reference cardiac anchor
  const cardiacCenter = useMemo(() => {
    const ra = centres.get("right_atrium");
    const la = centres.get("left_atrium");
    if (ra && la) {
      return ra.clone().lerp(la, 0.5);
    }
    return ra?.clone() ?? DEFAULT_CARDIAC_CENTER.clone();
  }, [centres]);

  // Compute reference sternal/chest wall anchor
  const chestCenter = useMemo(() => {
    const sternum = centres.get("body_of_sternum") ?? centres.get("manubrium_of_sternum");
    if (sternum) {
      return sternum.clone();
    }
    return DEFAULT_CHEST_CENTER.clone();
  }, [centres]);

  // Real-time animation refs for conduction nodes
  const nodeMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pathMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    if (!conductionVisible) return;
    const elapsed = clock.getElapsedTime();
    // Default cycle duration is 0.833s (72 bpm)
    const cycleDuration = 0.833;
    const phase = isHeartBeating ? (elapsed % cycleDuration) / cycleDuration : 0.04;

    CONDUCTION_NODES.forEach((node, idx) => {
      const mesh = nodeMeshRefs.current[idx];
      if (!mesh) return;
      const excitation = calculateNodeExcitation(node, phase);
      const scale = 1.0 + excitation * 0.7;
      mesh.scale.set(scale, scale, scale);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.4 + excitation * 2.8;
      }
    });

    CONDUCTION_PATHS.forEach((_, idx) => {
      const mat = pathMatRefs.current[idx];
      if (!mat) return;
      // Pulse glow along path
      const pathPhase = Math.sin(elapsed * 5.0 + idx * 0.8) * 0.5 + 0.5;
      mat.emissiveIntensity = 0.3 + pathPhase * 1.5;
    });
  });

  if (!conductionVisible && !ecgLeadsVisible) {
    return null;
  }

  return (
    <group name="cardiac-electrophysiology-layer">
      {/* 1. Cardiac Conduction Nodes & Fibers */}
      {conductionVisible && (
        <group name="conduction-system">
          {/* Conduction Nodes */}
          {CONDUCTION_NODES.map((node, idx) => {
            const pos: [number, number, number] = [
              cardiacCenter.x + node.relativeOffset[0],
              cardiacCenter.y + node.relativeOffset[1],
              cardiacCenter.z + node.relativeOffset[2],
            ];
            const isSA = node.id === "sa_node";
            const isAV = node.id === "av_node";
            const radius = isSA || isAV ? 0.007 : 0.005;

            return (
              <group key={node.id} position={pos}>
                <mesh
                  ref={(el) => {
                    nodeMeshRefs.current[idx] = el;
                  }}
                >
                  <sphereGeometry args={[radius, 16, 16]} />
                  <meshStandardMaterial
                    color={isSA ? "#f59e0b" : isAV ? "#fbbf24" : "#38bdf8"}
                    emissive={isSA ? "#d97706" : isAV ? "#f59e0b" : "#0284c7"}
                    emissiveIntensity={0.6}
                    roughness={0.2}
                    metalness={0.3}
                  />
                </mesh>
                <Html distanceFactor={1.2} position={[0, radius + 0.006, 0]} center>
                  <div className="pointer-events-none select-none rounded bg-slate-950/85 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 ring-1 ring-amber-500/40 shadow">
                    {node.id === "sa_node"
                      ? "SA Node"
                      : node.id === "av_node"
                      ? "AV Node"
                      : node.id === "bundle_of_his"
                      ? "His"
                      : node.id === "right_bundle_branch"
                      ? "RBB"
                      : node.id === "left_bundle_branch"
                      ? "LBB"
                      : "Purkinje"}
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Conduction Tracts / Tubes */}
          {CONDUCTION_PATHS.map((path, idx) => {
            const worldPoints = path.points.map(
              (p) =>
                new THREE.Vector3(
                  cardiacCenter.x + p[0],
                  cardiacCenter.y + p[1],
                  cardiacCenter.z + p[2]
                )
            );
            const curve = new THREE.CatmullRomCurve3(worldPoints);
            const tubeGeom = new THREE.TubeGeometry(curve, 16, 0.0018, 8, false);

            return (
              <mesh key={path.id} geometry={tubeGeom}>
                <meshStandardMaterial
                  ref={(el) => {
                    pathMatRefs.current[idx] = el;
                  }}
                  color="#38bdf8"
                  emissive="#0284c7"
                  emissiveIntensity={0.5}
                  roughness={0.3}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 2. 12-Lead Precordial Electrodes (V1 - V6) */}
      {ecgLeadsVisible && (
        <group name="precordial-electrodes">
          {PRECORDIAL_ELECTRODES.map((lead) => {
            const pos: [number, number, number] = [
              chestCenter.x + lead.relativePosition[0],
              chestCenter.y + lead.relativePosition[1],
              chestCenter.z + lead.relativePosition[2],
            ];

            return (
              <group
                key={lead.lead}
                position={pos}
                onPointerOver={() => setHoveredLead(lead)}
                onPointerOut={() => setHoveredLead(null)}
              >
                {/* Electrode Target Outer Ring */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.008, 0.012, 24]} />
                  <meshBasicMaterial
                    color={lead.standardColorHex}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.9}
                  />
                </mesh>

                {/* Electrode Center Contact Disc */}
                <mesh>
                  <sphereGeometry args={[0.006, 16, 16]} />
                  <meshStandardMaterial
                    color={lead.standardColorHex}
                    emissive={lead.standardColorHex}
                    emissiveIntensity={0.6}
                    metalness={0.6}
                    roughness={0.2}
                  />
                </mesh>

                {/* Electrode Badge Pill */}
                <Html distanceFactor={1.3} position={[0, 0.018, 0]} center>
                  <div
                    style={{ borderColor: lead.standardColorHex }}
                    className="cursor-pointer select-none rounded-full bg-slate-950/90 px-2 py-0.5 text-[10px] font-mono font-bold text-white shadow-lg border-2 transition-transform hover:scale-110"
                    title={fa ? lead.anatomicalLandmarkFa : lead.anatomicalLandmarkEn}
                  >
                    {lead.lead}
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Hovered Lead Clinical Tooltip */}
          {hoveredLead && (
            <Html
              position={[
                chestCenter.x + hoveredLead.relativePosition[0],
                chestCenter.y + hoveredLead.relativePosition[1] + 0.05,
                chestCenter.z + hoveredLead.relativePosition[2],
              ]}
              center
            >
              <div
                dir={fa ? "rtl" : "ltr"}
                className="pointer-events-none w-56 rounded-xl border border-sky-500/50 bg-slate-950/95 p-2.5 text-xs text-white shadow-2xl backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-slate-750 pb-1">
                  <span className="font-bold text-amber-300">
                    {fa ? hoveredLead.nameFa : hoveredLead.nameEn}
                  </span>
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-white"
                    style={{ backgroundColor: hoveredLead.standardColorHex }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-300 leading-4">
                  <span className="font-semibold text-sky-300">
                    {fa ? "محل آناتومیک: " : "Landmark: "}
                  </span>
                  {fa ? hoveredLead.anatomicalLandmarkFa : hoveredLead.anatomicalLandmarkEn}
                </p>
                <p className="mt-1 text-[10px] text-slate-400 leading-4">
                  {fa ? hoveredLead.clinicalSignificanceFa : hoveredLead.clinicalSignificanceEn}
                </p>
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
}
