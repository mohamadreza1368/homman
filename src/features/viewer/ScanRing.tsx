import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useScanStore } from "@/stores/scanStore";
import { SCAN_DROP, SCAN_ENTRY, SCAN_PULSE, SHARED_SCAN } from "./scanBand";
import type { SectionPlaneName } from "./axialSlice";
import { scanTint } from "./scanTints";

/**
 * HOOMAAN Tomographic Sweeping Ring & Luminescent Gantry.
 * Renders an instanced multi-emitter scanner armature, dynamic nameplate banner,
 * and order-independent additive light volumes that track the active slice level.
 */

const TOTAL_EMITTER_BLOCKS = 24;
const TURNS_PER_SEC = 0.04;
const INITIAL_APERTURE_SCALE = 0.34;
const PULSE_SCALE_EXPANSION = 0.35;
const PULSE_INTENSITY_BOOST = 1.8;
const BANNER_REPEATS = 5;

const BASE_DISC_ALPHA = 0.14;
const BASE_LENS_ALPHA = 0.1;
const EMITTER_INTENSITY_BASE = 2.2;
const CORE_WHITE_RATIO = 0.55;

function generateVertexFade(
  geometry: THREE.BufferGeometry,
  evaluator: (x: number, y: number, z: number) => number,
): THREE.BufferGeometry {
  const positions = geometry.getAttribute("position");
  const rgbArray = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const w = Math.max(
      0,
      Math.min(1, evaluator(positions.getX(i), positions.getY(i), positions.getZ(i))),
    );
    rgbArray[i * 3] = w;
    rgbArray[i * 3 + 1] = w;
    rgbArray[i * 3 + 2] = w;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(rgbArray, 3));
  return geometry;
}

export function nameplateText(byAssistant: boolean, plane: SectionPlaneName = "axial"): string {
  return ["HOOMAAN", byAssistant ? "AI" : null, plane === "front" ? "FRONT" : null]
    .filter(Boolean)
    .join(" ");
}

const FONT_SIZE_MAX_PX = 34;
const FONT_SIZE_MIN_PX = 18;

function createNameplateTexture(glowHex: string, textContent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxTextWidth = canvas.width - 24;
    for (let px = FONT_SIZE_MAX_PX; px >= FONT_SIZE_MIN_PX; px -= 2) {
      ctx.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;
      ctx.letterSpacing = `${Math.round(px * 0.3)}px`;
      if (ctx.measureText(textContent).width <= maxTextWidth) break;
    }

    ctx.shadowColor = glowHex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#d6fbff";
    ctx.fillText(textContent, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = BANNER_REPEATS;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function ScanRing({
  bounds,
  instrument,
}: {
  bounds: THREE.Box3 | null;
  instrument: boolean;
}) {
  const tint = scanTint(useScanStore((s) => s.tint));
  const byAssistant = useScanStore((s) => s.byAssistant);
  const plane = useScanStore((s) => s.plane);

  const mainColor = useMemo(() => new THREE.Color(tint.hex), [tint]);
  const coreEdgeColor = useMemo(
    () => new THREE.Color(tint.hex).lerp(new THREE.Color("#ffffff"), CORE_WHITE_RATIO),
    [tint],
  );

  const ringGroupRef = useRef<THREE.Group>(null);
  const emittersRef = useRef<THREE.InstancedMesh>(null);
  const discMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const lensMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const emitterMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bannerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const edgeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightVolumeGroupRef = useRef<THREE.Group>(null);
  const isAlphaTransitioning = useRef(false);

  const dimensions = useMemo(() => {
    if (!bounds || bounds.isEmpty()) return null;
    const sz = bounds.getSize(new THREE.Vector3());
    const ctr = bounds.getCenter(new THREE.Vector3());
    const outerRadius = Math.max(sz.x, sz.z) * 0.72;
    const tubeRadius = outerRadius * 0.035;

    return {
      x: ctr.x,
      z: ctr.z,
      radius: outerRadius,
      tube: tubeRadius,
      emitterRadius: outerRadius - tubeRadius * 2.6,
      lightRadius: outerRadius - tubeRadius * 4.4,
      emitter: tubeRadius * 0.9,
      drop: sz.y * SCAN_DROP,
      park: bounds.min.y + sz.y * 0.72,
    };
  }, [bounds]);

  const lightGeometries = useMemo(() => {
    if (!dimensions) return null;

    const disc = generateVertexFade(
      new THREE.RingGeometry(dimensions.lightRadius * 0.05, dimensions.lightRadius, 64, 8),
      (x, y) => Math.pow(Math.hypot(x, y) / dimensions.lightRadius, 2),
    );

    const skirt = generateVertexFade(
      new THREE.SphereGeometry(dimensions.lightRadius, 48, 24),
      (x, y, z) => {
        const rad = Math.hypot(x, y, z) || 1;
        return Math.pow(1 - Math.abs(y / rad), 2.6);
      },
    );

    return { disc, skirt };
  }, [dimensions]);

  const nameplateTex = useMemo(
    () => (instrument ? createNameplateTexture(tint.hex, nameplateText(byAssistant, plane)) : null),
    [instrument, tint, byAssistant, plane],
  );

  useEffect(() => {
    return () => {
      lightGeometries?.disc.dispose();
      lightGeometries?.skirt.dispose();
    };
  }, [lightGeometries]);

  useEffect(() => () => nameplateTex?.dispose(), [nameplateTex]);

  useLayoutEffect(() => {
    const instMesh = emittersRef.current;
    if (!instMesh || !dimensions) return;

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    const quat = new THREE.Quaternion();
    const unitScale = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < TOTAL_EMITTER_BLOCKS; i++) {
      const theta = (i / TOTAL_EMITTER_BLOCKS) * Math.PI * 2;
      pos.set(
        Math.cos(theta) * dimensions.emitterRadius,
        0,
        Math.sin(theta) * dimensions.emitterRadius,
      );
      rot.set(0, -theta, 0);
      m4.compose(pos, quat.setFromEuler(rot), unitScale);
      instMesh.setMatrixAt(i, m4);
    }
    instMesh.instanceMatrix.needsUpdate = true;
  }, [dimensions, instrument]);

  useFrame((state, delta) => {
    const g = ringGroupRef.current;
    if (!g || !dimensions) return;

    g.rotation.y += delta * Math.PI * 2 * TURNS_PER_SEC * SCAN_ENTRY.value;

    const scanTravel = Math.sin(SHARED_SCAN.value * 34);
    const ambientDrift = Math.sin(state.clock.elapsedTime * 1.7);
    const breathingFactor = 0.78 + 0.22 * (scanTravel * 0.6 + ambientDrift * 0.4);

    const entryPhase = SCAN_ENTRY.value;
    const isFrontal = plane === "front";
    g.position.y = (isFrontal ? dimensions.park : SHARED_SCAN.value) + (1 - entryPhase) * dimensions.drop;

    const currentAperture = 1 + INITIAL_APERTURE_SCALE * (1 - entryPhase);
    g.scale.x = currentAperture;
    g.scale.z = currentAperture;

    const pulseValue = SCAN_PULSE.value;
    if (lightVolumeGroupRef.current) {
      lightVolumeGroupRef.current.visible = !isFrontal;
      const spreadRatio = 1 + PULSE_SCALE_EXPANSION * pulseValue;
      lightVolumeGroupRef.current.scale.set(spreadRatio, 1, spreadRatio);
    }

    if (discMatRef.current) {
      discMatRef.current.opacity =
        BASE_DISC_ALPHA * breathingFactor * entryPhase * (1 + PULSE_INTENSITY_BOOST * pulseValue);
    }
    if (lensMatRef.current) {
      lensMatRef.current.opacity =
        BASE_LENS_ALPHA * breathingFactor * entryPhase * (1 + PULSE_INTENSITY_BOOST * pulseValue);
    }
    if (bannerMatRef.current) bannerMatRef.current.opacity = entryPhase;
    if (edgeMatRef.current) edgeMatRef.current.color.copy(coreEdgeColor).multiplyScalar(entryPhase);
    if (emitterMatRef.current) {
      emitterMatRef.current.emissiveIntensity =
        EMITTER_INTENSITY_BASE * (0.85 + 0.3 * breathingFactor) * entryPhase;
    }

    const isEntering = entryPhase < 1;
    const physicalMaterials = [frameMatRef.current, emitterMatRef.current];

    if (isEntering !== isAlphaTransitioning.current) {
      isAlphaTransitioning.current = isEntering;
      for (const m of physicalMaterials) {
        if (!m) continue;
        m.transparent = isEntering;
        m.opacity = isEntering ? entryPhase : 1;
        m.needsUpdate = true;
      }
    } else if (isEntering) {
      for (const m of physicalMaterials) {
        if (m) m.opacity = entryPhase;
      }
    }
  });

  if (!dimensions) return null;

  return (
    <group ref={ringGroupRef} name="scan-ring" position={[dimensions.x, 0, dimensions.z]}>
      {instrument && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[dimensions.radius, dimensions.tube, 10, 96]} />
            <meshStandardMaterial
              ref={frameMatRef}
              color="#102d32"
              roughness={0.28}
              metalness={0.8}
            />
          </mesh>

          <mesh>
            <cylinderGeometry
              args={[
                dimensions.radius + dimensions.tube * 1.02,
                dimensions.radius + dimensions.tube * 1.02,
                dimensions.tube * 1.6,
                96,
                1,
                true,
              ]}
            />
            <meshBasicMaterial
              ref={bannerMatRef}
              map={nameplateTex}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>

          <instancedMesh ref={emittersRef} args={[undefined, undefined, TOTAL_EMITTER_BLOCKS]}>
            <boxGeometry
              args={[dimensions.emitter * 0.55, dimensions.emitter * 0.7, dimensions.emitter * 2.2]}
            />
            <meshStandardMaterial
              color="#0b1c24"
              ref={emitterMatRef}
              emissive={tint.hex}
              emissiveIntensity={EMITTER_INTENSITY_BASE}
              roughness={0.25}
              metalness={0.4}
            />
          </instancedMesh>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[dimensions.lightRadius, dimensions.tube * 0.22, 6, 96]} />
            <meshBasicMaterial ref={edgeMatRef} color={coreEdgeColor} toneMapped={false} />
          </mesh>
        </>
      )}

      {lightGeometries && (
        <group ref={lightVolumeGroupRef}>
          <mesh geometry={lightGeometries.disc} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial
              ref={discMatRef}
              color={mainColor}
              vertexColors
              transparent
              opacity={BASE_DISC_ALPHA}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>

          <mesh geometry={lightGeometries.skirt} scale={[1, 0.42, 1]}>
            <meshBasicMaterial
              ref={lensMatRef}
              color={mainColor}
              vertexColors
              transparent
              opacity={BASE_LENS_ALPHA}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
