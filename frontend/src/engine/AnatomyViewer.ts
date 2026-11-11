import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  AnatomicalStructure,
  ClippingState,
  HeartAnimationConfig,
  RenderPerformanceSnapshot,
  VisualPresetType,
} from '../types/anatomy';
import { AtlasModelLoader, type SystemCategory } from './AtlasModelLoader';
import { ZAnatomyLoader, type ZSystemId } from './ZAnatomyLoader';
import {
  buildStructureFromRecord,
  buildUnmappedStructure,
  resolveCatalogRecord,
} from '../data/anatomyRegistry';
import { logRenderEvent } from '../utils/renderLogger';

export interface ViewerOptions {
  container: HTMLDivElement;
  onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  onLoadingProgress?: (percent: number, loadedBytes?: number, totalBytes?: number) => void;
  onLoadingError?: (messageFa: string | null) => void;
  initialLiteMode?: boolean;
}

export interface AnatomicalCallout {
  id: string;
  query: string;
  labelEn: string;
  labelFa: string;
  system: string;
  worldPos: THREE.Vector3;
}

export const CORTICAL_LOBE_COLORS = {
  frontal: 0x38bdf8,
  parietal: 0xa855f7,
  temporal: 0x10b981,
  occipital: 0xf59e0b,
};

// Verified 3D anatomical landmarks mapped to canonical FMA IDs
export const DEFAULT_CALLOUTS: AnatomicalCallout[] = [
  { id: 'FMA5018', query: 'FMA5018', labelEn: 'Cerebrum', labelFa: 'مغز (مخ)', system: 'Nervous', worldPos: new THREE.Vector3(-0.001, 1.635, -0.027) },
  { id: 'FMA7195', query: 'FMA7195', labelEn: 'Right Lung', labelFa: 'ریه راست و برونش‌ها', system: 'Respiratory', worldPos: new THREE.Vector3(-0.068, 1.305, 0.022) },
  { id: 'FMA7088', query: 'FMA7088', labelEn: 'Heart', labelFa: 'قلب', system: 'Circulatory', worldPos: new THREE.Vector3(0.021, 1.305, 0.023) },
  { id: 'FMA7199', query: 'FMA7199', labelEn: 'Liver & Biliary', labelFa: 'کبد و مجاری صفراوی', system: 'Digestive', worldPos: new THREE.Vector3(-0.011, 1.209, 0.022) },
  { id: 'FMA7148', query: 'FMA7148', labelEn: 'Stomach', labelFa: 'معده', system: 'Digestive', worldPos: new THREE.Vector3(0.038, 1.176, 0.038) },
  { id: 'FMA7201_L', query: 'FMA7201_L', labelEn: 'Left Kidney', labelFa: 'کلیه چپ', system: 'Urinary', worldPos: new THREE.Vector3(0.062, 1.116, -0.020) },
  { id: 'FMA9915', query: 'FMA9915', labelEn: 'Femur', labelFa: 'استخوان ران', system: 'Skeletal', worldPos: new THREE.Vector3(0.091, 0.679, -0.019) },
  { id: 'FMA37670', query: 'FMA37670', labelEn: 'Biceps Brachii', labelFa: 'عضله دوسر بازو', system: 'Muscular', worldPos: new THREE.Vector3(0.182, 1.245, -0.011) },
  { id: 'FMA7194', query: 'FMA7194', labelEn: 'Spleen (Lymphatic)', labelFa: 'طحال (سیستم لنفاوی)', system: 'Lymphatic', worldPos: new THREE.Vector3(0.085, 1.165, -0.006) },
  { id: 'FMA7163', query: 'FMA7163', labelEn: 'Integumentary', labelFa: 'پوست و کانتور سطحی', system: 'Integumentary', worldPos: new THREE.Vector3(0.18, 1.48, 0.08) },
];

export class AnatomyViewer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public atlasLoader: AtlasModelLoader;
  private fallbackLoader: ZAnatomyLoader | null = null;
  private activeBackend: 'BodyParts3D' | 'Z-Anatomy' = 'BodyParts3D';

  // Backward compatibility getter exposing whichever loader is active
  public get zAnatomyLoader() {
    return this.activeBackend === 'Z-Anatomy' && this.fallbackLoader
      ? this.fallbackLoader
      : this.atlasLoader;
  }

  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  private onLoadingProgress?: (percent: number, loadedBytes?: number, totalBytes?: number) => void;
  private onLoadingError?: (messageFa: string | null) => void;

  private pointerDownPos = { x: 0, y: 0 };
  private onContextMenu: (e: MouseEvent) => void;
  private onVisibilityChange: () => void;
  private onWebGLContextLost: (e: Event) => void;
  private onWebGLContextRestored: () => void;
  private intersectionObserver: IntersectionObserver | null = null;

  private isDocumentVisible = true;
  private isCanvasVisible = true;
  private isDisposed = false;
  public liteMode = false;

  // 3-Axis Clipping Planes
  public axialPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.0);
  public sagittalPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2.0);
  public coronalPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2.0);

  public clippingState: ClippingState = {
    axial: false,
    axialOffset: 1.25,
    sagittal: false,
    sagittalOffset: 0.0,
    coronal: false,
    coronalOffset: 0.0,
  };

  // Conceptual Educational Heart Animation
  public heartConfig: HeartAnimationConfig = {
    isBeating: true,
    bpm: 72,
  };

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onStructureSelect = options.onStructureSelect;
    this.onLoadingProgress = options.onLoadingProgress;
    this.onLoadingError = options.onLoadingError;
    this.liteMode = Boolean(options.initialLiteMode);

    // 1. Scene
    (window as unknown as { THREE: unknown }).THREE = THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);

    // 2. Camera framing entire standing human height cleanly below top navbar
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    this.camera.position.set(0, 0.92, 2.75);

    // 3. WebGL Renderer with Lite Mode DPR scaling
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.liteMode,
      powerPreference: this.liteMode ? 'default' : 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.applyPixelRatio();
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.20;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0.85, 0);
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6.0;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 1.0;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.onContextMenu = (e: MouseEvent) => e.preventDefault();
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);

    // WebGL Context resilience
    this.onWebGLContextLost = (e: Event) => {
      e.preventDefault();
      this.stopLoop();
      logRenderEvent('error', 'webgl', 'WebGL rendering context lost');
      this.onLoadingError?.('ارتباط گرافیکی مرورگر (WebGL) قطع شد. در حال بازیابی یا دکمه تلاش مجدد را بزنید.');
    };
    this.onWebGLContextRestored = () => {
      logRenderEvent('info', 'webgl', 'WebGL rendering context restored');
      this.onLoadingError?.(null);
      this.startLoop();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onWebGLContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onWebGLContextRestored);

    // Pause render loop when tab is hidden or viewport leaves screen
    this.onVisibilityChange = () => {
      this.isDocumentVisible = !document.hidden;
      if (this.isDocumentVisible && this.isCanvasVisible) {
        this.clock.getDelta();
        this.startLoop();
      } else {
        this.stopLoop();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        this.isCanvasVisible = entry ? entry.isIntersecting : true;
        if (this.isDocumentVisible && this.isCanvasVisible) {
          this.startLoop();
        } else {
          this.stopLoop();
        }
      });
      this.intersectionObserver.observe(this.container);
    }

    // 5. Studio lighting & platform
    this.setupLighting();

    // 6. Initialize Atlas Loader
    this.atlasLoader = new AtlasModelLoader();

    // 7. Pointer & resize listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    // 8. Start loading model dataset
    this.startModelLoad();

    // 9. Start render loop
    this.startLoop();
  }

  private applyPixelRatio() {
    const cap = this.liteMode ? 1.0 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(cap);
  }

  public setLiteMode(enabled: boolean) {
    this.liteMode = enabled;
    this.applyPixelRatio();
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    logRenderEvent('info', 'render_loop', `Lite mode ${enabled ? 'enabled' : 'disabled'}`, {
      pixelRatio: this.renderer.getPixelRatio(),
    });
  }

  private startModelLoad() {
    this.onLoadingError?.(null);

    this.atlasLoader
      .load(this.scene, (progress, loadedBytes, totalBytes) => {
        this.onLoadingProgress?.(progress, loadedBytes, totalBytes);
      })
      .then(() => {
        if (this.isDisposed) return;
        this.activeBackend = 'BodyParts3D';
        DEFAULT_CALLOUTS.forEach((callout) => {
          const center = this.atlasLoader.getCenterForQuery(callout.query);
          if (center && center.lengthSq() > 0) {
            callout.worldPos.copy(center);
          }
        });
      })
      .catch(async (err) => {
        if (this.isDisposed) return;
        const msg = err instanceof Error ? err.message : String(err);

        // If BodyParts3D manifest is missing (e.g. clean git clone without ignored binary chunks),
        // seamlessly fall back to GLB Z-Anatomy loader wired with DRACOLoader + KTX2Loader.
        if (msg.includes('Manifest unavailable (HTTP 404)')) {
          logRenderEvent('warn', 'asset_load', 'BodyParts3D manifest missing; switching to Z-Anatomy GLB fallback');
          try {
            this.activeBackend = 'Z-Anatomy';
            this.fallbackLoader = new ZAnatomyLoader();
            await this.fallbackLoader.loadAll(
              this.scene,
              (pct, loaded, total) => this.onLoadingProgress?.(pct, loaded, total),
              this.renderer
            );
            DEFAULT_CALLOUTS.forEach((callout) => {
              const matches = this.fallbackLoader?.findStructures(callout.query) ?? [];
              if (matches.length > 0) {
                callout.worldPos.copy(matches[0].center);
              }
            });
            return;
          } catch (fallbackErr) {
            logRenderEvent('error', 'asset_load', 'Z-Anatomy GLB fallback also failed', {
              error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
            });
          }
        }

        logRenderEvent('error', 'asset_load', 'Failed loading 3D anatomy atlas', { error: msg });
        this.onLoadingError?.(
          'بارگذاری مدل‌های سه‌بعدی با خطا مواجه شد. اتصال شبکه یا دسترسی فایل‌های مدل را بررسی کنید و دوباره تلاش کنید.'
        );
      });
  }

  public retryLoad() {
    if (this.atlasLoader.isLoaded || this.fallbackLoader?.isLoaded) return;
    this.atlasLoader.dispose();
    this.atlasLoader = new AtlasModelLoader();
    this.onLoadingProgress?.(0, 0, 0);
    this.startModelLoad();
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.15);
    this.scene.add(hemiLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.1);
    frontLight.position.set(0, 1.6, 3.2);
    this.scene.add(frontLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2.2, 3.0, 2.2);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    fillLight.position.set(-2.2, 1.8, 1.8);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(0, 1.2, -2.8);
    this.scene.add(rimLight);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.58, 0.02, 64),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.05 })
    );
    platform.position.y = -0.01;
    this.scene.add(platform);
  }

  private getActivePlanes(): THREE.Plane[] {
    const planes: THREE.Plane[] = [];
    if (this.clippingState.axial) planes.push(this.axialPlane);
    if (this.clippingState.sagittal) planes.push(this.sagittalPlane);
    if (this.clippingState.coronal) planes.push(this.coronalPlane);
    return planes;
  }

  private updateMaterialsClipping() {
    const activePlanes = this.getActivePlanes();
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      this.fallbackLoader.allMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.clippingPlanes = activePlanes;
        mat.clipShadows = true;
        mat.needsUpdate = true;
      });
    } else {
      this.atlasLoader.updateClippingPlanes(activePlanes);
    }
  }

  public setNeuroMode(enabled: boolean) {
    this.setSystemVisibility('nervous', enabled);
  }

  public setHeartBpm(bpm: number) {
    this.heartConfig.bpm = Math.max(30, Math.min(220, bpm));
  }

  public setClipping(stateOrEnabled: boolean | Partial<ClippingState>, offset?: number) {
    if (typeof stateOrEnabled === 'boolean') {
      this.setAxialClipping(stateOrEnabled, offset);
    } else {
      this.clippingState = { ...this.clippingState, ...stateOrEnabled };
      if (stateOrEnabled.axialOffset !== undefined) this.axialPlane.constant = stateOrEnabled.axialOffset;
      if (stateOrEnabled.sagittalOffset !== undefined) this.sagittalPlane.constant = stateOrEnabled.sagittalOffset;
      if (stateOrEnabled.coronalOffset !== undefined) this.coronalPlane.constant = stateOrEnabled.coronalOffset;
      this.updateMaterialsClipping();
    }
  }

  public setAxialClipping(enabled: boolean, offset: number = this.clippingState.axialOffset) {
    this.clippingState.axial = enabled;
    this.clippingState.axialOffset = offset;
    this.axialPlane.constant = offset;
    this.updateMaterialsClipping();
  }

  public setSagittalClipping(enabled: boolean, offset: number = this.clippingState.sagittalOffset) {
    this.clippingState.sagittal = enabled;
    this.clippingState.sagittalOffset = offset;
    this.sagittalPlane.constant = offset;
    this.updateMaterialsClipping();
  }

  public setCoronalClipping(enabled: boolean, offset: number = this.clippingState.coronalOffset) {
    this.clippingState.coronal = enabled;
    this.clippingState.coronalOffset = offset;
    this.coronalPlane.constant = offset;
    this.updateMaterialsClipping();
  }

  public setHeartBeating(enabled: boolean, bpm?: number) {
    this.heartConfig.isBeating = enabled;
    if (bpm !== undefined) {
      this.setHeartBpm(bpm);
    }
    if (!enabled) {
      this.atlasLoader.setCardiacScale(1.0);
    }
  }

  public focusOnHeart() {
    this.selectAndFocusStructure('FMA7088');
    const C =
      this.activeBackend === 'Z-Anatomy' && this.fallbackLoader
        ? this.fallbackLoader.cardiacCenter
        : this.atlasLoader.cardiacCenter;
    this.camera.position.set(C.x, C.y, C.z + 0.55);
    this.controls.target.copy(C);
    this.controls.update();
  }

  public panCamera(deltaX: number, deltaY: number) {
    const factor = 0.05 * Math.max(0.4, this.camera.position.distanceTo(this.controls.target));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    const offset = right.multiplyScalar(deltaX * factor).add(up.multiplyScalar(deltaY * factor));
    this.camera.position.add(offset);
    this.controls.target.add(offset);
    this.controls.update();
  }

  public zoomCamera(factor: number) {
    const dir = this.controls.target.clone().sub(this.camera.position);
    const dist = dir.length();
    if (dist < 0.20 && factor > 0) return;
    if (dist > 5.5 && factor < 0) return;

    const moveStep = dir.normalize().multiplyScalar(factor * 0.25);
    this.camera.position.add(moveStep);
    this.controls.update();
  }

  public resetView() {
    this.camera.position.set(0, 0.92, 2.75);
    this.controls.target.set(0, 0.86, 0);
    this.controls.update();
  }

  public setPanMode(enabled: boolean) {
    this.controls.mouseButtons.LEFT = enabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  public setExplodeView(factor: number) {
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      const center = new THREE.Vector3(0, 0.85, 0);
      this.fallbackLoader.structures.forEach((st) => {
        const dir = st.center.clone().sub(center).normalize();
        st.mesh.position.copy(dir.multiplyScalar(factor * 0.25));
      });
    } else if (this.atlasLoader.isLoaded) {
      this.atlasLoader.allMeshes.forEach((mesh) => {
        mesh.position.y = factor * 0.05;
      });
    }
  }

  public isolateStructure(idOrFmaOrQuery: string) {
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      const matches = this.fallbackLoader.findStructures(idOrFmaOrQuery);
      if (matches.length === 0) return;
      this.fallbackLoader.isolateStructures(matches);
      const box = new THREE.Box3();
      matches.forEach((m) => box.expandByObject(m.mesh));
      this.controls.target.copy(box.getCenter(new THREE.Vector3()));
      return;
    }

    if (!this.atlasLoader.isLoaded) return;
    const record = resolveCatalogRecord(idOrFmaOrQuery);
    if (record) {
      const center = this.atlasLoader.isolateRecord(record);
      if (center) {
        this.controls.target.copy(center);
        this.controls.update();
      }
      return;
    }

    if (idOrFmaOrQuery.startsWith('unmapped:')) {
      const partId = idOrFmaOrQuery.replace('unmapped:', '');
      const idx = this.atlasLoader.partIndexById.get(partId.toLowerCase());
      if (idx !== undefined) {
        const center = this.atlasLoader.isolatePartIndex(idx);
        if (center) {
          this.controls.target.copy(center);
          this.controls.update();
        }
      }
    }
  }

  public clearIsolation() {
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      this.fallbackLoader.clearIsolation();
    } else {
      this.atlasLoader.clearIsolation();
      this.atlasLoader.clearSelection();
    }
  }

  public applyEducationalPreset(
    recordIdOrFma: string,
    presetType: VisualPresetType | null
  ) {
    if (this.activeBackend === 'BodyParts3D' && this.atlasLoader.isLoaded) {
      const record = presetType ? resolveCatalogRecord(recordIdOrFma) : null;
      this.atlasLoader.applyVisualPreset(record, presetType);
    }
  }

  public clearEducationalPreset() {
    if (this.activeBackend === 'BodyParts3D' && this.atlasLoader.isLoaded) {
      this.atlasLoader.applyVisualPreset(null, null);
    }
  }

  public setSystemVisibility(systemCategory: string, visible: boolean) {
    const sysLower = (systemCategory === 'circulatory' ? 'cardiovascular' : systemCategory.toLowerCase()) as SystemCategory;
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      this.fallbackLoader.setSystemVisibility(sysLower as ZSystemId, visible);
    } else {
      this.atlasLoader.setSystemVisibility(sysLower, visible);
    }
  }

  public setSystemOpacity(systemCategory: string, opacity: number) {
    const sysLower = (systemCategory === 'circulatory' ? 'cardiovascular' : systemCategory.toLowerCase()) as SystemCategory;
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      this.fallbackLoader.setSystemOpacity(sysLower as ZSystemId, opacity);
    } else {
      this.atlasLoader.setSystemOpacity(sysLower, opacity);
    }
  }

  public setHalfDissection(enabled: boolean) {
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader) {
      this.fallbackLoader.setHalfDissection(enabled);
    } else {
      this.atlasLoader.setHalfDissection(enabled);
    }
  }

  /**
   * Canonical single-identity selection & focus flow via AnatomyRecord ID/FMA ID.
   */
  public selectAndFocusStructure(idOrFmaOrQuery: string) {
    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader?.isLoaded) {
      const rec = resolveCatalogRecord(idOrFmaOrQuery);
      const matches = this.fallbackLoader.findStructures(rec?.fmaId ?? idOrFmaOrQuery);
      if (matches.length === 0) return;
      this.fallbackLoader.highlightStructures(matches);
      const box = new THREE.Box3();
      matches.forEach((m) => box.expandByObject(m.mesh));
      this.controls.target.copy(box.getCenter(new THREE.Vector3()));
      if (this.onStructureSelect) {
        this.onStructureSelect(
          rec
            ? buildStructureFromRecord(rec, matches[0].name)
            : buildUnmappedStructure(matches[0].name, matches[0].cleanName, matches[0].system)
        );
      }
      return;
    }

    if (!this.atlasLoader.isLoaded) return;

    const record = resolveCatalogRecord(idOrFmaOrQuery);
    if (!record) return;

    const { center } = this.atlasLoader.selectRecord(record);
    if (center.lengthSq() > 0) {
      this.controls.target.copy(center);
      this.controls.update();
    }

    if (this.onStructureSelect) {
      this.onStructureSelect(buildStructureFromRecord(record));
    }
  }

  public focusOnStructure(idOrFmaOrQuery: string) {
    this.selectAndFocusStructure(idOrFmaOrQuery);
  }

  public setViewOrientation(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'isometric') {
    const target = new THREE.Vector3(0, 0.85, 0);
    this.controls.target.copy(target);
    const dist = 2.45;

    switch (view) {
      case 'front':
        this.camera.position.set(0, 0.88, dist);
        break;
      case 'back':
        this.camera.position.set(0, 0.88, -dist);
        break;
      case 'left':
        this.camera.position.set(-dist, 0.88, 0);
        break;
      case 'right':
        this.camera.position.set(dist, 0.88, 0);
        break;
      case 'top':
        this.camera.position.set(0, 3.2, 0.05);
        break;
      case 'isometric':
        this.camera.position.set(1.6, 1.8, 2.0);
        break;
    }
    this.camera.lookAt(target);
    this.controls.update();
  }

  public projectToScreen(worldPos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    if (!this.container) return { x: 0, y: 0, visible: false };
    const p = worldPos.clone().project(this.camera);
    const visible = p.z > -1 && p.z < 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      x: ((p.x + 1) * w) / 2,
      y: ((-p.y + 1) * h) / 2,
      visible,
    };
  }

  private onPointerDown(event: PointerEvent) {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  private onPointerUp(event: PointerEvent) {
    const dist = Math.hypot(
      event.clientX - this.pointerDownPos.x,
      event.clientY - this.pointerDownPos.y
    );
    if (dist > 5) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.activeBackend === 'Z-Anatomy' && this.fallbackLoader?.isLoaded) {
      const hit = this.fallbackLoader.raycast(this.raycaster);
      if (hit) {
        this.selectAndFocusStructure(hit.name);
      } else {
        this.resetSelection();
      }
      return;
    }

    if (this.atlasLoader.isLoaded) {
      const hitIndex = this.atlasLoader.raycast(this.raycaster);
      if (hitIndex >= 0) {
        const structure = this.atlasLoader.getStructureDetails(hitIndex);
        if (structure.isMappedToCatalog) {
          const rec = resolveCatalogRecord(structure.recordId);
          if (rec) {
            this.atlasLoader.selectRecord(rec);
          } else {
            this.atlasLoader.selectPart(hitIndex);
          }
        } else {
          this.atlasLoader.selectPart(hitIndex);
        }
        this.onStructureSelect?.(structure);
      } else {
        this.resetSelection();
      }
    }
  }

  public resetSelection() {
    this.clearIsolation();
    this.clearEducationalPreset();
    this.onStructureSelect?.(null);
  }

  public getPerformanceSnapshot(): RenderPerformanceSnapshot {
    const loaderStats = this.atlasLoader.getPerformanceStats();
    return {
      backend: this.activeBackend,
      chunksLoaded: loaderStats.chunksLoaded ?? 0,
      totalBytes: loaderStats.totalBytes ?? 0,
      downloadMs: loaderStats.downloadMs ?? 0,
      parseMs: loaderStats.parseMs ?? 0,
      meshCount: loaderStats.meshCount ?? 0,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      liteMode: this.liteMode,
    };
  }

  private onResize() {
    if (!this.container) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private startLoop() {
    if (this.animationFrameId !== null || this.isDisposed) return;
    this.animate();
  }

  private stopLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animate = () => {
    if (this.isDisposed || !this.isDocumentVisible || !this.isCanvasVisible) {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
    const elapsedTime = this.clock.getElapsedTime();

    // Conceptual Wiggers-like heartbeat cycle visualization on GPU
    if (this.heartConfig.isBeating && this.atlasLoader.isLoaded && this.activeBackend === 'BodyParts3D') {
      const bpm = this.heartConfig.bpm;
      const cycleSeconds = 60 / bpm;
      const t = (elapsedTime % cycleSeconds) / cycleSeconds;

      let cardiacScale = 1.0;
      if (t < 0.28) {
        const s = Math.sin((t / 0.28) * Math.PI);
        cardiacScale = 1.0 - s * 0.085;
      } else if (t < 0.42) {
        const s = Math.cos(((t - 0.28) / 0.14) * (Math.PI / 2));
        cardiacScale = 0.915 + (1.0 - s) * 0.065;
      } else if (t < 0.80) {
        const d = Math.sin(((t - 0.42) / 0.38) * Math.PI);
        cardiacScale = 0.98 + d * 0.04;
      } else {
        const a = Math.sin(((t - 0.80) / 0.20) * Math.PI);
        cardiacScale = 1.02 - a * 0.02;
      }

      this.atlasLoader.setCardiacScale(cardiacScale);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    this.isDisposed = true;
    this.stopLoop();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.intersectionObserver?.disconnect();
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onWebGLContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onWebGLContextRestored);
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.atlasLoader.dispose();
    this.fallbackLoader?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
