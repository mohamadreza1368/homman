import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type SystemCategory = 
  | 'skeletal'
  | 'muscular'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'lymphatic'
  | 'integumentary';

export interface AtlasPart {
  id: string;
  name: string;
  conceptId: string;
  system: string;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface AtlasManifest {
  version: string;
  sex?: string;
  parts: AtlasPart[];
  chunks: { url: string; bytes: number; gzip?: string }[];
  triangles: number;
}

export const SYSTEM_COLORS: Record<string, string> = {
  skeletal: '#e2d9ba',      // Ivory bone
  muscular: '#a84c40',      // Deep striated muscle red
  cardiac: '#b94740',       // Myocardial crimson
  arterial: '#dc2626',      // Arterial bright red
  venous: '#2563eb',        // Venous royal blue
  nervous: '#eab308',       // Neural golden amber
  brain: '#c084fc',         // Cerebral lavender
  sensory: '#38bdf8',       // Sensory cyan
  respiratory: '#f472b6',   // Pulmonary soft pink
  digestive: '#d97706',     // Visceral warm amber
  urinary: '#0284c7',       // Renal blue
  lymphatic: '#10b981',     // Lymphatic emerald
  endocrine: '#8b5cf6',     // Endocrine violet
  reproductive: '#f43f5e',  // Coral
  integumentary: '#e2b89d', // Dermal flesh tone
  connective: '#cbd5e1',    // Fascial cartilaginous grey
};

export interface SystemVisibilityState {
  skeletal: boolean;
  muscular: boolean;
  nervous: boolean;
  cardiovascular: boolean;
  respiratory: boolean;
  digestive: boolean;
  urinary: boolean;
  lymphatic: boolean;
  integumentary: boolean;
}

export interface SystemOpacityState {
  skeletal: number;
  muscular: number;
  nervous: number;
  cardiovascular: number;
  respiratory: number;
  digestive: number;
  urinary: number;
  lymphatic: number;
  integumentary: number;
}

export class AtlasModelLoader {
  public manifest: AtlasManifest | null = null;
  public parts: AtlasPart[] = [];
  public centers: THREE.Vector3[] = [];
  public bounds: THREE.Box3[] = [];
  public pickers: (THREE.Mesh | undefined)[] = [];
  public systemMeshes: Map<string, THREE.Mesh> = new Map();
  public materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  private partTexture: THREE.DataTexture | null = null;
  private selectionTexture: THREE.DataTexture | null = null;
  private stateData: Float32Array | null = null;
  private selectionData: Uint8Array | null = null;
  private stateWidth = 1;

  public halfDissectionMode = true; // Half muscular, half skeletal + translucent skin (like user mock)
  public selectedPartIndex = -1;
  public isLoaded = false;

  public visibility: SystemVisibilityState = {
    skeletal: true,
    muscular: true,
    nervous: true,
    cardiovascular: true,
    respiratory: true,
    digestive: true,
    urinary: true,
    lymphatic: true,
    integumentary: true,
  };

  public opacity: SystemOpacityState = {
    skeletal: 1.0,
    muscular: 1.0,
    nervous: 1.0,
    cardiovascular: 1.0,
    respiratory: 1.0,
    digestive: 1.0,
    urinary: 1.0,
    lymphatic: 1.0,
    integumentary: 0.18, // Ghosted by default so internal anatomy shines through
  };

  public async load(
    scene: THREE.Scene,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const res = await fetch('/models/atlas.json');
    if (!res.ok) throw new Error('Failed to load anatomy atlas manifest');
    this.manifest = await res.json();
    if (!this.manifest) return;

    this.parts = this.manifest.parts;
    this.stateWidth = THREE.MathUtils.ceilPowerOfTwo(this.parts.length);
    this.stateData = new Float32Array(this.stateWidth * 4);
    this.selectionData = new Uint8Array(this.stateWidth * 4);

    this.partTexture = new THREE.DataTexture(
      this.stateData,
      this.stateWidth,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.partTexture.needsUpdate = true;

    this.selectionTexture = new THREE.DataTexture(
      this.selectionData,
      this.stateWidth,
      1
    );
    this.selectionTexture.needsUpdate = true;

    this.centers = this.parts.map((p) => {
      const min = new THREE.Vector3().fromArray(p.bounds[0]);
      const max = new THREE.Vector3().fromArray(p.bounds[1]);
      return min.clone().add(max).multiplyScalar(0.5);
    });

    this.bounds = this.parts.map((p) => {
      return new THREE.Box3(
        new THREE.Vector3().fromArray(p.bounds[0]),
        new THREE.Vector3().fromArray(p.bounds[1])
      );
    });

    // Create system materials with dynamic GPU shader uniforms
    const distinctSystems = Array.from(new Set(this.parts.map((p) => p.system)));
    distinctSystems.forEach((sys) => {
      const colorHex = SYSTEM_COLORS[sys] || '#aebbb8';
      const isSkin = sys === 'integumentary';
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        metalness: isSkin ? 0.02 : 0.12,
        roughness: isSkin ? 0.45 : 0.48,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSkin ? this.opacity.integumentary : 1.0,
        depthWrite: !isSkin,
      });

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.partState = { value: this.partTexture };
        shader.uniforms.selectionState = { value: this.selectionTexture };
        shader.uniforms.stateWidth = { value: this.stateWidth };

        shader.vertexShader =
          'attribute float partIndex;\n' +
          'uniform sampler2D partState;\n' +
          'uniform sampler2D selectionState;\n' +
          'uniform float stateWidth;\n' +
          'varying float vPartVisible;\n' +
          'varying float vPartSelected;\n' +
          shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
           vec4 state = texture2D(partState, stateUv);
           transformed += state.xyz;
           vPartVisible = state.w;
           vPartSelected = texture2D(selectionState, stateUv).r;`
        );

        shader.fragmentShader =
          'varying float vPartVisible;\n' +
          'varying float vPartSelected;\n' +
          shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           if (vPartVisible < 0.5) discard;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // Electric Blue Neon Highlight on selected structure
           vec3 glowColor = vec3(0.18, 0.65, 1.0);
           diffuseColor.rgb = mix(diffuseColor.rgb, glowColor, vPartSelected * 0.88);`
        );
      };

      this.materials.set(sys, mat);
    });

    // Load chunks progressively
    const totalChunks = this.manifest.chunks.length;
    let chunksLoaded = 0;

    const loadSingleChunk = async (chunkIndex: number) => {
      const chunkInfo = this.manifest!.chunks[chunkIndex];
      const res = await fetch(chunkInfo.url);
      if (!res.ok) throw new Error(`Chunk ${chunkIndex} failed to download`);
      const buffer = await res.arrayBuffer();

      const groups = new Map<string, THREE.BufferGeometry[]>();

      this.parts.forEach((p, i) => {
        if (p.chunk !== chunkIndex) return;

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          'position',
          new THREE.BufferAttribute(
            new Float32Array(buffer, p.positions, p.vertexCount * 3),
            3
          )
        );
        geom.setAttribute(
          'normal',
          new THREE.BufferAttribute(
            new Int16Array(buffer, p.normals, p.vertexCount * 3),
            3,
            true
          )
        );
        geom.setIndex(
          new THREE.BufferAttribute(
            new Uint32Array(buffer, p.indices, p.indexCount),
            1
          )
        );
        geom.setAttribute(
          'partIndex',
          new THREE.BufferAttribute(
            new Float32Array(p.vertexCount).fill(i),
            1
          )
        );

        geom.boundingBox = this.bounds[i].clone();
        geom.computeBoundingSphere();

        const pickMesh = new THREE.Mesh(geom);
        pickMesh.matrixAutoUpdate = false;
        this.pickers[i] = pickMesh;

        const list = groups.get(p.system) ?? [];
        list.push(geom);
        groups.set(p.system, list);
      });

      groups.forEach((geoms, system) => {
        const merged = mergeGeometries(geoms, false);
        if (!merged) return;

        const mat = this.materials.get(system);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.frustumCulled = false;
        mesh.userData = { system };
        scene.add(mesh);
        this.systemMeshes.set(system, mesh);
      });

      chunksLoaded++;
      if (onProgress) {
        onProgress(Math.round((chunksLoaded / totalChunks) * 100));
      }
    };

    // Parallel fetch with concurrency pool of 4
    let cursor = 0;
    const pool = Array.from({ length: 4 }, async () => {
      while (cursor < totalChunks) {
        const ci = cursor++;
        await loadSingleChunk(ci);
      }
    });

    await Promise.all(pool);
    this.isLoaded = true;
    this.updateVisibilityAndHalfDissection();
  }

  public updateVisibilityAndHalfDissection(): void {
    if (!this.stateData || !this.partTexture) return;

    this.parts.forEach((p, i) => {
      const center = this.centers[i];
      const isVisibleSystem = this.isSystemActive(p.system);

      let visible = isVisibleSystem;

      if (this.halfDissectionMode && visible) {
        // Anatomical Right (x > 0) shows Muscular system
        // Anatomical Left (x < 0) shows Skeletal system + translucent skin
        // Central Axis & Visceral Organs (Cardiovascular, Digestive, Respiratory, Nervous, Urinary) are shown fully
        if (p.system === 'muscular') {
          // Hide muscles on the left side (x < -0.01)
          if (center.x < -0.015) {
            visible = false;
          }
        } else if (p.system === 'skeletal' || p.system === 'connective') {
          // Hide bones on the muscular right side (x > 0.01)
          if (center.x > 0.015) {
            visible = false;
          }
        } else if (p.system === 'integumentary') {
          // Translucent skin silhouette on skeletal side
          if (center.x > 0.015) {
            visible = false;
          }
        }
      }

      this.stateData![i * 4 + 3] = visible ? 1.0 : 0.0;
    });

    this.partTexture.needsUpdate = true;
  }

  private isSystemActive(system: string): boolean {
    if (system === 'skeletal' || system === 'connective') return this.visibility.skeletal;
    if (system === 'muscular') return this.visibility.muscular;
    if (system === 'nervous' || system === 'brain' || system === 'sensory') return this.visibility.nervous;
    if (system === 'cardiac' || system === 'arterial' || system === 'venous') return this.visibility.cardiovascular;
    if (system === 'respiratory') return this.visibility.respiratory;
    if (system === 'digestive') return this.visibility.digestive;
    if (system === 'urinary') return this.visibility.urinary;
    if (system === 'lymphatic' || system === 'endocrine') return this.visibility.lymphatic;
    if (system === 'integumentary') return this.visibility.integumentary;
    return true;
  }

  public setSystemVisibility(system: SystemCategory, visible: boolean): void {
    if (system in this.visibility) {
      this.visibility[system] = visible;
      this.updateVisibilityAndHalfDissection();
    }
  }

  public setSystemOpacity(system: SystemCategory, opacity: number): void {
    if (system in this.opacity) {
      this.opacity[system] = opacity;

      // Update Three.js materials
      const updateMat = (sys: string) => {
        const mat = this.materials.get(sys);
        if (mat) {
          mat.opacity = opacity;
          mat.transparent = opacity < 0.99;
          mat.depthWrite = opacity >= 0.85;
        }
      };

      if (system === 'cardiovascular') {
        updateMat('cardiac');
        updateMat('arterial');
        updateMat('venous');
      } else if (system === 'nervous') {
        updateMat('nervous');
        updateMat('brain');
        updateMat('sensory');
      } else if (system === 'skeletal') {
        updateMat('skeletal');
        updateMat('connective');
      } else {
        updateMat(system);
      }
    }
  }

  public selectPart(partIndex: number): void {
    if (!this.selectionData || !this.selectionTexture) return;

    // Reset old selection
    this.selectionData.fill(0);

    if (partIndex >= 0 && partIndex < this.parts.length) {
      this.selectedPartIndex = partIndex;
      this.selectionData[partIndex * 4] = 255;
    } else {
      this.selectedPartIndex = -1;
    }

    this.selectionTexture.needsUpdate = true;
  }

  public raycast(raycaster: THREE.Raycaster): number {
    let nearest = Infinity;
    let found = -1;
    const hitPoint = new THREE.Vector3();
    const worldBox = new THREE.Box3();

    this.pickers.forEach((mesh, i) => {
      if (!mesh || this.stateData![i * 4 + 3] < 0.5) return;
      worldBox.copy(this.bounds[i]);
      if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;

      const hits = raycaster.intersectObject(mesh, false);
      if (hits[0] && hits[0].distance < nearest) {
        nearest = hits[0].distance;
        found = i;
      }
    });

    return found;
  }

  public findPartByConceptOrName(query: string): number {
    const q = query.toLowerCase().trim();
    return this.parts.findIndex(
      (p) =>
        p.conceptId.toLowerCase() === q ||
        p.name.toLowerCase().includes(q)
    );
  }

  public dispose(): void {
    this.pickers.forEach((p) => p?.geometry.dispose());
    this.systemMeshes.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.materials.forEach((m) => m.dispose());
    this.partTexture?.dispose();
    this.selectionTexture?.dispose();
  }
}
