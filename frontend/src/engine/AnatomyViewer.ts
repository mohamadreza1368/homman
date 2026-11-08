import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AnatomicalStructure, ClippingState, HeartAnimationConfig } from '../types/anatomy';
import { ZAnatomyLoader, type ZSystemId } from './ZAnatomyLoader';

export interface ViewerOptions {
  container: HTMLDivElement;
  onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  onLoadingProgress?: (percent: number) => void;
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

// Verified 3D anatomical landmarks mapped to authentic FMA IDs
export const DEFAULT_CALLOUTS: AnatomicalCallout[] = [
  { id: 'FMA5018', query: 'brain', labelEn: 'Cerebrum', labelFa: 'مغز (مخ)', system: 'Nervous', worldPos: new THREE.Vector3(-0.02, 1.62, 0.05) },
  { id: 'FMA7195', query: 'lung', labelEn: 'Lungs', labelFa: 'ریه‌ها', system: 'Respiratory', worldPos: new THREE.Vector3(0.09, 1.34, 0.04) },
  { id: 'FMA7088', query: 'heart', labelEn: 'Heart', labelFa: 'قلب', system: 'Circulatory', worldPos: new THREE.Vector3(0.025, 1.28, 0.04) },
  { id: 'FMA7199', query: 'liver', labelEn: 'Liver', labelFa: 'کبد', system: 'Digestive', worldPos: new THREE.Vector3(-0.06, 1.10, 0.05) },
  { id: 'FMA7148', query: 'stomach', labelEn: 'Stomach', labelFa: 'معده', system: 'Digestive', worldPos: new THREE.Vector3(0.04, 1.15, 0.04) },
  { id: 'FMA7201_L', query: 'kidney.l', labelEn: 'Left Kidney', labelFa: 'کلیه چپ', system: 'Urinary', worldPos: new THREE.Vector3(0.065, 1.05, 0.02) },
  { id: 'FMA9915', query: 'femur', labelEn: 'Femur', labelFa: 'استخوان ران', system: 'Skeletal', worldPos: new THREE.Vector3(0.10, 0.65, 0.0) },
  { id: 'BICEPS', query: 'biceps', labelEn: 'Biceps Brachii', labelFa: 'عضله دوسر بازو', system: 'Muscular', worldPos: new THREE.Vector3(-0.24, 1.25, 0.02) },
  { id: 'LYMPHATIC', query: 'lymph', labelEn: 'Lymphatic', labelFa: 'سیستم لنفاوی', system: 'Lymphatic', worldPos: new THREE.Vector3(0.20, 1.02, 0.0) },
];

export class AnatomyViewer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public zAnatomyLoader: ZAnatomyLoader;

  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  private onLoadingProgress?: (percent: number) => void;

  // Track pointer for distinguishing clicks from camera rotation
  private pointerDownPos = { x: 0, y: 0 };
  private onContextMenu: (e: MouseEvent) => void;

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

  // Beating Heart Simulation
  public heartConfig: HeartAnimationConfig = {
    isBeating: true,
    bpm: 72,
  };

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onStructureSelect = options.onStructureSelect;
    this.onLoadingProgress = options.onLoadingProgress;

    // 1. Scene
    (window as unknown as { THREE: unknown }).THREE = THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17); // Deep medical charcoal slate

    // 2. Camera: Focused on human body height (1.70m, center at Y = 0.85m)
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    this.camera.position.set(0, 0.88, 2.45);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.20;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls: Full Pan, Zoom, and Rotation
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0.85, 0);
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6.0;
    
    // Enable Screen-Space Panning (Up/Down, Left/Right)
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

    // Prevent context menu on right click so right-drag pan works seamlessly
    this.onContextMenu = (e: MouseEvent) => e.preventDefault();
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);

    // 5. Lighting: Soft medical studio illumination with ambient occlusion
    this.setupLighting();

    // 6. Z-Anatomy 3D Loader
    this.zAnatomyLoader = new ZAnatomyLoader();

    // 7. Event listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    // 8. Load the authentic Z-Anatomy structures
    this.zAnatomyLoader
      .loadAll(this.scene, (progress) => {
        if (this.onLoadingProgress) {
          this.onLoadingProgress(progress);
        }
      })
      .catch((err) => {
        console.error('Failed loading Z-Anatomy models:', err);
      });

    // 9. Start render loop
    this.animate();
  }

  private setupLighting() {
    // Hemispherical skylight gives biological soft ambient gradients
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.15);
    this.scene.add(hemiLight);

    // Soft frontal clinical light
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.1);
    frontLight.position.set(0, 1.6, 3.2);
    this.scene.add(frontLight);

    // Key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2.2, 3.0, 2.2);
    this.scene.add(keyLight);

    // Fill light with subtle cool undertone
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    fillLight.position.set(-2.2, 1.8, 1.8);
    this.scene.add(fillLight);

    // Rim light to outline silhouette
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(0, 1.2, -2.8);
    this.scene.add(rimLight);

    // Subtle dark circular examination platform beneath feet
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
    this.zAnatomyLoader.allMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.clippingPlanes = activePlanes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
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
      // Reset all cardiac mesh scales and positions precisely to original
      this.zAnatomyLoader.cardiacMeshes.forEach((item) => {
        item.mesh.position.copy(item.originalPosition);
        item.mesh.scale.copy(item.originalScale);
      });
    }
  }

  public focusOnHeart() {
    this.selectAndFocusStructure('FMA7088');
    const C = this.zAnatomyLoader.cardiacCenter;
    this.camera.position.set(C.x, C.y, C.z + 0.60);
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
    if (dist < 0.25 && factor > 0) return;
    if (dist > 5.5 && factor < 0) return;

    const moveStep = dir.normalize().multiplyScalar(factor * 0.25);
    this.camera.position.add(moveStep);
    this.controls.update();
  }

  public resetView() {
    this.camera.position.set(0, 0.88, 2.45);
    this.controls.target.set(0, 0.85, 0);
    this.controls.update();
  }

  public setPanMode(enabled: boolean) {
    this.controls.mouseButtons.LEFT = enabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  public setExplodeView(factor: number) {
    const center = new THREE.Vector3(0, 0.85, 0);
    this.zAnatomyLoader.structures.forEach((st) => {
      const dir = st.center.clone().sub(center).normalize();
      st.mesh.position.copy(dir.multiplyScalar(factor * 0.25));
    });
  }

  public isolateStructure(name: string) {
    const matches = this.zAnatomyLoader.findStructures(name);
    if (matches.length === 0) return;

    this.zAnatomyLoader.isolateStructures(matches);

    // Center camera on isolated structure
    const box = new THREE.Box3();
    matches.forEach((m) => box.expandByObject(m.mesh));
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);
  }

  public clearIsolation() {
    this.zAnatomyLoader.clearIsolation();
  }

  public setSystemVisibility(systemCategory: string, visible: boolean) {
    const sysLower = systemCategory.toLowerCase() as ZSystemId;
    this.zAnatomyLoader.setSystemVisibility(sysLower, visible);
  }

  public setSystemOpacity(systemCategory: string, opacity: number) {
    const sysLower = systemCategory.toLowerCase() as ZSystemId;
    this.zAnatomyLoader.setSystemOpacity(sysLower, opacity);
  }

  public setHalfDissection(enabled: boolean) {
    this.zAnatomyLoader.setHalfDissection(enabled);
  }

  /**
   * Universal selection and focus logic:
   * Handles multi-mesh organs (e.g. Heart ventricles + atria, Lung lobes, Kidneys, Brain gyri)
   */
  public selectAndFocusStructure(query: string) {
    if (!this.zAnatomyLoader.isLoaded) return;

    const matches = this.zAnatomyLoader.findStructures(query);
    if (matches.length === 0) return;

    // Highlight all matching meshes
    this.zAnatomyLoader.highlightStructures(matches);

    // Calculate center
    const box = new THREE.Box3();
    matches.forEach((m) => box.expandByObject(m.mesh));
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);

    // Resolve FMA ID and bilingual info
    const primary = matches[0];
    const qLower = query.toLowerCase();
    const cleanLower = primary.cleanName.toLowerCase();

    let fmaId = primary.name;
    let nameEn = primary.cleanName;
    let nameFa = primary.cleanName;
    let system = primary.system.toUpperCase() as AnatomicalStructure['systemCategory'];

    const isBrainVentricle = cleanLower.includes('lateral ventricle') || cleanLower.includes('third ventricle') || cleanLower.includes('fourth ventricle');

    if (isBrainVentricle) {
      fmaId = 'FMA242784';
      nameEn = primary.cleanName;
      nameFa = 'بطن جانبی مغز (حفرات مایع مغزی-نخاعی)';
      system = 'NERVOUS' as never;
    } else if (
      (qLower.includes('heart') || qLower.includes('fma7088') || cleanLower.includes('left ventricle') || cleanLower.includes('right ventricle') || cleanLower.includes('atrium')) &&
      !isBrainVentricle
    ) {
      fmaId = 'FMA7088';
      nameEn = 'Heart (Myocardium & Chambers)';
      nameFa = 'قلب (حفرات بطن و دهلیز)';
      system = 'CIRCULATORY' as never;
    } else if (qLower.includes('kidney.l') || qLower.includes('fma7201_l') || (cleanLower.includes('kidney') && primary.side === 'l')) {
      fmaId = 'FMA7201_L';
      nameEn = 'Left Kidney';
      nameFa = 'کلیه چپ';
      system = 'URINARY' as never;
    } else if (qLower.includes('kidney.r') || qLower.includes('fma7201_r') || (cleanLower.includes('kidney') && primary.side === 'r')) {
      fmaId = 'FMA7201_R';
      nameEn = 'Right Kidney';
      nameFa = 'کلیه راست';
      system = 'URINARY' as never;
    } else if (qLower.includes('kidney') || cleanLower.includes('kidney')) {
      fmaId = 'FMA7201_L';
      nameEn = 'Kidney';
      nameFa = 'کلیه';
      system = 'URINARY' as never;
    } else if (qLower.includes('lung') || qLower.includes('fma7195') || cleanLower.includes('lung')) {
      fmaId = 'FMA7195';
      nameEn = 'Lungs (Pulmonary Lobes)';
      nameFa = 'ریه‌ها (دستگاه تنفس)';
      system = 'RESPIRATORY' as never;
    } else if (qLower.includes('brain') || qLower.includes('cerebr') || qLower.includes('fma5018') || cleanLower.includes('gyrus')) {
      fmaId = 'FMA5018';
      nameEn = 'Cerebrum (Brain)';
      nameFa = 'مغز (نیمکره‌های مخ)';
      system = 'NERVOUS' as never;
    } else if (qLower.includes('liver') || qLower.includes('fma7199') || cleanLower.includes('liver')) {
      fmaId = 'FMA7199';
      nameEn = 'Liver';
      nameFa = 'کبد';
      system = 'DIGESTIVE' as never;
    } else if (qLower.includes('stomach') || qLower.includes('fma7148') || cleanLower.includes('stomach')) {
      fmaId = 'FMA7148';
      nameEn = 'Stomach';
      nameFa = 'معده';
      system = 'DIGESTIVE' as never;
    } else if (qLower.includes('femur') || qLower.includes('fma9915') || cleanLower.includes('femur')) {
      fmaId = 'FMA9915';
      nameEn = 'Femur';
      nameFa = 'استخوان ران';
      system = 'SKELETAL' as never;
    }

    if (this.onStructureSelect) {
      this.onStructureSelect({
        fmaId,
        snomedBodyStructureId: 'Z_' + nameEn.replace(/\s+/g, '_'),
        nameEn,
        nameFa,
        systemCategory: system,
        genderModel: 'male',
        meshNodeName: primary.name,
        descriptionEn: `${nameEn} is an essential anatomical landmark in the human ${primary.system} system.`,
        descriptionFa: `عضو تشریحی ${nameFa} متعلق به سیستم ${primary.system} بدن انسان.`,
      });
    }
  }

  public focusOnStructure(query: string) {
    this.selectAndFocusStructure(query);
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
    // If pointer was dragged more than 5px, user was rotating/panning the camera!
    const dist = Math.hypot(
      event.clientX - this.pointerDownPos.x,
      event.clientY - this.pointerDownPos.y
    );
    if (dist > 5) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.zAnatomyLoader.isLoaded) {
      const hitInfo = this.zAnatomyLoader.raycast(this.raycaster);
      if (hitInfo) {
        this.selectAndFocusStructure(hitInfo.name);
      } else {
        // User clicked on empty background -> Deselect!
        this.resetSelection();
      }
    }
  }

  public resetSelection() {
    this.clearIsolation();
    this.zAnatomyLoader.clearHighlight();
    if (this.onStructureSelect) {
      this.onStructureSelect(null);
    }
  }

  private onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const elapsedTime = this.clock.getElapsedTime();

    // Physiological Wiggers Beating Heart Simulation
    // Scaled radially around the exact anatomical heart center (C)
    if (this.heartConfig.isBeating && this.zAnatomyLoader.cardiacMeshes.length > 0) {
      const bpm = this.heartConfig.bpm;
      const cycleSeconds = 60 / bpm;
      const t = (elapsedTime % cycleSeconds) / cycleSeconds; // 0.0 to 1.0

      // Natural physiological cardiac wave:
      // Ventricles contract ~5% in systole, atria expand slightly, then relax in diastole
      let ventricleScale = 1.0;
      let atriumScale = 1.0;
      let vesselScale = 1.0;

      if (t < 0.26) {
        // Systole: Rapid ventricular contraction (LUB)
        const s = Math.sin((t / 0.26) * Math.PI);
        ventricleScale = 1.0 - s * 0.075;
        vesselScale = 1.0 + s * 0.035;
        atriumScale = 1.0 + s * 0.03;
      } else if (t < 0.40) {
        // Isovolumetric relaxation (DUB)
        const s = Math.cos(((t - 0.26) / 0.14) * (Math.PI / 2));
        ventricleScale = 0.925 + (1 - s) * 0.055;
        vesselScale = 1.035 - (1 - s) * 0.035;
      } else if (t < 0.80) {
        // Diastole: Ventricular filling
        const d = Math.sin(((t - 0.40) / 0.40) * Math.PI);
        ventricleScale = 0.98 + d * 0.04;
        vesselScale = 1.0;
        atriumScale = 1.0;
      } else {
        // Atrial kick (Atrial Systole)
        const a = Math.sin(((t - 0.80) / 0.20) * Math.PI);
        atriumScale = 1.0 - a * 0.05;
        ventricleScale = 1.02 + a * 0.015;
      }

      const C = this.zAnatomyLoader.cardiacCenter;

      for (const item of this.zAnatomyLoader.cardiacMeshes) {
        let scale = 1.0;
        if (item.chamberType === 'ventricle') scale = ventricleScale;
        else if (item.chamberType === 'atrium') scale = atriumScale;
        else scale = vesselScale;

        // Radial pivot scaling around the exact heart center C:
        // Position offset: C * (1 - scale) + originalPosition * scale
        item.mesh.position.set(
          C.x * (1 - scale) + item.originalPosition.x * scale,
          C.y * (1 - scale) + item.originalPosition.y * scale,
          C.z * (1 - scale) + item.originalPosition.z * scale
        );
        item.mesh.scale.set(
          item.originalScale.x * scale,
          item.originalScale.y * scale,
          item.originalScale.z * scale
        );
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.zAnatomyLoader.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
