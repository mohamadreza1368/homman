import * as THREE from "three";
import { placeOnCortex } from "../memories";
import type { Brain } from "./brainLoader";
import { LOOK } from "./hologram";
import {
  BURST_PARTICLE_COUNT,
  PALETTE,
  THREAD_SUBDIVISIONS,
  type SceneMemory,
} from "./memorySceneTypes";

export function cortexPlaces(brain: Brain, memoryCount: number): THREE.Vector3[] {
  const posAttr = brain.geometry.getAttribute("position") as THREE.BufferAttribute;
  const regionAttr = brain.geometry.getAttribute("region") as THREE.BufferAttribute;
  const cerebrumIndices = new Set(
    brain.regions
      .map((r, idx) => (r.division === "Cerebrum" ? idx : -1))
      .filter((idx) => idx >= 0),
  );

  const decimationStep = Math.max(1, Math.floor(posAttr.count / 12000));
  const vertexPool: number[] = [];

  for (let v = 0; v < posAttr.count; v += decimationStep) {
    if (cerebrumIndices.size > 0 && !cerebrumIndices.has(regionAttr.getX(v))) {
      continue;
    }
    vertexPool.push(posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v));
  }

  return placeOnCortex(memoryCount, vertexPool).map((pointIdx) =>
    new THREE.Vector3(
      vertexPool[pointIdx * 3]!,
      vertexPool[pointIdx * 3 + 1]!,
      vertexPool[pointIdx * 3 + 2]!,
    ).multiplyScalar(1.02),
  );
}

export function memoryNodes(
  coords: THREE.Vector3[],
  memories: readonly SceneMemory[],
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const count = Math.max(1, coords.length);
  const positionBuffer = new Float32Array(count * 3);
  const colorBuffer = new Float32Array(count * 3);
  const orderBuffer = new Float32Array(count);
  const presenceBuffer = new Float32Array(count).fill(1);

  coords.forEach((p, idx) => {
    p.toArray(positionBuffer, idx * 3);
    PALETTE[memories[idx]!.kind].toArray(colorBuffer, idx * 3);
    orderBuffer[idx] = idx;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positionBuffer, 3));
  geo.setAttribute("colour", new THREE.BufferAttribute(colorBuffer, 3));
  geo.setAttribute("order", new THREE.BufferAttribute(orderBuffer, 1));
  geo.setAttribute("presence", new THREE.BufferAttribute(presenceBuffer, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uShown: { value: 0 },
      uHover: { value: -1 },
      uSelected: { value: -1 },
      uPixel: { value: 1 },
      uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 colour;
      attribute float order;
      attribute float presence;
      uniform float uTime;
      uniform float uShown;
      uniform float uHover;
      uniform float uSelected;
      uniform float uPixel;
      uniform float uFade;
      varying vec3 vColour;
      varying float vAlpha;
      varying float vRing;

      void main() {
        float isShown = step(order, uShown - 0.5);
        float arrivingFlare = exp(-pow(max(0.0, uShown - 1.0 - order) * 1.6, 2.0));
        float isFocused = max(step(abs(order - uHover), 0.1), step(abs(order - uSelected), 0.1));
        vRing = step(abs(order - uSelected), 0.1);
        vColour = colour;

        float breathing = 0.85 + 0.15 * sin(uTime * 1.3 + order * 0.7);
        vAlpha = isShown * presence * uFade * breathing * (0.75 + 0.25 * isFocused);

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPixel * (10.0 + arrivingFlare * 10.0 + isFocused * 9.0 + vRing * 11.0) * (5.6 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;
      varying float vAlpha;
      varying float vRing;

      void main() {
        vec2 delta = gl_PointCoord - 0.5;
        float radius = length(delta) * 2.0;
        if (radius > 1.0) discard;

        float innerCore = exp(-radius * radius * 9.0);
        float peripheralGlow = exp(-radius * 3.4) * 0.22;
        float selectionRing = vRing * smoothstep(0.08, 0.0, abs(radius - 0.82));

        gl_FragColor = vec4(vColour * (innerCore + peripheralGlow + selectionRing) * vAlpha * 0.72, 1.0);
      }
    `,
  });

  return new THREE.Points(geo, mat);
}

export function memoryThread(
  coords: THREE.Vector3[],
): THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const pairCount = Math.max(0, coords.length - 1);
  const vertexCount = Math.max(2, pairCount * THREAD_SUBDIVISIONS * 2);
  const vertexPositions = new Float32Array(vertexCount * 3);
  const progressAttributes = new Float32Array(vertexCount);
  const edgeIndices = new Float32Array(vertexCount * 2);
  const threadPresence = new Float32Array(vertexCount).fill(1);

  const sampleVec = new THREE.Vector3();

  for (let idx = 0; idx < pairCount; idx++) {
    const originP = coords[idx]!;
    const destP = coords[idx + 1]!;
    const centerP = originP.clone().add(destP).multiplyScalar(0.5);
    const elevatedApex = centerP.clone().normalize().multiplyScalar(0.06 + originP.distanceTo(destP) * 0.25);
    const bezierSpline = new THREE.QuadraticBezierCurve3(originP, centerP.add(elevatedApex), destP);

    for (let k = 0; k < THREAD_SUBDIVISIONS; k++) {
      const endpoints: readonly [number, number][] = [
        [0, k / THREAD_SUBDIVISIONS],
        [1, (k + 1) / THREAD_SUBDIVISIONS],
      ];
      for (const [slot, factor] of endpoints) {
        const vIdx = (idx * THREAD_SUBDIVISIONS + k) * 2 + slot;
        bezierSpline.getPoint(factor, sampleVec).toArray(vertexPositions, vIdx * 3);
        progressAttributes[vIdx] = idx + factor;
        edgeIndices[vIdx * 2] = idx;
        edgeIndices[vIdx * 2 + 1] = idx + 1;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertexPositions, 3));
  geometry.setAttribute("along", new THREE.BufferAttribute(progressAttributes, 1));
  geometry.setAttribute("ends", new THREE.BufferAttribute(edgeIndices, 2));
  geometry.setAttribute("presence", new THREE.BufferAttribute(threadPresence, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

  const threadMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uShown: { value: 0 },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uCyan: { value: LOOK.cyan },
    },
    vertexShader: /* glsl */ `
      attribute float along;
      attribute float presence;
      varying float vAlong;
      varying float vPresence;

      void main() {
        vAlong = along;
        vPresence = presence;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uShown;
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uCyan;
      varying float vAlong;
      varying float vPresence;

      void main() {
        float leadingEdge = uShown - 1.0;
        if (vAlong > leadingEdge) discard;

        float headGlow = exp(-pow((leadingEdge - vAlong) * 3.0, 2.0));
        float travelingPulse = exp(-pow(mod(vAlong - uTime * 1.2, 24.0) - 12.0, 2.0) * 0.5) * 0.5;

        float alphaValue = (0.18 + headGlow * 0.8 + travelingPulse * 0.3) * vPresence * uFade;
        gl_FragColor = vec4(uCyan * alphaValue, 1.0);
      }
    `,
  });

  return new THREE.LineSegments(geometry, threadMat);
}

export function updateThreadPresence(
  thread: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>,
  presence: Float32Array,
): void {
  const geo = thread.geometry;
  const edgesAttr = geo.getAttribute("ends") as THREE.BufferAttribute;
  const presenceAttr = geo.getAttribute("presence") as THREE.BufferAttribute;

  for (let v = 0; v < presenceAttr.count; v++) {
    presenceAttr.setX(
      v,
      Math.min(presence[edgesAttr.getX(v)] ?? 1, presence[edgesAttr.getY(v)] ?? 1),
    );
  }
  presenceAttr.needsUpdate = true;
}

export function eraseBurst(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const coords = new Float32Array(BURST_PARTICLE_COUNT * 3);
  const velocityVectors = new Float32Array(BURST_PARTICLE_COUNT * 3);
  const randomSeeds = new Float32Array(BURST_PARTICLE_COUNT);

  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    dir.toArray(velocityVectors, i * 3);
    randomSeeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(coords, 3));
  geometry.setAttribute("direction", new THREE.BufferAttribute(velocityVectors, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(randomSeeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const burstMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStart: { value: -100 },
      uOrigin: { value: new THREE.Vector3() },
      uColour: { value: new THREE.Color() },
      uPixel: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 direction;
      attribute float seed;
      uniform float uTime;
      uniform float uStart;
      uniform vec3 uOrigin;
      uniform float uPixel;
      varying float vAlpha;

      void main() {
        float lifetimeProgress = (uTime - uStart) / (1.2 + seed * 1.2);
        vAlpha = lifetimeProgress < 0.0 || lifetimeProgress > 1.0
          ? 0.0
          : (1.0 - lifetimeProgress) * (1.0 - lifetimeProgress);

        vec3 displacedPos = uOrigin + direction * (0.05 + seed * 0.5) * (1.0 - pow(1.0 - clamp(lifetimeProgress, 0.0, 1.0), 3.0));
        displacedPos.y += lifetimeProgress * lifetimeProgress * 0.15;

        vec4 mvPos = modelViewMatrix * vec4(displacedPos, 1.0);
        gl_PointSize = uPixel * (2.0 + seed * 3.0) * (5.6 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      varying float vAlpha;

      void main() {
        vec2 delta = gl_PointCoord - 0.5;
        if (dot(delta, delta) > 0.25) discard;
        gl_FragColor = vec4(uColour * vAlpha * 0.9, 1.0);
      }
    `,
  });

  return new THREE.Points(geometry, burstMat);
}

export function fireBurst(
  burstPoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  origin: THREE.Vector3,
  timestampSec: number,
  colorVal: THREE.Color,
): void {
  const burstUniforms = burstPoints.material.uniforms;
  burstUniforms.uStart!.value = timestampSec;
  (burstUniforms.uOrigin!.value as THREE.Vector3).copy(origin);
  (burstUniforms.uColour!.value as THREE.Color).copy(colorVal);
}
