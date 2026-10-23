import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMedicalAssetLoader } from './AssetLoader';
import type { AnatomicalStructure } from '../types/anatomy';
import catalogData from '../data/anatomyCatalog.json';

export interface ViewerOptions {
  container: HTMLDivElement;
  onStructureSelect?: (structure: AnatomicalStructure | null) => void;
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

export class AnatomyViewer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public loader: ReturnType<typeof createMedicalAssetLoader>;

  private container: HTMLDivElement;
  private animationFrameId: number | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private interactiveMeshes: THREE.Mesh[] = [];
  private onStructureSelect?: (structure: AnatomicalStructure | null) => void;
  private originalPositions = new Map<string, THREE.Vector3>();

  // Slicing clipping plane
  public clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.0);
  public clippingEnabled = false;

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onStructureSelect = options.onStructureSelect;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);

    // 2. Camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 50);
    this.camera.position.set(0, 1.25, 2.7);

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
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.05, 0);
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 6.0;

    // 5. Lighting
    this.setupLighting();

    // 6. Asset Loader
    this.loader = createMedicalAssetLoader(this.renderer);

    // 7. Event listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 8. Build anatomical structures from comprehensive audited catalog
    this.buildCatalogMeshes();

    // 9. Start loop
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.6);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(0, -2, -3);
    this.scene.add(rimLight);

    // Subtle anatomical ground grid
    const grid = new THREE.GridHelper(4, 20, 0x1e293b, 0x0f172a);
    grid.position.y = 0;
    this.scene.add(grid);
  }

  private buildCatalogMeshes() {
    (catalogData as RawCatalogItem[]).forEach((item) => {
      const [minX, minY, minZ, maxX, maxY, maxZ] = item.bbox;
      const dx = Math.max(maxX - minX, 0.02);
      const dy = Math.max(maxY - minY, 0.02);
      const dz = Math.max(maxZ - minZ, 0.02);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      let geometry: THREE.BufferGeometry;

      // Select appropriate geometric representation based on anatomical shape
      if (item.fmaId.includes('SKULL') || item.fmaId === 'FMA5018') {
        geometry = new THREE.SphereGeometry(Math.max(dx, dz) / 2, 24, 24);
        geometry.scale(1, dy / Math.max(dx, dz), 1);
      } else if (item.fmaId === 'FMA7088') {
        geometry = new THREE.SphereGeometry(dx * 0.9, 24, 24);
        geometry.scale(1, 1.2, 0.9);
      } else if (item.systemCategory === 'Skeletal' && dy > dx * 2) {
        geometry = new THREE.CylinderGeometry(dx / 2.5, dx / 2, dy, 16);
      } else if (item.systemCategory === 'Respiratory') {
        geometry = new THREE.CapsuleGeometry(dx / 2, Math.max(dy - dx, 0.05), 12, 24);
      } else if (item.systemCategory === 'Digestive' && item.fmaId === 'FMA7199') {
        geometry = new THREE.BoxGeometry(dx, dy, dz);
      } else {
        geometry = new THREE.BoxGeometry(dx, dy, dz);
      }

      const color = SYSTEM_COLORS[item.systemCategory] || 0xcbd5e1;
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: item.systemCategory === 'Skeletal' ? 0.3 : 0.45,
        metalness: 0.1,
        clippingPlanes: [this.clippingPlane],
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
        structure: struct,
        originalPosition: mesh.position.clone(),
        systemCategory: item.systemCategory
      };

      this.scene.add(mesh);
      this.interactiveMeshes.push(mesh);
      this.originalPositions.set(mesh.uuid, mesh.position.clone());
    });
  }

  public setExplodeView(factor: number) {
    const center = new THREE.Vector3(0, 1.1, 0);
    this.interactiveMeshes.forEach((mesh) => {
      const original = this.originalPositions.get(mesh.uuid);
      if (!original) return;
      const direction = new THREE.Vector3().subVectors(original, center).normalize();
      const dist = original.distanceTo(center);
      mesh.position.copy(original).addScaledVector(direction, dist * factor * 1.5);
    });
  }

  public setClipping(enabled: boolean, planeY = 1.25) {
    this.clippingEnabled = enabled;
    this.renderer.localClippingEnabled = enabled;
    this.clippingPlane.constant = planeY;
  }

  public setSystemVisibility(systemCategory: string, visible: boolean) {
    this.interactiveMeshes.forEach((mesh) => {
      if (mesh.userData.systemCategory === systemCategory) {
        mesh.visible = visible;
      }
    });
  }

  public focusOnStructure(fmaId: string) {
    const mesh = this.interactiveMeshes.find((m) => m.userData.structure?.fmaId === fmaId);
    if (mesh) {
      this.highlightMesh(mesh);
      if (this.onStructureSelect) {
        this.onStructureSelect(mesh.userData.structure);
      }
      this.controls.target.copy(mesh.position);
    }
  }

  private onPointerDown(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
