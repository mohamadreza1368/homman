import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const DEFAULT_GRAIN = 0.045;
const DEFAULT_ABERRATION = 0.0016;

const HolographicFilmShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAberration: { value: DEFAULT_ABERRATION },
    uGrain: { value: DEFAULT_GRAIN },
    uVignette: { value: 1.15 },
    uWhite: { value: 1.45 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uWhite;
    varying vec2 vUv;

    float pseudoNoise(vec2 seed) {
      return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centerOffset = vUv - 0.5;
      vec2 chromaticDisp = centerOffset * uAberration * 2.0;

      vec3 rgb;
      rgb.r = texture2D(tDiffuse, vUv + chromaticDisp).r;
      rgb.g = texture2D(tDiffuse, vUv).g;
      rgb.b = texture2D(tDiffuse, vUv - chromaticDisp).b;

      // Soft ceiling Reinhard tone compression
      rgb = rgb * (1.0 + rgb / (uWhite * uWhite)) / (1.0 + rgb);

      float vignetting = 1.0 - dot(centerOffset, centerOffset) * uVignette;
      float noiseSample = (pseudoNoise(gl_FragCoord.xy + fract(uTime)) - 0.5) * uGrain;

      gl_FragColor = vec4(rgb * vignetting + noiseSample, 1.0);
    }
  `,
};

export interface Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  film: ShaderPass;
  setSize(width: number, height: number): void;
  setBloomScale(scale: number): void;
  setFilm(active: boolean): void;
  dispose(): void;
}

/**
 * Instantiates multi-stage post-processing pipeline featuring bloom, vignette,
 * chromatic aberration, and noise grain.
 */
export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Post {
  const currentSize = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(currentSize, 0.75, 0.55, 0.16);
  composer.addPass(bloomPass);

  const filmPass = new ShaderPass(HolographicFilmShader);
  composer.addPass(filmPass);

  composer.addPass(new OutputPass());

  let downsampleRatio = 1.0;

  return {
    composer,
    bloom: bloomPass,
    film: filmPass,
    setSize(viewportW: number, viewportH: number) {
      composer.setSize(viewportW, viewportH);
      const bloomTargetW = Math.max(1, Math.round(viewportW * downsampleRatio));
      const bloomTargetH = Math.max(1, Math.round(viewportH * downsampleRatio));
      bloomPass.setSize(bloomTargetW, bloomTargetH);
    },
    setBloomScale(ratio: number) {
      downsampleRatio = ratio;
    },
    setFilm(enabled: boolean) {
      filmPass.uniforms.uGrain!.value = enabled ? DEFAULT_GRAIN : 0;
      filmPass.uniforms.uAberration!.value = enabled ? DEFAULT_ABERRATION : 0;
    },
    dispose() {
      composer.dispose();
      bloomPass.dispose();
    },
  };
}
