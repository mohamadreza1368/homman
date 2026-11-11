import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {
  AnatomicalStructure,
  AnatomyRecord,
  RenderPerformanceSnapshot,
  VisualPresetType,
} from '../types/anatomy';
import {
  buildStructureFromRecord,
  buildUnmappedStructure,
  getRecordByMeshName,
  resolveCatalogRecord,
} from '../data/anatomyRegistry';
import { logRenderEvent } from '../utils/renderLogger';

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
  skeletal: '#e2d9ba',
  muscular: '#a84c40',
  cardiac: '#be3a34',
  arterial: '#dc2626',
  venous: '#2563eb',
  nervous: '#eab308',
  brain: '#c084fc',
  sensory: '#38bdf8',
  respiratory: '#f472b6',
  digestive: '#d97706',
  urinary: '#0284c7',
  lymphatic: '#10b981',
  endocrine: '#8b5cf6',
  reproductive: '#f43f5e',
  integumentary: '#e5bba4',
  connective: '#cbd5e1',
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

const PRESET_TO_CODE: Record<VisualPresetType, number> = {
  pbr_inflammation: 1,
  pbr_ischemia: 2,
  morph_atrophy: 3,
  procedural_mass: 4,
  rig_fracture: 5,
};

// Priority chunk loading order: heart/thorax(8), viscera/resp(9), skin/skeleton(10,11,0,1), then peripheral regions
const PRIORITY_CHUNK_ORDER = [8, 9, 10, 11, 0, 1, 12, 13, 6, 7, 2, 3, 4, 5, 14];
const CHUNK_TIMEOUT_MS = 30_000;
const MAX_CHUNK_BYTES = 25 * 1024 * 1024;
const BRAIN_VENTRICLE_IDS = new Set(['FJ1730', 'FJ1731', 'FJ1752', 'FJ1767', 'FJ1814']);

export class AtlasModelLoader {
  public manifest: AtlasManifest | null = null;
  public parts: AtlasPart[] = [];
  public partIndexById = new Map<string, number>();
  public centers: THREE.Vector3[] = [];
  public bounds: THREE.Box3[] = [];
  public pickers: (THREE.Mesh | undefined)[] = [];
  public allMeshes: THREE.Mesh[] = [];
  public meshesBySystem: Map<string, THREE.Mesh[]> = new Map();
  public materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  // Physiological cardiac animation uniforms (educational conceptual pulse)
  public cardiacCenter = new THREE.Vector3(0.0214, 1.305, 0.0234);
  public cardiacScaleUniform = { value: 1.0 };

  private partTexture: THREE.DataTexture | null = null;
  private selectionTexture: THREE.DataTexture | null = null;
  private stateData: Float32Array | null = null;
  private selectionData: Uint8Array | null = null;
  private stateWidth = 1;

  public halfDissectionMode = true;
  public selectedPartIndex = -1;
  public isLoaded = false;
  public isIsolated = false;
  private isolatedIndices: Set<number> | null = null;
  private abortController: AbortController | null = null;
  private lastPerf: Partial<RenderPerformanceSnapshot> = {};

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
    integumentary: 0.18,
  };

  /**
   * Resolves URL safely across Windows download managers (IDM hijacks bare `.bin` returning 204 No Content).
   */
  private buildSafeChunkUrl(rawUrl: string): string {
    if (rawUrl.endsWith('.bin') && !rawUrl.includes('?')) {
      return `${rawUrl}?format=abuf`;
    }
    return rawUrl;
  }

  private async fetchArrayBufferWithProgress(
    url: string,
    expectedBytes: number,
    signal: AbortSignal,
    onBytesDelta: (delta: number) => void
  ): Promise<ArrayBuffer> {
    const safeUrl = this.buildSafeChunkUrl(url);
    const timeoutId = window.setTimeout(() => this.abortController?.abort(), CHUNK_TIMEOUT_MS);

    try {
      const res = await fetch(safeUrl, { signal });
      if (!res.ok || res.status === 204) {
        throw new Error(`HTTP ${res.status} while loading ${safeUrl}`);
      }

      const contentLenHeader = res.headers.get('content-length');
      const declaredLen = contentLenHeader ? Number(contentLenHeader) : expectedBytes;
      if (declaredLen > MAX_CHUNK_BYTES) {
        throw new Error(`Chunk ${safeUrl} exceeds max allowed buffer size (${declaredLen} bytes)`);
      }

      if (!res.body) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0) {
          throw new Error(`Empty response buffer (0 bytes) for ${safeUrl}`);
        }
        onBytesDelta(buf.byteLength);
        return buf;
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          received += value.byteLength;
          if (received > MAX_CHUNK_BYTES) {
            throw new Error(`Streamed chunk ${safeUrl} exceeded size guard`);
          }
          chunks.push(value);
          onBytesDelta(value.byteLength);
        }
      }

      if (received === 0) {
        throw new Error(`Empty streamed chunk (0 bytes) for ${safeUrl}`);
      }

      const merged = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return merged.buffer;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  public async load(
    scene: THREE.Scene,
    onProgress?: (percent: number, loadedBytes?: number, totalBytes?: number) => void
  ): Promise<void> {
    const startMs = performance.now();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const manifestRes = await fetch('/models/atlas.json', { signal });
    if (!manifestRes.ok) {
      throw new Error(`Manifest unavailable (HTTP ${manifestRes.status})`);
    }
    this.manifest = await manifestRes.json();
    if (!this.manifest) {
      throw new Error('Empty BodyParts3D manifest');
    }

    // Defensive normalization: ensure cerebral ventricles NEVER belong to cardiac even on raw upstream JSON
    this.parts = this.manifest.parts.map((p) => {
      if (BRAIN_VENTRICLE_IDS.has(p.id) && p.system === 'cardiac') {
        return { ...p, system: 'nervous' };
      }
      return p;
    });

    this.partIndexById.clear();
    this.parts.forEach((p, idx) => {
      this.partIndexById.set(p.id.toLowerCase(), idx);
    });

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
    this.partTexture.minFilter = THREE.NearestFilter;
    this.partTexture.magFilter = THREE.NearestFilter;
    this.partTexture.needsUpdate = true;

    this.selectionTexture = new THREE.DataTexture(
      this.selectionData,
      this.stateWidth,
      1
    );
    this.selectionTexture.minFilter = THREE.NearestFilter;
    this.selectionTexture.magFilter = THREE.NearestFilter;
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

    // Initialize state visibility BEFORE chunks stream in so progressive meshes render immediately
    this.updateVisibilityAndHalfDissection();

    // Create system materials with distinct shader program cache keys
    const distinctSystems = Array.from(new Set(this.parts.map((p) => p.system)));
    distinctSystems.forEach((sys) => {
      const colorHex = SYSTEM_COLORS[sys] || '#aebbb8';
      const isSkin = sys === 'integumentary';
      const isCardiac = sys === 'cardiac';

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        metalness: isSkin ? 0.02 : isCardiac ? 0.08 : 0.12,
        roughness: isSkin ? 0.52 : isCardiac ? 0.42 : 0.48,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSkin ? this.opacity.integumentary : 1.0,
        depthWrite: !isSkin,
        polygonOffset: isSkin,
        polygonOffsetFactor: isSkin ? -1.0 : 0.0,
        polygonOffsetUnits: isSkin ? -1.0 : 0.0,
      });

      mat.customProgramCacheKey = () =>
        isCardiac ? 'homman-atlas-cardiac-v3' : 'homman-atlas-standard-v3';

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.partState = { value: this.partTexture };
        shader.uniforms.selectionState = { value: this.selectionTexture };
        shader.uniforms.stateWidth = { value: this.stateWidth };

        if (isCardiac) {
          shader.uniforms.uCardiacScale = this.cardiacScaleUniform;
          shader.uniforms.uCardiacCenter = { value: this.cardiacCenter };
        }

        shader.vertexShader =
          'attribute float partIndex;\n' +
          'uniform sampler2D partState;\n' +
          'uniform sampler2D selectionState;\n' +
          'uniform float stateWidth;\n' +
          (isCardiac ? 'uniform float uCardiacScale;\nuniform vec3 uCardiacCenter;\n' : '') +
          'varying float vPartVisible;\n' +
          'varying vec3 vSelData;\n' +
          shader.vertexShader;

        const vertexTransformSnippet = isCardiac
          ? `#include <begin_vertex>
             vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
             vec4 state = texture2D(partState, stateUv);
             transformed += state.xyz;
             transformed = uCardiacCenter + (transformed - uCardiacCenter) * uCardiacScale;
             vPartVisible = state.w;
             vSelData = texture2D(selectionState, stateUv).rgb;`
          : `#include <begin_vertex>
             vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
             vec4 state = texture2D(partState, stateUv);
             transformed += state.xyz;
             vPartVisible = state.w;
             vSelData = texture2D(selectionState, stateUv).rgb;`;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          vertexTransformSnippet
        );

        shader.fragmentShader =
          'varying float vPartVisible;\n' +
          'varying vec3 vSelData;\n' +
          shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           if (vPartVisible < 0.5) discard;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           if (vSelData.b > 0.05) {
             int pType = int(floor(vSelData.g * 5.1 + 0.25));
             vec3 presetCol = vec3(0.94, 0.27, 0.27);
             if (pType == 2) presetCol = vec3(0.49, 0.23, 0.93);
             else if (pType == 3) presetCol = vec3(0.96, 0.62, 0.04);
             else if (pType == 4) presetCol = vec3(0.06, 0.72, 0.51);
             else if (pType == 5) presetCol = vec3(0.22, 0.74, 0.97);
             diffuseColor.rgb = mix(diffuseColor.rgb, presetCol, vSelData.b * 0.85);
           } else if (vSelData.r > 0.05) {
             vec3 glowColor = vec3(0.15, 0.75, 1.0);
             diffuseColor.rgb = mix(diffuseColor.rgb, glowColor, vSelData.r * 0.85);
           }`
        );
      };

      this.materials.set(sys, mat);
    });

    const totalChunks = this.manifest.chunks.length;
    const totalExpectedBytes = this.manifest.chunks.reduce((acc, c) => acc + (c.bytes || 0), 0);
    let loadedBytes = 0;
    let parseMsAccum = 0;

    // Order chunks with core cardiac/thoracic/skeletal structures first
    const orderedIndices = PRIORITY_CHUNK_ORDER.filter((idx) => idx < totalChunks);
    for (let i = 0; i < totalChunks; i++) {
      if (!orderedIndices.includes(i)) orderedIndices.push(i);
    }

    const loadSingleChunk = async (chunkIndex: number) => {
      const chunkInfo = this.manifest!.chunks[chunkIndex];
      const buffer = await this.fetchArrayBufferWithProgress(
        chunkInfo.url,
        chunkInfo.bytes || 4_500_000,
        signal,
        (delta) => {
          loadedBytes += delta;
          if (onProgress && totalExpectedBytes > 0) {
            const pct = Math.min(99, Math.round((loadedBytes / totalExpectedBytes) * 100));
            onProgress(pct, loadedBytes, totalExpectedBytes);
          }
        }
      );

      const parseStart = performance.now();
      const groups = new Map<string, THREE.BufferGeometry[]>();

      this.parts.forEach((p, i) => {
        if (p.chunk !== chunkIndex) return;

        const requiredPosBytes = p.positions + p.vertexCount * 12;
        if (requiredPosBytes > buffer.byteLength) {
          throw new Error(
            `Truncated buffer for part ${p.id} (chunk ${chunkIndex}: ${buffer.byteLength} < ${requiredPosBytes})`
          );
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3)
        );
        geom.setAttribute(
          'normal',
          new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true)
        );
        geom.setIndex(
          new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1)
        );
        geom.setAttribute(
          'partIndex',
          new THREE.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1)
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

        const currentList = this.meshesBySystem.get(system) ?? [];
        currentList.push(mesh);
        this.meshesBySystem.set(system, currentList);
        this.allMeshes.push(mesh);
      });

      parseMsAccum += performance.now() - parseStart;
    };

    let queuePos = 0;
    const workerPool = Array.from({ length: 4 }, async () => {
      while (queuePos < orderedIndices.length) {
        if (signal.aborted) return;
        const ci = orderedIndices[queuePos++];
        await loadSingleChunk(ci);
      }
    });

    await Promise.all(workerPool);

    if (signal.aborted) return;

    this.isLoaded = true;
    this.updateVisibilityAndHalfDissection();

    const totalMs = Math.round(performance.now() - startMs);
    this.lastPerf = {
      backend: 'BodyParts3D',
      chunksLoaded: totalChunks,
      totalBytes: loadedBytes,
      downloadMs: Math.max(0, totalMs - Math.round(parseMsAccum)),
      parseMs: Math.round(parseMsAccum),
      meshCount: this.allMeshes.length,
      triangles: this.manifest.triangles,
    };

    logRenderEvent('info', 'asset_load', 'BodyParts3D atlas loaded cleanly', {
      chunks: totalChunks,
      bytes: loadedBytes,
      totalMs,
      parseMs: Math.round(parseMsAccum),
      meshes: this.allMeshes.length,
    });

    if (onProgress) {
      onProgress(100, loadedBytes, totalExpectedBytes || loadedBytes);
    }
  }

  public getPerformanceStats(): Partial<RenderPerformanceSnapshot> {
    return this.lastPerf;
  }

  public setCardiacScale(scale: number): void {
    this.cardiacScaleUniform.value = scale;
  }

  public updateClippingPlanes(planes: THREE.Plane[]): void {
    this.materials.forEach((mat) => {
      mat.clippingPlanes = planes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
  }

  public updateVisibilityAndHalfDissection(): void {
    if (!this.stateData || !this.partTexture) return;

    this.parts.forEach((p, i) => {
      const center = this.centers[i];
      let visible = this.isSystemActive(p.system);

      if (this.isIsolated && this.isolatedIndices) {
        visible = this.isolatedIndices.has(i);
      } else if (this.halfDissectionMode && visible) {
        if (p.system === 'muscular' && center.x > 0.015) {
          visible = false;
        } else if ((p.system === 'skeletal' || p.system === 'connective') && center.x < -0.015) {
          visible = false;
        } else if (p.system === 'integumentary' && center.x < -0.015) {
          visible = false;
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

  public setHalfDissection(enabled: boolean): void {
    this.halfDissectionMode = enabled;
    this.updateVisibilityAndHalfDissection();
  }

  public setSystemOpacity(system: SystemCategory, opacity: number): void {
    if (system in this.opacity) {
      this.opacity[system] = opacity;

      const updateMat = (sys: string) => {
        const mat = this.materials.get(sys);
        if (mat) {
          mat.opacity = opacity;
          mat.transparent = opacity < 0.99;
          mat.depthWrite = opacity >= 0.85;
          mat.needsUpdate = true;
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

  private getIndicesForRecord(record: AnatomyRecord): number[] {
    const out: number[] = [];
    for (const meshId of record.meshNames) {
      const idx = this.partIndexById.get(meshId.toLowerCase());
      if (idx !== undefined) out.push(idx);
    }
    return out;
  }

  public selectPart(partIndex: number): void {
    if (!this.selectionData || !this.selectionTexture) return;
    this.selectionData.fill(0);

    if (partIndex >= 0 && partIndex < this.parts.length) {
      this.selectedPartIndex = partIndex;
      this.selectionData[partIndex * 4] = 255;
    } else {
      this.selectedPartIndex = -1;
    }
    this.selectionTexture.needsUpdate = true;
  }

  public selectRecord(record: AnatomyRecord): { indices: number[]; center: THREE.Vector3 } {
    const indices = this.getIndicesForRecord(record);
    const center = new THREE.Vector3();
    const box = new THREE.Box3();

    if (this.selectionData && this.selectionTexture) {
      // Preserve active educational preset channels (G,B) only on cleared R selection
      for (let i = 0; i < this.parts.length; i++) {
        this.selectionData[i * 4] = 0;
      }
      for (const idx of indices) {
        this.selectionData[idx * 4] = 255;
        box.union(this.bounds[idx]);
      }
      this.selectedPartIndex = indices[0] ?? -1;
      this.selectionTexture.needsUpdate = true;
    }

    if (!box.isEmpty()) {
      box.getCenter(center);
    }
    return { indices, center };
  }

  public applyVisualPreset(
    record: AnatomyRecord | null,
    presetType: VisualPresetType | null
  ): void {
    if (!this.selectionData || !this.selectionTexture) return;

    // Clear previous preset channels G, B across all parts
    for (let i = 0; i < this.parts.length; i++) {
      this.selectionData[i * 4 + 1] = 0;
      this.selectionData[i * 4 + 2] = 0;
    }

    if (record && presetType) {
      const code = PRESET_TO_CODE[presetType] ?? 1;
      const gByte = Math.round(code * 50);
      const indices = this.getIndicesForRecord(record);
      for (const idx of indices) {
        this.selectionData[idx * 4 + 1] = gByte;
        this.selectionData[idx * 4 + 2] = 225;
      }
    }

    this.selectionTexture.needsUpdate = true;
  }

  public isolateRecord(record: AnatomyRecord): THREE.Vector3 | null {
    const indices = this.getIndicesForRecord(record);
    if (indices.length === 0) return null;

    this.isIsolated = true;
    this.isolatedIndices = new Set(indices);
    this.updateVisibilityAndHalfDissection();

    const box = new THREE.Box3();
    indices.forEach((idx) => box.union(this.bounds[idx]));
    return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
  }

  public isolatePartIndex(partIndex: number): THREE.Vector3 | null {
    if (partIndex < 0 || partIndex >= this.parts.length) return null;
    this.isIsolated = true;
    this.isolatedIndices = new Set([partIndex]);
    this.updateVisibilityAndHalfDissection();
    return this.centers[partIndex].clone();
  }

  public clearIsolation(): void {
    this.isIsolated = false;
    this.isolatedIndices = null;
    this.updateVisibilityAndHalfDissection();
  }

  public clearSelection(): void {
    if (!this.selectionData || !this.selectionTexture) return;
    this.selectionData.fill(0);
    this.selectedPartIndex = -1;
    this.selectionTexture.needsUpdate = true;
  }

  public raycast(raycaster: THREE.Raycaster): number {
    let nearest = Infinity;
    let found = -1;
    const hitPoint = new THREE.Vector3();
    const worldBox = new THREE.Box3();

    this.pickers.forEach((mesh, i) => {
      if (!mesh || !this.stateData || this.stateData[i * 4 + 3] < 0.5) return;
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

  public getCenterForQuery(query: string): THREE.Vector3 | null {
    const record = resolveCatalogRecord(query);
    if (record) {
      const box = new THREE.Box3();
      for (const idx of this.getIndicesForRecord(record)) {
        box.union(this.bounds[idx]);
      }
      if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
    }
    return null;
  }

  /**
   * Resolves a clicked part index strictly through the canonical AnatomyCatalog Registry.
   * Unmapped minor structures are clearly flagged (isMappedToCatalog = false) so no invalid clinical claims appear.
   */
  public getStructureDetails(partIndex: number): AnatomicalStructure {
    const part = this.parts[partIndex];
    const mapped = getRecordByMeshName(part.id);
    if (mapped) {
      return buildStructureFromRecord(mapped, part.id);
    }
    return buildUnmappedStructure(part.id, part.name, part.system);
  }

  public dispose(): void {
    this.abortController?.abort();
    this.pickers.forEach((p) => p?.geometry.dispose());
    this.allMeshes.forEach((m) => {
      m.geometry.dispose();
    });
    this.materials.forEach((m) => m.dispose());
    this.partTexture?.dispose();
    this.selectionTexture?.dispose();
  }
}
