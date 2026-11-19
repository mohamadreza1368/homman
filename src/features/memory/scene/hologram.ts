import * as THREE from "three";

export const LOOK = {
  cyan: new THREE.Color("#3fd8ff"),
  deep: new THREE.Color("#1b6cff"),
  amber: new THREE.Color("#ffb347"),
  opacity: 0.1,
  rimSharpness: 4.6,
  regionGlow: 0.3,
  scanStrength: 0.22,
  scanWidth: 0.008,
  contourSharpness: 14,
  contourStrength: 1.4,
  edgeStrength: 0.12,
  depthFade: 0.85,
} as const;

/**
 * Encapsulates dynamic region-level illumination levels packed into a 1D GPU data texture.
 */
export class RegionLight {
  readonly texture: THREE.DataTexture;
  readonly size: number;
  private readonly bufferData: Float32Array;

  constructor(count: number) {
    this.size = Math.max(1, count);
    this.bufferData = new Float32Array(this.size * 4);
    this.texture = new THREE.DataTexture(
      this.bufferData,
      this.size,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
  }

  set(idx: number, intensity: number, isCurrent: boolean): void {
    const baseOffset = idx * 4;
    this.bufferData[baseOffset] = intensity;
    this.bufferData[baseOffset + 1] = isCurrent ? 1 : 0;
  }

  commit(): void {
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

const PROCEDURAL_NOISE_CHUNK = /* glsl */ `
float pseudoHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float valueNoise3D(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pseudoHash(i), pseudoHash(i + vec3(1,0,0)), f.x),
        mix(pseudoHash(i + vec3(0,1,0)), pseudoHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(pseudoHash(i + vec3(0,0,1)), pseudoHash(i + vec3(1,0,1)), f.x),
        mix(pseudoHash(i + vec3(0,1,1)), pseudoHash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
`;

/**
 * Configures the translucent glowing shader material for the cerebral cortex model.
 */
export function brainMaterial(regions: RegionLight): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uScanY: { value: -10 },
      uScanOn: { value: 0 },
      uFade: { value: 1 },
      uRegions: { value: regions.texture },
      uRegionCount: { value: regions.size },
      uCyan: { value: LOOK.cyan },
      uDeep: { value: LOOK.deep },
      uAmber: { value: LOOK.amber },
      uCentre: { value: 1000 },
    },
    vertexShader: /* glsl */ `
      attribute float region;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;
      varying float vRegion;
      varying float vDepth;

      void main() {
        vPos = position;
        vRegion = region;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mvPos.z;
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uReveal;
      uniform float uScanY;
      uniform float uScanOn;
      uniform float uFade;
      uniform sampler2D uRegions;
      uniform float uRegionCount;
      uniform vec3 uCyan;
      uniform vec3 uDeep;
      uniform vec3 uAmber;
      uniform float uCentre;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;
      varying float vRegion;
      varying float vDepth;

      ${PROCEDURAL_NOISE_CHUNK}

      void main() {
        // Frontline materialization wave
        float noiseSample = valueNoise3D(vPos * 7.0) * 0.55 + (vPos.y + 1.0) * 0.225;
        float sweepCutoff = uReveal * 1.25 - 0.1;
        if (noiseSample > sweepCutoff) discard;

        float leadEdgeGlow = smoothstep(0.06, 0.0, sweepCutoff - noiseSample) * step(uReveal, 0.999);
        float viewIncidence = abs(dot(normalize(vNormal), normalize(vView)));
        float rimHighlight = pow(1.0 - viewIncidence, ${LOOK.rimSharpness.toFixed(2)});

        vec4 regionSample = texture2D(uRegions, vec2((vRegion + 0.5) / uRegionCount, 0.5));
        float regionLevel = regionSample.r;
        float isCurrentRegion = regionSample.g;

        // Subtle horizontal raster scanlines
        float horizontalScan = 0.8 + 0.2 * sin(vPos.y * 180.0 - uTime * 1.5);

        float planarScan = uScanOn * exp(-pow((vPos.y - uScanY) / ${LOOK.scanWidth.toFixed(3)}, 2.0));
        float scannedResidual = uScanOn * step(vPos.y, uScanY) * 0.15;

        vec3 baselineColor = mix(uDeep, uCyan, rimHighlight);
        vec3 finalHue = mix(baselineColor, uAmber, clamp(regionLevel * mix(0.9, 1.6, isCurrentRegion), 0.0, 1.0));

        float regionGlowAmount = regionLevel * ${LOOK.regionGlow.toFixed(2)} * (0.4 + rimHighlight) * mix(0.25, 2.0, isCurrentRegion);
        float edgeContour = pow(1.0 - viewIncidence, ${LOOK.contourSharpness.toFixed(1)});
        float hazeAttenuation = exp(-max(0.0, vDepth - uCentre) * ${LOOK.depthFade.toFixed(2)});

        float compositeAlpha = ${LOOK.opacity.toFixed(3)} * (
          rimHighlight * (2.4 + scannedResidual) * horizontalScan +
          regionGlowAmount +
          edgeContour * ${LOOK.contourStrength.toFixed(2)}
        ) * hazeAttenuation;

        vec3 emission = finalHue * compositeAlpha
          + uCyan * planarScan * ${LOOK.scanStrength.toFixed(2)} * (0.25 + rimHighlight)
          + uCyan * leadEdgeGlow * ${LOOK.edgeStrength.toFixed(2)} * rimHighlight;

        gl_FragColor = vec4(emission * uFade, 1.0);
      }
    `,
  });
}

/**
 * Generates floating particulate constellation that condenses into cortex geometry.
 */
export function brainPoints(
  geometry: THREE.BufferGeometry,
  count: number,
  rngSeed = 7,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const regionAttr = geometry.getAttribute("region") as THREE.BufferAttribute;

  let currentSeed = rngSeed;
  const nextRandom = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    return currentSeed / 4294967296;
  };

  const targetCoords = new Float32Array(count * 3);
  const startCoords = new Float32Array(count * 3);
  const particleMeta = new Float32Array(count * 3); // delay, twinkle phase, region

  for (let idx = 0; idx < count; idx++) {
    const vIndex = Math.floor(nextRandom() * positionAttr.count);
    targetCoords[idx * 3] = positionAttr.getX(vIndex);
    targetCoords[idx * 3 + 1] = positionAttr.getY(vIndex);
    targetCoords[idx * 3 + 2] = positionAttr.getZ(vIndex);

    const orbitAngle = nextRandom() * Math.PI * 2;
    const launchRadius = 1.2 + nextRandom() * 1.4;
    startCoords[idx * 3] = Math.cos(orbitAngle) * launchRadius;
    startCoords[idx * 3 + 1] = -1.9 + nextRandom() * 0.2;
    startCoords[idx * 3 + 2] = Math.sin(orbitAngle) * launchRadius;

    particleMeta[idx * 3] = nextRandom();
    particleMeta[idx * 3 + 1] = nextRandom() * Math.PI * 2;
    particleMeta[idx * 3 + 2] = regionAttr.getX(vIndex);
  }

  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(targetCoords, 3));
  pointGeo.setAttribute("start", new THREE.BufferAttribute(startCoords, 3));
  pointGeo.setAttribute("extra", new THREE.BufferAttribute(particleMeta, 3));
  pointGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const particleShader = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAssemble: { value: 0 },
      uDisperse: { value: 0 },
      uDust: { value: 1 },
      uPixel: { value: 1 },
      uRegions: { value: null as THREE.Texture | null },
      uRegionCount: { value: 1 },
      uCyan: { value: LOOK.cyan },
      uAmber: { value: LOOK.amber },
    },
    vertexShader: /* glsl */ `
      attribute vec3 start;
      attribute vec3 extra;
      uniform float uTime;
      uniform float uAssemble;
      uniform float uDisperse;
      uniform float uPixel;
      uniform sampler2D uRegions;
      uniform float uRegionCount;
      varying float vAlpha;
      varying float vLevel;

      void main() {
        float stagger = extra.x * 0.55;
        float progress = clamp((uAssemble - stagger) / 0.45, 0.0, 1.0);
        progress = progress * progress * (3.0 - 2.0 * progress);

        float spiralAngle = (1.0 - progress) * 2.2;
        vec3 rotatedStart = vec3(
          start.x * cos(spiralAngle) - start.z * sin(spiralAngle),
          start.y,
          start.x * sin(spiralAngle) + start.z * cos(spiralAngle)
        );

        vec3 currentPos = mix(rotatedStart, position, progress);
        vec3 outwardNormal = normalize(position + vec3(0.0001)) * (1.5 + extra.x * 2.5);
        currentPos += outwardNormal * uDisperse * uDisperse;

        vLevel = texture2D(uRegions, vec2((extra.z + 0.5) / uRegionCount, 0.5)).r;
        float twinkle = 0.6 + 0.4 * sin(uTime * 1.7 + extra.y);
        vAlpha = twinkle * (0.35 + 0.65 * progress) * step(0.001, uAssemble) * (1.0 - uDisperse);

        vec4 mvPos = modelViewMatrix * vec4(currentPos, 1.0);
        gl_PointSize = uPixel * (1.4 + vLevel * 1.2) * (3.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCyan;
      uniform vec3 uAmber;
      uniform float uDust;
      varying float vAlpha;
      varying float vLevel;

      void main() {
        vec2 delta = gl_PointCoord - 0.5;
        float distSq = dot(delta, delta);
        if (distSq > 0.25) discard;

        float softFalloff = 1.0 - distSq * 4.0;
        vec3 dotColor = mix(uCyan, uAmber, clamp(vLevel * 1.5, 0.0, 1.0));
        gl_FragColor = vec4(dotColor * softFalloff * vAlpha * 0.2 * uDust, 1.0);
      }
    `,
  });

  return new THREE.Points(pointGeo, particleShader);
}
