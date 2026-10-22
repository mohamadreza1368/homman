import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMedicalAssetLoader } from './AssetLoader';
import type { AnatomicalStructure } from '../types/anatomy';

export interface ViewerOptions {
  container: HTMLDivElement;
  onStructureSelect?: (structure: AnatomicalStructure | null) => void;
}

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
    this.camera.position.set(0, 1.2, 2.5);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.1, 0);
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 5.0;

    // 5. Lighting
    this.setupLighting();

    // 6. Asset Loader
    this.loader = createMedicalAssetLoader(this.renderer);

    // 7. Event listeners
    this.onResize = this.onResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // 8. Setup procedural base anatomy preview
    this.setupDemoAnatomy();

    // 9. Start loop
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.5);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rimLight.position.set(0, -2, -3);
    this.scene.add(rimLight);

    // Subtle anatomical ground grid
    const grid = new THREE.GridHelper(4, 20, 0x1e293b, 0x0f172a);
    grid.position.y = 0;
    this.scene.add(grid);
  }

  private setupDemoAnatomy() {
    // Demonstration organ meshes (Head, Thorax/Lungs, Heart, Spine, Pelvis, Limbs)
    const organs: {
      name: string;
      structure: AnatomicalStructure;
      geometry: THREE.BufferGeometry;
      color: number;
      roughness: number;
      position: [number, number, number];
      scale?: [number, number, number];
    }[] = [
      {
        name: 'Heart',
        structure: {
          fmaId: 'FMA7088',
          snomedBodyStructureId: '302551006',
          nameEn: 'Heart',
          nameFa: 'قلب',
          systemCategory: 'Circulatory',
          genderModel: 'both',
          meshNodeName: 'Heart_Mesh',
          descriptionEn: 'Muscular organ in most animals, which pumps blood through the blood vessels of the circulatory system.',
          descriptionFa: 'عضو عضلانی مرکزی سیستم گردش خون که وظیفه پمپاژ خون به تمام بافت‌ها را بر عهده دارد.'
        },
        geometry: new THREE.SphereGeometry(0.08, 32, 32),
        color: 0xd9383a,
        roughness: 0.35,
        position: [-0.02, 1.30, 0.05],
        scale: [1, 1.2, 0.9]
      },
      {
        name: 'Right Lung',
        structure: {
          fmaId: 'FMA7195',
          snomedBodyStructureId: '181216001',
          nameEn: 'Right Lung',
          nameFa: 'ریه راست',
          systemCategory: 'Respiratory',
          genderModel: 'both',
          meshNodeName: 'Right_Lung_Mesh',
          descriptionEn: 'The right lung is divided into three different lobes: upper, middle, and lower.',
          descriptionFa: 'ریه راست شامل ۳ لوب فوقانی، میانی و تحتانی جهت تبادل اکسیژن و دی‌اکسید کربن است.'
        },
        geometry: new THREE.CapsuleGeometry(0.07, 0.22, 16, 32),
        color: 0x93c5fd,
        roughness: 0.6,
        position: [0.12, 1.32, 0.02],
        scale: [1, 1, 0.8]
      },
      {
        name: 'Left Lung',
        structure: {
          fmaId: 'FMA7196',
          snomedBodyStructureId: '181217005',
          nameEn: 'Left Lung',
          nameFa: 'ریه چپ',
          systemCategory: 'Respiratory',
          genderModel: 'both',
          meshNodeName: 'Left_Lung_Mesh',
          descriptionEn: 'The left lung has two lobes to accommodate the cardiac notch.',
          descriptionFa: 'ریه چپ به دلیل فضای اشغال شده توسط قلب، دارای دو لوب است.'
        },
        geometry: new THREE.CapsuleGeometry(0.065, 0.22, 16, 32),
        color: 0x93c5fd,
        roughness: 0.6,
        position: [-0.13, 1.32, 0.02],
        scale: [1, 1, 0.8]
      },
      {
        name: 'Liver',
        structure: {
          fmaId: 'FMA7199',
          snomedBodyStructureId: '181277001',
          nameEn: 'Liver',
          nameFa: 'کبد',
          systemCategory: 'Digestive',
          genderModel: 'both',
          meshNodeName: 'Liver_Mesh',
          descriptionEn: 'The largest internal organ and the largest gland in the human body.',
          descriptionFa: 'بزرگترین غده و عضو داخلی بدن با بیش از ۵۰۰ عملکرد متابولیک و تصفیه خون.'
        },
        geometry: new THREE.BoxGeometry(0.24, 0.12, 0.14),
        color: 0x854d0e,
        roughness: 0.45,
        position: [0.06, 1.14, 0.04]
      },
      {
        name: 'Cerebrum',
        structure: {
          fmaId: 'FMA5018',
          snomedBodyStructureId: '113105001',
          nameEn: 'Cerebrum (Brain)',
          nameFa: 'نیمکره‌های مخ (مغز)',
          systemCategory: 'Nervous',
          genderModel: 'both',
          meshNodeName: 'Cerebrum_Mesh',
          descriptionEn: 'The principal and most anterior part of the brain in vertebrates.',
          descriptionFa: 'بخش اصلی سیستم عصبی مرکزی مسئول پردازش اطلاعات حسی، تفکر و کنترل حرکات ارادی.'
        },
        geometry: new THREE.SphereGeometry(0.11, 32, 32),
        color: 0xf472b6,
        roughness: 0.5,
        position: [0, 1.68, 0],
        scale: [0.95, 1.1, 1.2]
      },
      {
        name: 'Spine (Vertebral Column)',
        structure: {
          fmaId: 'FMA13478',
          snomedBodyStructureId: '122494005',
          nameEn: 'Vertebral Column',
          nameFa: 'ستون مهره‌ها',
          systemCategory: 'Skeletal',
          genderModel: 'both',
          meshNodeName: 'Spine_Mesh',
          descriptionEn: 'The flexible column extending from neck to tail, made of interconnected vertebrae.',
          descriptionFa: 'محور اسکلتی بدن محافظت‌کننده از نخاع و نگهدارنده قامت.'
        },
        geometry: new THREE.CylinderGeometry(0.025, 0.035, 0.65, 16),
        color: 0xf1f5f9,
        roughness: 0.3,
        position: [0, 1.25, -0.06]
      },
      {
        name: 'Femur (Right Thigh)',
        structure: {
          fmaId: 'FMA9915',
          snomedBodyStructureId: '71341001',
          nameEn: 'Right Femur',
          nameFa: 'استخوان ران راست (فمور)',
          systemCategory: 'Skeletal',
          genderModel: 'both',
          meshNodeName: 'Femur_Right_Mesh',
          descriptionEn: 'The longest, heaviest, and strongest bone in the human body.',
          descriptionFa: 'بلندترین و مستحکم‌ترین استخوان بدن انسان در اندام تحتانی.'
        },
        geometry: new THREE.CylinderGeometry(0.03, 0.035, 0.45, 16),
        color: 0xf8fafc,
        roughness: 0.3,
        position: [0.12, 0.65, 0]
      },
      {
        name: 'Femur (Left Thigh)',
        structure: {
          fmaId: 'FMA9916',
          snomedBodyStructureId: '71341001',
          nameEn: 'Left Femur',
          nameFa: 'استخوان ران چپ (فمور)',
          systemCategory: 'Skeletal',
          genderModel: 'both',
          meshNodeName: 'Femur_Left_Mesh',
          descriptionEn: 'The longest, heaviest, and strongest bone in the human body.',
          descriptionFa: 'بلندترین و مستحکم‌ترین استخوان بدن انسان در اندام تحتانی.'
        },
        geometry: new THREE.CylinderGeometry(0.03, 0.035, 0.45, 16),
        color: 0xf8fafc,
        roughness: 0.3,
        position: [-0.12, 0.65, 0]
      }
    ];

    organs.forEach((item) => {
      const material = new THREE.MeshStandardMaterial({
        color: item.color,
        roughness: item.roughness,
        metalness: 0.1,
        clippingPlanes: [this.clippingPlane],
        clipShadows: true
      });

      const mesh = new THREE.Mesh(item.geometry, material);
      mesh.position.set(...item.position);
      if (item.scale) {
        mesh.scale.set(...item.scale);
      }
      mesh.name = item.name;
      mesh.userData = {
        structure: item.structure,
        originalPosition: mesh.position.clone(),
        systemCategory: item.structure.systemCategory
      };

      this.scene.add(mesh);
      this.interactiveMeshes.push(mesh);
      this.originalPositions.set(mesh.uuid, mesh.position.clone());
    });
  }

  public setExplodeView(factor: number) {
    const center = new THREE.Vector3(0, 1.2, 0);
    this.interactiveMeshes.forEach((mesh) => {
      const original = this.originalPositions.get(mesh.uuid);
      if (!original) return;
      const direction = new THREE.Vector3().subVectors(original, center).normalize();
      const dist = original.distanceTo(center);
      mesh.position.copy(original).addScaledVector(direction, dist * factor * 1.6);
    });
  }

  public setClipping(enabled: boolean, planeY = 1.3) {
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

      // Visual feedback: outline or highlight
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
        mat.emissiveIntensity = 0.4;
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
