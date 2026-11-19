import * as THREE from "three";

import { LOOK } from "./hologram";

export const BASE_Y = -1.55;

/**
 * Creates the grounded spatial plane grid with ambient radial falloff and ripple waves.
 */
export function floorGrid(): THREE.Mesh {
  const gridShader = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uFade: { value: 0 },
      uTime: { value: 0 },
      uCyan: { value: LOOK.deep },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vXZ = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      uniform float uTime;
      uniform vec3 uCyan;
      varying vec2 vXZ;

      float gridLine(float coordinate, float strokeWidth) {
        float distanceToCenter = abs(fract(coordinate - 0.5) - 0.5) / fwidth(coordinate);
        return 1.0 - min(distanceToCenter / strokeWidth, 1.0);
      }

      void main() {
        vec2 scaledUV = vXZ * 2.0;
        float minorAxes = max(gridLine(scaledUV.x, 1.0), gridLine(scaledUV.y, 1.0)) * 0.25;
        float majorAxes = max(gridLine(scaledUV.x * 0.2, 1.2), gridLine(scaledUV.y * 0.2, 1.2)) * 0.55;

        float distanceOrigin = length(vXZ);
        float attenuation = exp(-distanceOrigin * 0.32);
        float radialWave = exp(-pow((distanceOrigin - mod(uTime * 0.6, 14.0)) * 2.0, 2.0)) * 0.35;

        float combinedAlpha = (minorAxes + majorAxes + radialWave) * attenuation * uFade * 0.5;
        gl_FragColor = vec4(uCyan * combinedAlpha, 1.0);
      }
    `,
  });

  const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), gridShader);
  planeMesh.rotation.x = -Math.PI * 0.5;
  planeMesh.position.y = BASE_Y - 0.02;
  return planeMesh;
}

/**
 * Constructs projector emission disc and volumetric upward light cone.
 */
export function projector(): THREE.Group {
  const container = new THREE.Group();
  container.position.y = BASE_Y;

  const emitterDiscMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uFade: { value: 0 },
      uTime: { value: 0 },
      uCyan: { value: LOOK.cyan },
      uAmber: { value: LOOK.amber },
    },
    vertexShader: /* glsl */ `
      varying vec2 vCoord;
      void main() {
        vCoord = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      uniform float uTime;
      uniform vec3 uCyan;
      uniform vec3 uAmber;
      varying vec2 vCoord;

      float ringBand(float radius, float targetRadius, float width) {
        return exp(-pow((radius - targetRadius) / width, 2.0));
      }

      void main() {
        float r = length(vCoord);
        float angle = atan(vCoord.y, vCoord.x);

        float concentric = ringBand(r, 0.55, 0.01) +
                           ringBand(r, 0.95, 0.008) * 0.8 +
                           ringBand(r, 1.35, 0.012) +
                           ringBand(r, 1.70, 0.006) * 0.6;

        float ticks = step(0.5, fract((angle + uTime * 0.08) / 6.2831853 * 120.0)) *
                      smoothstep(1.28, 1.30, r) * smoothstep(1.42, 1.40, r);

        float radarSweep = pow(max(0.0, cos(angle - uTime * 0.9)), 18.0) * ringBand(r, 0.95, 0.05);
        float segmentedArc = step(0.0, sin(angle * 3.0 - uTime * 0.4)) * ringBand(r, 1.55, 0.01);
        float centralBulb = exp(-r * 2.2) * 0.35;

        vec3 colorAccum = uCyan * (concentric * 0.3 + ticks * 0.18 + segmentedArc * 0.2 + centralBulb * 0.45) +
                          uAmber * radarSweep * 0.3;

        gl_FragColor = vec4(colorAccum * uFade, 1.0);
      }
    `,
  });

  const discMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), emitterDiscMat);
  discMesh.rotation.x = -Math.PI * 0.5;
  container.add(discMesh);

  const volumetricConeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uFade: { value: 0 },
      uTime: { value: 0 },
      uCyan: { value: LOOK.cyan },
    },
    vertexShader: /* glsl */ `
      varying float vNormalizedY;
      varying vec3 vViewNormal;
      varying vec3 vCamDir;
      varying float vAzimuth;

      void main() {
        vNormalizedY = uv.y;
        vAzimuth = uv.x;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vCamDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      uniform float uTime;
      uniform vec3 uCyan;
      varying float vNormalizedY;
      varying vec3 vViewNormal;
      varying vec3 vCamDir;
      varying float vAzimuth;

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(vCamDir))), 1.5);
        float fluting = 0.6 + 0.4 * sin(vAzimuth * 90.0 + uTime * 0.7) * sin(vAzimuth * 23.0 - uTime * 0.4);
        float verticalWave = 0.75 + 0.25 * sin(vNormalizedY * 30.0 - uTime * 2.0);
        float verticalFade = (1.0 - vNormalizedY) * (1.0 - vNormalizedY);

        float coneAlpha = verticalFade * fresnel * fluting * verticalWave * 0.06 * uFade;
        gl_FragColor = vec4(uCyan * coneAlpha, 1.0);
      }
    `,
  });

  const coneGeometry = new THREE.CylinderGeometry(1.25, 0.55, 1.5, 96, 1, true);
  const coneMesh = new THREE.Mesh(coneGeometry, volumetricConeMat);
  coneMesh.position.y = 0.75;
  container.add(coneMesh);

  return container;
}

/**
 * Produces rotating orbital telemetry rings circling the cranial hologram.
 */
export function orbitRings(): THREE.Group {
  const orbitGroup = new THREE.Group();
  const ringConfigurations = [
    { radius: 1.32, inclination: 0.35, rotationSpeed: 0.12, intensity: 0.5 },
    { radius: 1.45, inclination: -0.60, rotationSpeed: -0.08, intensity: 0.35 },
    { radius: 1.60, inclination: 1.20, rotationSpeed: 0.05, intensity: 0.25 },
  ];

  for (const ring of ringConfigurations) {
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFade: { value: 0 },
        uTime: { value: 0 },
        uSpin: { value: ring.rotationSpeed },
        uStrength: { value: ring.intensity },
        uCyan: { value: LOOK.cyan },
      },
      vertexShader: /* glsl */ `
        varying float vRingAngle;
        void main() {
          vRingAngle = atan(position.y, position.x);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        uniform float uTime;
        uniform float uSpin;
        uniform float uStrength;
        uniform vec3 uCyan;
        varying float vRingAngle;

        void main() {
          float orbitingLead = pow(max(0.0, cos(vRingAngle - uTime * uSpin * 6.0)), 40.0);
          float dashStipple = step(0.35, fract(vRingAngle * 12.0 / 6.2831853));
          float alphaValue = (0.12 * dashStipple + orbitingLead * 0.9) * uStrength * uFade;

          gl_FragColor = vec4(uCyan * alphaValue, 1.0);
        }
      `,
    });

    const ellipsePath = new THREE.EllipseCurve(0, 0, ring.radius, ring.radius, 0, Math.PI * 2);
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ellipsePath.getPoints(256));
    const lineMesh = new THREE.LineLoop(ringGeo, ringMat);
    lineMesh.rotation.x = Math.PI * 0.5 + ring.inclination;
    lineMesh.userData.spin = ring.rotationSpeed;
    orbitGroup.add(lineMesh);
  }

  return orbitGroup;
}

/**
 * Reusable pool for neural synaptic impulses traversing coordinate nodes.
 */
export class Impulses {
  readonly object: THREE.LineSegments;
  private readonly coords: Float32Array;
  private readonly lifecycle: Float32Array;
  private readonly totalSlots: number;
  private readonly subdivision = 40;
  private writePointer = 0;

  constructor(capacity = 28) {
    this.totalSlots = capacity;
    const vertexCount = capacity * this.subdivision * 2;
    this.coords = new Float32Array(vertexCount * 3);
    const progression = new Float32Array(vertexCount);
    this.lifecycle = new Float32Array(vertexCount * 2);

    for (let slot = 0; slot < capacity; slot++) {
      for (let seg = 0; seg < this.subdivision; seg++) {
        const baseIndex = (slot * this.subdivision + seg) * 2;
        progression[baseIndex] = seg / this.subdivision;
        progression[baseIndex + 1] = (seg + 1) / this.subdivision;
      }
    }

    for (let idx = 0; idx < vertexCount; idx++) {
      this.lifecycle[idx * 2] = -100;
      this.lifecycle[idx * 2 + 1] = 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.coords, 3));
    geometry.setAttribute("along", new THREE.BufferAttribute(progression, 1));
    geometry.setAttribute("timing", new THREE.BufferAttribute(this.lifecycle, 2));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

    const impulseShader = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1 },
        uAmber: { value: LOOK.amber },
        uCyan: { value: LOOK.cyan },
      },
      vertexShader: /* glsl */ `
        attribute float along;
        attribute vec2 timing;
        uniform float uTime;
        varying float vAlong;
        varying float vProgress;

        void main() {
          vAlong = along;
          vProgress = (uTime - timing.x) / timing.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        uniform vec3 uAmber;
        uniform vec3 uCyan;
        varying float vAlong;
        varying float vProgress;

        void main() {
          if (vProgress < 0.0 || vProgress > 1.6) discard;
          float delta = vProgress - vAlong;
          if (delta < 0.0) discard;

          float headGlow = exp(-delta * delta * 900.0);
          float cometTail = exp(-delta * 6.0) * 0.25;
          float outputAlpha = (headGlow + cometTail) * uFade;

          gl_FragColor = vec4(mix(uCyan, uAmber, headGlow) * outputAlpha, 1.0);
        }
      `,
    });

    this.object = new THREE.LineSegments(geometry, impulseShader);
  }

  fire(origin: THREE.Vector3, target: THREE.Vector3, startEpoch: number, durationSeconds: number): void {
    const slotIdx = this.writePointer;
    this.writePointer = (this.writePointer + 1) % this.totalSlots;

    const midPoint = origin.clone().add(target).multiplyScalar(0.5);
    const archedElevation = midPoint.clone().normalize().multiplyScalar(0.35 + origin.distanceTo(target) * 0.35);
    const bezierCurve = new THREE.QuadraticBezierCurve3(origin, midPoint.add(archedElevation), target);

    const tempVec = new THREE.Vector3();
    for (let k = 0; k < this.subdivision; k++) {
      const baseVertex = (slotIdx * this.subdivision + k) * 2;
      bezierCurve.getPoint(k / this.subdivision, tempVec).toArray(this.coords, baseVertex * 3);
      bezierCurve.getPoint((k + 1) / this.subdivision, tempVec).toArray(this.coords, (baseVertex + 1) * 3);

      this.lifecycle[baseVertex * 2] = startEpoch;
      this.lifecycle[baseVertex * 2 + 1] = durationSeconds;
      this.lifecycle[(baseVertex + 1) * 2] = startEpoch;
      this.lifecycle[(baseVertex + 1) * 2 + 1] = durationSeconds;
    }

    const geo = this.object.geometry;
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute("timing") as THREE.BufferAttribute).needsUpdate = true;
  }
}
