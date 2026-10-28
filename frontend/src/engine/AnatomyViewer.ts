import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMedicalAssetLoader } from './AssetLoader';
import type { AnatomicalStructure, ClippingState, HeartAnimationConfig } from '../types/anatomy';
import catalogData from '../data/anatomyCatalog.json';
import {
  createSkullGeometry,
  createMandibleGeometry,
  createSpineSegmentGeometry,
  createRibCageGeometry,
  createPelvisGeometry,
  createLongBoneGeometry,
  createHeartAnatomyGeometry,
  createLungAnatomyGeometry,
  createLiverAnatomyGeometry,
  createStomachAnatomyGeometry,
  createKidneyAnatomyGeometry,
  createBrainAnatomyGeometry,
} from './AnatomicalMeshes';
import { AtlasModelLoader, type SystemCategory } from './AtlasModelLoader';

export interface ViewerOptions {
  container: HTMLDivElement;
  onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  onLoadingProgress?: (percent: number) => void;
}

interface RawCatalogItem {
  fmaId: string;
  snomedBodyStructureId: string;
  nameEn: string;
  nameFa: string;
  systemCategory: string;
  genderModel: string;
  meshNodeName: string;
  bbox: number[];
}

const SYSTEM_COLORS: Record<string, number> = {
  Skeletal: 0xf1f5f9,     // Bone White
  Circulatory: 0xd9383a,  // Arterial Red
  Respiratory: 0x93c5fd,  // Lung Blue
  Digestive: 0xa16207,    // Visceral Amber
  Nervous: 0xec4899,      // Neural Pink
  Urinary: 0xeab308,      // Renal Gold
  Endocrine: 0x8b5cf6,    // Glandular Purple
  Lymphatic: 0x10b981     // Lymphatic Emerald
};

export const CORTICAL_LOBE_COLORS = {
  frontal: 0x38bdf8,
  parietal: 0xa855f7,
  temporal: 0x10b981,
  occipital: 0xf59e0b
};

export interface AnatomicalCallout {
  id: string;
  labelEn: string;
  labelFa: string;
  system: string;
  worldPos: THREE.Vector3;
}

export const DEFAULT_CALLOUTS: AnatomicalCallout[] = [
  { id: 'CEREBRUM', labelEn: 'Cerebrum', labelFa: 'مغز (مخ)', system: 'Nervous', worldPos: new THREE.Vector3(0.0, 1.70, 0.04) },
  { id: 'RESPIRATORY', labelEn: 'Respiratory', labelFa: 'دستگاه تنفس', system: 'Respiratory', worldPos: new THREE.Vector3(0.08, 1.37, 0.05) },
  { id: 'BICEPS', labelEn: 'Biceps Brachii', labelFa: 'عضله دوسر بازو', system: 'Muscular', worldPos: new THREE.Vector3(0.26, 1.25, 0.0) },
  { id: 'LIVER', labelEn: 'Liver', labelFa: 'کبد', system: 'Digestive', worldPos: new THREE.Vector3(0.08, 1.10, 0.05) },
  { id: 'HEART', labelEn: 'Heart', labelFa: 'قلب', system: 'Circulatory', worldPos: new THREE.Vector3(-0.04, 1.28, 0.05) },
  { id: 'LUNGS', labelEn: 'Lungs', labelFa: 'ریه‌ها', system: 'Respiratory', worldPos: new THREE.Vector3(-0.12, 1.30, 0.03) },
  { id: 'KIDNEY', labelEn: 'Left Kidney', labelFa: 'کلیه چپ', system: 'Urinary', worldPos: new THREE.Vector3(-0.08, 1.05, 0.02) },
  { id: 'LYMPHATIC', labelEn: 'Lymphatic', labelFa: 'سیستم لنفاوی', system: 'Lymphatic', worldPos: new THREE.Vector3(-0.23, 1.02, 0.0) },
  { id: 'FEMUR', labelEn: 'Femur', labelFa: 'استخوان ران', system: 'Skeletal', worldPos: new THREE.Vector3(-0.12, 0.65, 0.0) },
];

export class AnatomyViewer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public loader: ReturnType<typeof createMedicalAssetLoader>;
  public atlasLoader: AtlasModelLoader;

  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private interactiveMeshes: THREE.Mesh[] = [];
  private onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  private onLoadingProgress?: (percent: number) => void;
  private originalPositions = new Map<string, THREE.Vector3>();
  private originalMaterials = new Map<string, THREE.Material>();

  // 3-Axis Clipping Planes (Sagittal, Axial, Coronal)
  public axialPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.0);
  public sagittalPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2.0);
  public coronalPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2.0);

  public clippingState: ClippingState = {
    axial: false,
    axialOffset: 1.25,
    sagittal: false,
    sagittalOffset: 0.0,
    coronal: false,
    coronalOffset: 0.0
  };

  // Beating Heart Simulation
  public heartConfig: HeartAnimationConfig = {
    isBeating: true,
    bpm: 72
  };
  private heartMesh: THREE.Mesh | null = null;
  private heartOriginalScale = new THREE.Vector3(1, 1, 1);

  // Neuroanatomy Lobes Group
  private neuroGroup: THREE.Group | null = null;
  public isNeuroMode = false;

  // Structure isolation
  private isolatedFmaId: string | null = null;

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onStructureSelect = options.onStructureSelect;
    this.onLoadingProgress = options.onLoadingProgress;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017); // Dark aesthetic matching reference image

    // 2. Camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    this.camera.position.set(0, 1.05, 3.2);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 8.0;

    // 5. Lighting
    this.setupLighting();

    // 6. Asset Loader & Atlas Binary Loader
    this.loader = createMedicalAssetLoader(this.renderer);
    this.atlasLoader = new AtlasModelLoader();

    // 7. Event listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 8. Build anatomical structures
    this.buildCatalogMeshes();
    this.buildNeuroLobes();

    // 9. Load Authentic 2,234-mesh Anatomy Atlas in background
    this.atlasLoader
      .load(this.scene, (progress) => {
        if (this.onLoadingProgress) {
          this.onLoadingProgress(progress);
        }
        if (progress >= 100) {
          // Hide procedural placeholder meshes once real medical atlas is loaded
          this.interactiveMeshes.forEach((m) => {
            m.visible = false;
          });
        }
      })
      .catch((err) => {
        console.warn('Real atlas binary chunk streaming fallback:', err);
      });

    // 10. Start render loop
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.7);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(0, -2, -3);
    this.scene.add(rimLight);

    // Subtle dark circular platform beneath feet
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.72, 0.02, 64),
      new THREE.MeshStandardMaterial({ color: 0x161f2e, roughness: 0.8, metalness: 0.1 })
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
    this.interactiveMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.clippingPlanes = activePlanes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });

    if (this.neuroGroup) {
      this.neuroGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshStandardMaterial).clippingPlanes = activePlanes;
        }
      });
    }
  }

  private buildCatalogMeshes() {
    (catalogData as RawCatalogItem[]).forEach((item) => {
      if (item.fmaId === 'FMA7163' || item.systemCategory === 'Integumentary') {
        return;
      }

      const [minX, minY, minZ, maxX, maxY, maxZ] = item.bbox;
      const dx = Math.max(maxX - minX, 0.02);
      const dy = Math.max(maxY - minY, 0.02);
      const dz = Math.max(maxZ - minZ, 0.02);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      let geometry: THREE.BufferGeometry;

      if (item.fmaId === 'FMA5018_SKULL') {
        geometry = createSkullGeometry();
      } else if (item.fmaId === 'FMA52749') {
        geometry = createMandibleGeometry();
      } else if (item.fmaId === 'FMA13478') {
        geometry = createSpineSegmentGeometry(-0.05, 0.05, 7, 'cervical');
      } else if (item.fmaId === 'FMA13479') {
        geometry = createSpineSegmentGeometry(-0.12, 0.12, 12, 'thoracic');
      } else if (item.fmaId === 'FMA13480') {
        geometry = createSpineSegmentGeometry(-0.10, 0.10, 5, 'lumbar');
      } else if (item.fmaId === 'FMA7574') {
        geometry = createRibCageGeometry();
      } else if (item.fmaId === 'FMA16586') {
        geometry = createPelvisGeometry();
      } else if (item.fmaId.includes('FEMUR') || item.fmaId === 'FMA9915') {
        geometry = createLongBoneGeometry(0.44, 0.016, 0.025, true);
      } else if (item.fmaId === 'FMA16585') {
        geometry = createLongBoneGeometry(0.30, 0.014, 0.022, false);
      } else if (item.fmaId === 'FMA24476') {
        geometry = createLongBoneGeometry(0.38, 0.015, 0.024, false);
      } else if (item.fmaId === 'FMA24477') {
        geometry = createLongBoneGeometry(0.36, 0.009, 0.013, false);
      } else if (item.fmaId === 'FMA23466') {
        geometry = createLongBoneGeometry(0.24, 0.010, 0.015, false);
      } else if (item.fmaId === 'FMA23467') {
        geometry = createLongBoneGeometry(0.25, 0.011, 0.016, false);
      } else if (item.fmaId === 'FMA24467') {
        geometry = new THREE.SphereGeometry(0.022, 16, 16);
        geometry.scale(1.1, 1.2, 0.6);
      } else if (item.fmaId === 'FMA7088' || item.fmaId === 'FMA7197') {
        geometry = createHeartAnatomyGeometry();
      } else if (item.fmaId === 'FMA7195') {
        geometry = createLungAnatomyGeometry(true);
      } else if (item.fmaId === 'FMA7196') {
        geometry = createLungAnatomyGeometry(false);
      } else if (item.fmaId === 'FMA7199') {
        geometry = createLiverAnatomyGeometry();
      } else if (item.fmaId === 'FMA7148') {
        geometry = createStomachAnatomyGeometry();
      } else if (item.fmaId.includes('7201') || item.fmaId.includes('KIDNEY')) {
        geometry = createKidneyAnatomyGeometry();
      } else if (item.fmaId === 'FMA5018') {
        geometry = createBrainAnatomyGeometry();
      } else if (item.systemCategory === 'Skeletal' && dy > dx * 2) {
        geometry = new THREE.CylinderGeometry(dx / 3, dx / 2.5, dy, 16);
      } else if (item.systemCategory === 'Respiratory') {
        geometry = new THREE.CapsuleGeometry(dx / 2.5, Math.max(dy - dx, 0.05), 14, 24);
      } else {
        geometry = new THREE.SphereGeometry(Math.max(dx, dy, dz) / 2.2, 20, 20);
        geometry.scale(dx / Math.max(dx, 0.02), dy / Math.max(dy, 0.02), dz / Math.max(dz, 0.02));
      }

      const color = SYSTEM_COLORS[item.systemCategory] || 0xcbd5e1;
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: item.systemCategory === 'Skeletal' ? 0.3 : 0.45,
        metalness: 0.1,
        clippingPlanes: this.getActivePlanes(),
        clipShadows: true
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(centerX, centerY, centerZ);
      mesh.name = item.nameEn;

      const struct: AnatomicalStructure = {
        fmaId: item.fmaId,
        snomedBodyStructureId: item.snomedBodyStructureId,
        nameEn: item.nameEn,
        nameFa: item.nameFa,
        systemCategory: item.systemCategory as AnatomicalStructure['systemCategory'],
        genderModel: item.genderModel as 'male' | 'female' | 'both',
        meshNodeName: item.meshNodeName,
        descriptionEn: `${item.nameEn} belonging to the ${item.systemCategory} system.`,
        descriptionFa: `عضو ${item.nameFa} در سیستم ${item.systemCategory} انسان.`
      };

      mesh.userData = {
        fmaId: item.fmaId,
        systemCategory: item.systemCategory,
        structure: struct
      };

      if (item.fmaId === 'FMA7088' || item.nameEn.toLowerCase().includes('heart')) {
        this.heartMesh = mesh;
        this.heartOriginalScale = mesh.scale.clone();
      }

      this.scene.add(mesh);
      this.interactiveMeshes.push(mesh);
      this.originalPositions.set(item.fmaId, mesh.position.clone());
      this.originalMaterials.set(item.fmaId, material.clone());
    });
  }

  private buildNeuroLobes() {
    this.neuroGroup = new THREE.Group();
    this.neuroGroup.name = 'NeuroanatomyLobes';
    this.neuroGroup.position.set(0, 1.68, 0);

    const activePlanes = this.getActivePlanes();

    const frontalMat = new THREE.MeshStandardMaterial({
      color: CORTICAL_LOBE_COLORS.frontal,
      roughness: 0.35,
      clippingPlanes: activePlanes,
      clipShadows: true
    });
    const frontalGeom = new THREE.SphereGeometry(0.07, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3);
    frontalGeom.scale(1.0, 0.85, 1.15);
    const frontalMesh = new THREE.Mesh(frontalGeom, frontalMat);
    frontalMesh.position.set(0, 0.01, 0.025);
    frontalMesh.name = 'Frontal Lobe';
    this.neuroGroup.add(frontalMesh);

    const parietalMat = new THREE.MeshStandardMaterial({
      color: CORTICAL_LOBE_COLORS.parietal,
      roughness: 0.35,
      clippingPlanes: activePlanes,
      clipShadows: true
    });
    const parietalGeom = new THREE.SphereGeometry(0.068, 32, 16);
    parietalGeom.scale(0.95, 0.9, 0.9);
    const parietalMesh = new THREE.Mesh(parietalGeom, parietalMat);
    parietalMesh.position.set(0, 0.035, -0.035);
    parietalMesh.name = 'Parietal Lobe';
    this.neuroGroup.add(parietalMesh);

    const temporalMat = new THREE.MeshStandardMaterial({
      color: CORTICAL_LOBE_COLORS.temporal,
      roughness: 0.35,
      clippingPlanes: activePlanes,
      clipShadows: true
    });
    const tempGeom = new THREE.CapsuleGeometry(0.03, 0.05, 8, 16);
    const temporalRight = new THREE.Mesh(tempGeom, temporalMat);
    temporalRight.rotation.z = Math.PI / 2.5;
    temporalRight.position.set(0.06, -0.025, 0.0);
    this.neuroGroup.add(temporalRight);

    const temporalLeft = new THREE.Mesh(tempGeom, temporalMat);
    temporalLeft.rotation.z = -Math.PI / 2.5;
    temporalLeft.position.set(-0.06, -0.025, 0.0);
    this.neuroGroup.add(temporalLeft);

    const occipitalMat = new THREE.MeshStandardMaterial({
      color: CORTICAL_LOBE_COLORS.occipital,
      roughness: 0.35,
      clippingPlanes: activePlanes,
      clipShadows: true
    });
    const occipitalGeom = new THREE.SphereGeometry(0.045, 24, 16);
    occipitalGeom.scale(1.1, 0.8, 0.7);
    const occipitalMesh = new THREE.Mesh(occipitalGeom, occipitalMat);
    occipitalMesh.position.set(0, -0.02, -0.07);
    occipitalMesh.name = 'Occipital Lobe';
    this.neuroGroup.add(occipitalMesh);

    this.neuroGroup.visible = false;
    this.scene.add(this.neuroGroup);
  }

  public setNeuroMode(enabled: boolean) {
    this.isNeuroMode = enabled;
    if (this.neuroGroup) {
      this.neuroGroup.visible = enabled;
    }
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
    if (!enabled && this.heartMesh) {
      this.heartMesh.scale.copy(this.heartOriginalScale);
    }
  }

  public focusOnHeart() {
    this.focusOnStructure('FMA7088');
  }

  public setExplodeView(factor: number) {
    this.interactiveMeshes.forEach((mesh) => {
      const orig = this.originalPositions.get(mesh.userData.fmaId);
      if (orig) {
        const offset = orig.clone().normalize().multiplyScalar(factor * 0.35);
        mesh.position.copy(orig).add(offset);
      }
    });
  }

  public isolateStructure(fmaId: string) {
    this.isolatedFmaId = fmaId;
    this.interactiveMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.userData.fmaId === fmaId) {
        mesh.visible = true;
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.emissive.setHex(0x38bdf8);
        mat.emissiveIntensity = 0.6;
      } else {
        mesh.visible = true;
        mat.transparent = true;
        mat.opacity = 0.12;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
      mat.needsUpdate = true;
    });
  }

  public clearIsolation() {
    this.isolatedFmaId = null;
    this.interactiveMeshes.forEach((mesh) => {
      const orig = this.originalMaterials.get(mesh.userData.fmaId);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (orig) {
        mat.color.copy((orig as THREE.MeshStandardMaterial).color);
      }
      mat.transparent = false;
      mat.opacity = 1.0;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0.0;
      mat.needsUpdate = true;
    });
  }

  public setSystemVisibility(systemCategory: string, visible: boolean) {
    // Map to atlas loader
    const sysLower = systemCategory.toLowerCase() as SystemCategory;
    this.atlasLoader.setSystemVisibility(sysLower, visible);

    // Fallback meshes
    this.interactiveMeshes.forEach((mesh) => {
      if (mesh.userData.systemCategory.toLowerCase() === systemCategory.toLowerCase()) {
        mesh.visible = visible;
      }
    });
  }

  public setSystemOpacity(systemCategory: string, opacity: number) {
    const sysLower = systemCategory.toLowerCase() as SystemCategory;
    this.atlasLoader.setSystemOpacity(sysLower, opacity);
  }

  public setHalfDissection(enabled: boolean) {
    this.atlasLoader.halfDissectionMode = enabled;
    this.atlasLoader.updateVisibilityAndHalfDissection();
  }

  public focusOnStructure(fmaId: string) {
    // Check atlas loader first
    if (this.atlasLoader.isLoaded) {
      const idx = this.atlasLoader.findPartByConceptOrName(fmaId);
      if (idx >= 0) {
        this.atlasLoader.selectPart(idx);
        const part = this.atlasLoader.parts[idx];
        const center = this.atlasLoader.centers[idx];
        this.controls.target.copy(center);
        if (this.onStructureSelect) {
          this.onStructureSelect({
            fmaId: part.conceptId,
            snomedBodyStructureId: 'SNOMED_' + part.conceptId,
            nameEn: part.name,
            nameFa: part.name,
            systemCategory: part.system.toUpperCase() as never,
            genderModel: 'male',
            meshNodeName: part.id,
            descriptionEn: `${part.name} belonging to ${part.system} system.`,
            descriptionFa: `عضو ${part.name} از سیستم ${part.system}.`
          });
        }
        return;
      }
    }

    const mesh = this.interactiveMeshes.find((m) => m.userData.structure?.fmaId === fmaId);
    if (mesh) {
      this.highlightMesh(mesh);
      if (this.onStructureSelect) {
        this.onStructureSelect(mesh.userData.structure);
      }
      this.controls.target.copy(mesh.position);
    }
  }

  public setViewOrientation(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'isometric') {
    const target = new THREE.Vector3(0, 0.95, 0);
    this.controls.target.copy(target);
    const dist = 3.2;

    switch (view) {
      case 'front':
        this.camera.position.set(0, 0.95, dist);
        break;
      case 'back':
        this.camera.position.set(0, 0.95, -dist);
        break;
      case 'left':
        this.camera.position.set(-dist, 0.95, 0);
        break;
      case 'right':
        this.camera.position.set(dist, 0.95, 0);
        break;
      case 'top':
        this.camera.position.set(0, 3.5, 0.05);
        break;
      case 'isometric':
        this.camera.position.set(2.0, 2.2, 2.5);
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
      visible
    };
  }

  private onPointerDown(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check authentic Atlas Model Loader
    if (this.atlasLoader.isLoaded) {
      const hitPartIndex = this.atlasLoader.raycast(this.raycaster);
      if (hitPartIndex >= 0) {
        this.atlasLoader.selectPart(hitPartIndex);
        const p = this.atlasLoader.parts[hitPartIndex];
        const struct: AnatomicalStructure = {
          fmaId: p.conceptId,
          snomedBodyStructureId: 'SNOMED_' + p.conceptId,
          nameEn: p.name,
          nameFa: p.name,
          systemCategory: p.system.toUpperCase() as never,
          genderModel: 'male',
          meshNodeName: p.id,
          descriptionEn: `${p.name} from the ${p.system} anatomical layer.`,
          descriptionFa: `عضو ${p.name} در سیستم تشریحی ${p.system}.`
        };
        if (this.onStructureSelect) {
          this.onStructureSelect(struct);
        }
        return;
      }
    }

    // 2. Fallback to interactive meshes
    const visibleMeshes = this.interactiveMeshes.filter((m) => m.visible);
    const intersects = this.raycaster.intersectObjects(visibleMeshes, false);

    if (intersects.length > 0) {
      const selectedMesh = intersects[0].object as THREE.Mesh;
      const structure = selectedMesh.userData.structure as AnatomicalStructure;

      this.highlightMesh(selectedMesh);

      if (this.onStructureSelect) {
        this.onStructureSelect(structure);
      }
    }
  }

  private highlightMesh(mesh: THREE.Mesh) {
    this.interactiveMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (m === mesh) {
        mat.emissive.setHex(0x38bdf8);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
    });
  }

  public resetSelection() {
    this.clearIsolation();
    this.atlasLoader.selectPart(-1);
    this.interactiveMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0.0;
    });
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

    // Physiological Beating Heart Animation
    if (this.heartConfig.isBeating && this.heartMesh) {
      const bpm = this.heartConfig.bpm;
      const cycleFrequency = (bpm / 60) * Math.PI * 2;
      const phase = elapsedTime * cycleFrequency;

      const systoleWave = Math.sin(phase) + 0.35 * Math.sin(phase * 2);
      const scaleMultiplier = 1.0 + systoleWave * 0.07;
      const heightMultiplier = 1.0 - systoleWave * 0.05;

      this.heartMesh.scale.set(
        this.heartOriginalScale.x * scaleMultiplier,
        this.heartOriginalScale.y * heightMultiplier,
        this.heartOriginalScale.z * scaleMultiplier
      );
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.atlasLoader.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
