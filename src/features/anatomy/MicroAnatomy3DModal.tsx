import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useState } from "react";
import * as THREE from "three";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

export type MicroSceneKind = "nephron" | "hepatic_lobule" | "alveolus" | "dental";

export interface MicroAnatomy3DModalProps {
  initialScene?: MicroSceneKind;
  onClose: () => void;
}

function Nephron3DScene({ fa }: { fa: boolean }) {
  const pctCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.7, 0.45, 0),
        new THREE.Vector3(-0.35, 0.62, 0.12),
        new THREE.Vector3(-0.1, 0.35, -0.1),
        new THREE.Vector3(0.05, 0.55, 0.08),
        new THREE.Vector3(0.15, 0.15, 0),
        // Loop of Henle descending & ascending
        new THREE.Vector3(0.15, -0.85, 0),
        new THREE.Vector3(0.32, -0.95, 0),
        new THREE.Vector3(0.45, -0.85, 0),
        new THREE.Vector3(0.45, 0.25, 0),
        // DCT
        new THREE.Vector3(0.65, 0.5, 0.1),
        new THREE.Vector3(0.85, 0.35, -0.05),
        new THREE.Vector3(1.05, 0.4, 0),
      ]),
    [],
  );

  const collectingDuctCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.05, 0.65, 0),
        new THREE.Vector3(1.05, 0.0, 0),
        new THREE.Vector3(1.05, -1.0, 0),
      ]),
    [],
  );

  return (
    <group>
      {/* Bowman's Capsule (translucent outer cup) */}
      <mesh position={[-0.85, 0.45, 0]}>
        <sphereGeometry args={[0.24, 24, 24, 0, Math.PI * 1.65]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.45} side={THREE.DoubleSide} roughness={0.3} />
      </mesh>
      {/* Glomerular Capillary Tuft */}
      <mesh position={[-0.85, 0.45, 0]}>
        <torusKnotGeometry args={[0.11, 0.03, 64, 12, 2, 3]} />
        <meshStandardMaterial color="#e11d48" roughness={0.35} />
      </mesh>
      {/* Afferent & Efferent Arterioles */}
      <mesh position={[-1.18, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, 0.45, 12]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <mesh position={[-1.15, 0.36, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.42, 12]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Nephron Tubule (PCT -> Loop of Henle -> DCT) */}
      <mesh>
        <tubeGeometry args={[pctCurve, 96, 0.045, 12, false]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      </mesh>

      {/* Collecting Duct */}
      <mesh>
        <tubeGeometry args={[collectingDuctCurve, 32, 0.07, 14, false]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.35} />
      </mesh>

      <Html position={[-0.85, 0.78, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-rose-300 border border-rose-500/40 whitespace-nowrap">
          {fa ? "گلومرول و کپسول بومن" : "Glomerulus & Bowman"}
        </span>
      </Html>
      <Html position={[0.3, -1.08, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-amber-300 border border-amber-500/40 whitespace-nowrap">
          {fa ? "قوس هنله (Loop of Henle)" : "Loop of Henle"}
        </span>
      </Html>
      <Html position={[1.05, 0.78, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-sky-300 border border-sky-500/40 whitespace-nowrap">
          {fa ? "مجرای جمع‌کننده" : "Collecting Duct"}
        </span>
      </Html>
    </group>
  );
}

function HepaticLobule3DScene({ fa }: { fa: boolean }) {
  const corners = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      arr.push([Math.cos(a) * 0.9, Math.sin(a) * 0.9]);
    }
    return arr;
  }, []);

  return (
    <group rotation={[0.4, 0.3, 0]}>
      {/* Hexagonal Hepatocyte Parenchyma */}
      <mesh>
        <cylinderGeometry args={[0.92, 0.92, 0.45, 6]} />
        <meshStandardMaterial color="#854d0e" transparent opacity={0.55} roughness={0.5} />
      </mesh>
      {/* Central Vein */}
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.65, 16]} />
        <meshStandardMaterial color="#2563eb" roughness={0.35} />
      </mesh>
      {/* 6 Portal Triads at Corners */}
      {corners.map(([x, z], idx) => (
        <group key={idx} position={[x, 0, z]}>
          <mesh position={[0.04, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.62, 10]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          <mesh position={[-0.04, 0, 0.03]}>
            <cylinderGeometry args={[0.025, 0.025, 0.62, 10]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          <mesh position={[-0.02, 0, -0.04]}>
            <cylinderGeometry args={[0.022, 0.022, 0.62, 10]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
        </group>
      ))}
      <Html position={[0, 0.48, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-sky-300 border border-sky-500/40 whitespace-nowrap">
          {fa ? "ورید مرکزی (Zone 3)" : "Central Vein (Zone 3)"}
        </span>
      </Html>
      <Html position={[0.95, 0.38, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
          {fa ? "تریاد پورتال (ورید پورت، شریان، مجرای صفرا)" : "Portal Triad (Zone 1)"}
        </span>
      </Html>
    </group>
  );
}

function Alveolus3DScene({ fa }: { fa: boolean }) {
  const sacs: [number, number, number, number][] = [
    [0, -0.1, 0, 0.28],
    [0.32, -0.22, 0.15, 0.24],
    [-0.32, -0.22, 0.12, 0.25],
    [0.18, -0.35, -0.22, 0.26],
    [-0.2, -0.35, -0.2, 0.24],
    [0, -0.45, 0.12, 0.27],
  ];

  return (
    <group>
      {/* Terminal Bronchiole */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.7, 18]} />
        <meshStandardMaterial color="#e2b4bd" roughness={0.4} />
      </mesh>
      {/* Alveolar Sacs */}
      {sacs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 20, 20]} />
          <meshStandardMaterial color="#fda4af" transparent opacity={0.82} roughness={0.35} />
        </mesh>
      ))}
      {/* Capillary Gas Exchange Mesh */}
      <mesh position={[0, -0.28, 0]}>
        <torusKnotGeometry args={[0.38, 0.022, 72, 10, 3, 4]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} />
      </mesh>
      <Html position={[0, 0.92, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-pink-200 border border-pink-500/40 whitespace-nowrap">
          {fa ? "برونشیول تنفسی" : "Respiratory Bronchiole"}
        </span>
      </Html>
      <Html position={[0, -0.82, 0]} center>
        <span className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-rose-300 border border-rose-500/40 whitespace-nowrap">
          {fa ? "کیسه‌های آلوئولی و شبکهٔ مویرگی" : "Alveolar Sacs & Capillary Bed"}
        </span>
      </Html>
    </group>
  );
}

function Dental3DScene() {
  const core = useGLTF("/anatomy/dental/core.glb", "/draco/") as unknown as { scene: THREE.Group };
  const nv = useGLTF("/anatomy/dental/neurovascular.glb", "/draco/") as unknown as { scene: THREE.Group };
  return (
    <group scale={0.015} position={[0, -0.3, 0]}>
      <primitive object={core.scene} />
      <primitive object={nv.scene} />
    </group>
  );
}

export function MicroAnatomy3DModal({
  initialScene = "nephron",
  onClose,
}: MicroAnatomy3DModalProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [scene, setScene] = useState<MicroSceneKind>(initialScene);

  const tabs: { id: MicroSceneKind; labelFa: string; labelEn: string }[] = [
    { id: "nephron", labelFa: "نفرون کلیه", labelEn: "Renal Nephron" },
    { id: "hepatic_lobule", labelFa: "لوبول کبد", labelEn: "Hepatic Lobule" },
    { id: "alveolus", labelFa: "آلوئول ریه", labelEn: "Lung Alveolus" },
    { id: "dental", labelFa: "دندان و عصب فک (BodyVista)", labelEn: "Dental Micro-View" },
  ];

  return (
    <div
      dir={fa ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
    >
      <div className="flex h-[560px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-cyan-300">
              {fa ? "نمایشگر سه‌بعدی میکروآناتومی و بافت‌شناسی" : "3D Micro-Anatomy & Histology Sub-Viewer"}
            </h2>
            <p className="text-[11px] text-slate-400">
              {fa ? "با کشیدن ماوس بچرخانید و اسکرول کنید" : "Drag to orbit, scroll to zoom"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {fa ? "بستن ✕" : "Close ✕"}
          </button>
        </div>

        <div className="flex gap-1.5 border-b border-slate-800 bg-slate-950/60 px-4 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setScene(t.id)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                scene === t.id
                  ? "bg-cyan-600 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {fa ? t.labelFa : t.labelEn}
            </button>
          ))}
        </div>

        <div className="relative flex-1 bg-[#060b12]">
          <Canvas camera={{ position: [0, 0.2, 2.7], fov: 42 }}>
            <ambientLight intensity={0.75} />
            <directionalLight position={[3, 4, 5]} intensity={1.2} />
            <directionalLight position={[-3, -2, -4]} intensity={0.4} />
            <Suspense fallback={null}>
              {scene === "nephron" && <Nephron3DScene fa={fa} />}
              {scene === "hepatic_lobule" && <HepaticLobule3DScene fa={fa} />}
              {scene === "alveolus" && <Alveolus3DScene fa={fa} />}
              {scene === "dental" && <Dental3DScene />}
            </Suspense>
            <OrbitControls enableDamping />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
