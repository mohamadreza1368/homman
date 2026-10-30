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

// Exact 3D anatomical landmarks on the Z-Anatomy body
export const DEFAULT_CALLOUTS: AnatomicalCallout[] = [
  { id: 'CEREBRUM', labelEn: 'Cerebrum', labelFa: 'مغز (مخ)', system: 'Nervous', worldPos: new THREE.Vector3(0.0, 1.62, 0.02) },
  { id: 'RESPIRATORY', labelEn: 'Respiratory', labelFa: 'دستگاه تنفس', system: 'Respiratory', worldPos: new THREE.Vector3(-0.08, 1.32, 0.02) },
  { id: 'BICEPS', labelEn: 'Biceps Brachii', labelFa: 'عضله دوسر بازو', system: 'Muscular', worldPos: new THREE.Vector3(-0.22, 1.25, 0.0) },
  { id: 'LIVER', labelEn: 'Liver', labelFa: 'کبد', system: 'Digestive', worldPos: new THREE.Vector3(-0.06, 1.10, 0.04) },
  { id: 'HEART', labelEn: 'Heart', labelFa: 'قلب', system: 'Circulatory', worldPos: new THREE.Vector3(0.02, 1.28, 0.04) },
  { id: 'LUNGS', labelEn: 'Lungs', labelFa: 'ریه‌ها', system: 'Respiratory', worldPos: new THREE.Vector3(0.08, 1.30, 0.03) },
  { id: 'KIDNEY', labelEn: 'Left Kidney', labelFa: 'کلیه چپ', system: 'Urinary', worldPos: new THREE.Vector3(0.07, 1.05, 0.02) },
  { id: 'LYMPHATIC', labelEn: 'Lymphatic', labelFa: 'سیستم لنفاوی', system: 'Lymphatic', worldPos: new THREE.Vector3(0.20, 1.02, 0.0) },
  { id: 'FEMUR', labelEn: 'Femur', labelFa: 'استخوان ران', system: 'Skeletal', worldPos: new THREE.Vector3(0.11, 0.65, 0.0) },
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
  private heartMesh: THREE.Mesh | null = null;
  private heartOriginalScale = new THREE.Vector3(1, 1, 1);

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onStructureSelect = options.onStructureSelect;
    this.onLoadingProgress = options.onLoadingProgress;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017); // Dark medical studio background

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
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0.85, 0);
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6.0;

    // 5. Lighting: High-contrast 3-point medical studio illumination
    this.setupLighting();

    // 6. Z-Anatomy 3D Loader
    this.zAnatomyLoader = new ZAnatomyLoader();

    // 7. Event listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 8. Load the authentic 2,914 Z-Anatomy structures
    this.zAnatomyLoader
      .loadAll(this.scene, (progress) => {
        if (this.onLoadingProgress) {
          this.onLoadingProgress(progress);
        }
        if (progress >= 100) {
          // Identify heart for beating animation
          const heartInfo = this.zAnatomyLoader.structures.find((s) =>
            s.name.toLowerCase().includes('heart')
          );
          if (heartInfo) {
            this.heartMesh = heartInfo.mesh;
            this.heartOriginalScale.copy(heartInfo.mesh.scale);
          }
        }
      })
      .catch((err) => {
        console.error('Failed loading Z-Anatomy models:', err);
      });

    // 9. Start render loop
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.75);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(0, -2, -3);
    this.scene.add(rimLight);

    // Subtle dark circular platform beneath feet
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.58, 0.02, 64),
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
    this.zAnatomyLoader.allMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.clippingPlanes = activePlanes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
  }

  public setNeuroMode(enabled: boolean) {
    // Show/focus on cerebrum and nervous system
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
    if (!enabled && this.heartMesh) {
      this.heartMesh.scale.copy(this.heartOriginalScale);
    }
  }

  public focusOnHeart() {
    this.focusOnStructure('Heart');
  }

  public setExplodeView(factor: number) {
    // Explode meshes radially outward from anatomical center
    const center = new THREE.Vector3(0, 0.85, 0);
    this.zAnatomyLoader.structures.forEach((st) => {
      const dir = st.center.clone().sub(center).normalize();
      st.mesh.position.copy(dir.multiplyScalar(factor * 0.25));
    });
  }

  public isolateStructure(name: string) {
    const target = this.zAnatomyLoader.findStructureByName(name);
    if (!target) return;

    this.zAnatomyLoader.structures.forEach((st) => {
      const mat = st.mesh.material as THREE.MeshStandardMaterial;
      if (st === target) {
        st.mesh.visible = true;
        mat.opacity = 1.0;
        mat.transparent = false;
      } else {
        mat.opacity = 0.08;
        mat.transparent = true;
      }
      mat.needsUpdate = true;
    });
  }

  public clearIsolation() {
    this.zAnatomyLoader.structures.forEach((st) => {
      const mat = st.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1.0;
      mat.transparent = false;
      mat.needsUpdate = true;
    });
    this.zAnatomyLoader.updateVisibilityAndHalfDissection();
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

  public focusOnStructure(query: string) {
    if (this.zAnatomyLoader.isLoaded) {
      const info = this.zAnatomyLoader.findStructureByName(query);
      if (info) {
        this.zAnatomyLoader.highlightStructure(info);
        this.controls.target.copy(info.center);
        if (this.onStructureSelect) {
          this.onStructureSelect({
            fmaId: info.name,
            snomedBodyStructureId: 'Z_' + info.cleanName,
            nameEn: info.cleanName,
            nameFa: info.cleanName,
            systemCategory: info.system.toUpperCase() as never,
            genderModel: 'male',
            meshNodeName: info.name,
            descriptionEn: `${info.cleanName} is a verified anatomical structure from the ${info.system} system.`,
            descriptionFa: `عضو تشریحی ${info.cleanName} در سیستم ${info.system} بدن انسان.`,
          });
        }
      }
    }
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.zAnatomyLoader.isLoaded) {
      const hitInfo = this.zAnatomyLoader.raycast(this.raycaster);
      if (hitInfo) {
        this.zAnatomyLoader.highlightStructure(hitInfo);
        const struct: AnatomicalStructure = {
          fmaId: hitInfo.name,
          snomedBodyStructureId: 'Z_' + hitInfo.cleanName,
          nameEn: hitInfo.cleanName,
          nameFa: hitInfo.cleanName,
          systemCategory: hitInfo.system.toUpperCase() as never,
          genderModel: 'male',
          meshNodeName: hitInfo.name,
          descriptionEn: `${hitInfo.cleanName} is an anatomical component of the human ${hitInfo.system} system.`,
          descriptionFa: `عضو تشریحی ${hitInfo.cleanName} متعلق به سیستم ${hitInfo.system} انسان.`,
        };
        if (this.onStructureSelect) {
          this.onStructureSelect(struct);
        }
      }
    }
  }

  public resetSelection() {
    this.clearIsolation();
    this.zAnatomyLoader.highlightStructure(null);
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
    this.zAnatomyLoader.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
