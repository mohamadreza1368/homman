import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useSceneStore } from "@/stores/sceneStore";
import { backgroundTheme } from "./background";
import {
  STUDIO_AMBIENT,
  STUDIO_FILL,
  STUDIO_KEY,
  STUDIO_RIM,
  studioLightDirections,
  LIGHTING_PRESETS,
} from "./lighting";

export function StudioLights() {
  const background = useSceneStore((s) => s.background);
  const lightingPreset = useSceneStore((s) => s.lightingPreset ?? "studio");
  const preset = LIGHTING_PRESETS[lightingPreset] ?? LIGHTING_PRESETS.studio;

  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const forwardVec = useRef(new THREE.Vector3());
  const lightDirs = useRef(
    studioLightDirections(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)),
  );

  useFrame(({ camera }) => {
    camera.getWorldDirection(forwardVec.current);
    const aimed = studioLightDirections(forwardVec.current, camera.up, lightDirs.current);
    keyLightRef.current?.position.copy(aimed.key).multiplyScalar(10);
    fillLightRef.current?.position.copy(aimed.fill).multiplyScalar(10);
    rimLightRef.current?.position.copy(aimed.rim).multiplyScalar(10);
  });

  return (
    <>
      <ambientLight
        name={STUDIO_AMBIENT}
        intensity={backgroundTheme(background).ambient * preset.ambientMultiplier}
      />
      <directionalLight name={STUDIO_KEY} ref={keyLightRef} intensity={preset.keyIntensity} />
      <directionalLight
        name={STUDIO_FILL}
        ref={fillLightRef}
        intensity={preset.fillIntensity}
        color={preset.fillColor}
      />
      <directionalLight
        name={STUDIO_RIM}
        ref={rimLightRef}
        intensity={preset.rimIntensity}
        color={preset.rimColor}
      />
      <directionalLight
        position={[0, -5, 1]}
        intensity={preset.bounceIntensity}
        color={preset.bounceColor}
      />
    </>
  );
}
