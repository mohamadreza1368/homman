import * as THREE from "three";

import { LOOK } from "./hologram";

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 256;

function renderTitleTexture(label: string): THREE.CanvasTexture {
  const offscreen = document.createElement("canvas");
  offscreen.width = TEXTURE_WIDTH;
  offscreen.height = TEXTURE_HEIGHT;
  const ctx = offscreen.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(offscreen);
  }

  ctx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `200 150px "Bahnschrift", "Segoe UI", system-ui, sans-serif`;

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "38px";
  }

  const cx = TEXTURE_WIDTH * 0.5;
  const cy = TEXTURE_HEIGHT * 0.5 + 6;

  // Background glow fill
  ctx.fillStyle = "rgba(86, 225, 255, 0.18)";
  ctx.fillText(label, cx, cy);

  // High-precision outer contour
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(170, 240, 255, 1.0)";
  ctx.strokeText(label, cx, cy);

  const texture = new THREE.CanvasTexture(offscreen);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export const NAME_HEIGHT = 1.28;

/**
 * Builds the floating holographic title badge hovering over the cranial cortex model.
 */
export function nameplate(caption = "HOOMAAN"): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const shaderMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uText: { value: renderTitleTexture(caption) },
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uCyan: { value: LOOK.cyan },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uText;
      uniform float uReveal;
      uniform float uTime;
      uniform vec3 uCyan;
      varying vec2 vUv;

      void main() {
        float alphaMask = texture2D(uText, vUv).a;
        float sweepPos = uReveal * 1.2 - 0.1;
        float visibleRatio = smoothstep(sweepPos, sweepPos - 0.04, vUv.x);
        float leadingEdge = exp(-pow((vUv.x - sweepPos) * 40.0, 2.0)) * step(uReveal, 0.99);

        float rasterScan = 0.72 + 0.28 * sin(vUv.y * 90.0 - uTime * 2.0);
        float outputAlpha = alphaMask * visibleRatio * rasterScan * 0.55 +
                            leadingEdge * 0.35 * alphaMask +
                            leadingEdge * 0.05;

        gl_FragColor = vec4(uCyan * outputAlpha, 1.0);
      }
    `,
  });

  const planeWidth = 1.9;
  const planeHeight = (planeWidth * TEXTURE_HEIGHT) / TEXTURE_WIDTH;
  const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), shaderMat);
  titleMesh.renderOrder = 5;
  return titleMesh;
}

/**
 * Updates orientation and vertical harmonic hover for the floating nameplate.
 */
export function floatName(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  timestampSeconds: number,
  revealProgress: number,
): void {
  mesh.position.set(0, NAME_HEIGHT + Math.sin(timestampSeconds * 0.6) * 0.025, 0);

  // Billboard alignment about global vertical axis only
  const azimuth = Math.atan2(
    camera.position.x - mesh.position.x,
    camera.position.z - mesh.position.z,
  );
  mesh.rotation.set(0, azimuth, 0);

  const mat = mesh.material as THREE.ShaderMaterial;
  mat.uniforms.uReveal!.value = revealProgress;
  mat.uniforms.uTime!.value = timestampSeconds;
}
