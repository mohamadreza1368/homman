import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ZSystemId = 
  | 'skeletal'
  | 'muscular'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'lymphatic'
  | 'integumentary';

export interface ZStructureInfo {
  name: string;
  cleanName: string;
  system: ZSystemId;
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  bounds: THREE.Box3;
  side: 'l' | 'r' | 'center';
}

export interface CardiacMeshInfo {
  mesh: THREE.Mesh;
  origPositions: Float32Array;
  localCenter: THREE.Vector3;
  chamberType: 'ventricle' | 'atrium' | 'vessel';
}

export const Z_SYSTEM_PALETTE: Record<ZSystemId, { color: string; roughness: number; metalness: number; opacity?: number }> = {
  skeletal: {
    color: '#e8e2d4',        // Warm organic bone ivory
    roughness: 0.58,
    metalness: 0.03,
  },
  muscular: {
    color: '#93352b',        // Natural deep muscle tissue
    roughness: 0.55,
    metalness: 0.02,
  },
  nervous: {
    color: '#d49b28',        // Amber nervous tissue
    roughness: 0.45,
    metalness: 0.04,
  },
  cardiovascular: {
    color: '#991b1b',        // Deep biological arterial red
    roughness: 0.46,
    metalness: 0.04,
  },
  respiratory: {
    color: '#df7977',        // Natural pulmonary lung tone
    roughness: 0.50,
    metalness: 0.02,
  },
  digestive: {
    color: '#bc8a5f',        // Visceral intestinal tone
    roughness: 0.46,
    metalness: 0.03,
  },
  urinary: {
    color: '#70231d',        // Deep renal cortex bean
    roughness: 0.45,
    metalness: 0.04,
  },
  lymphatic: {
    color: '#15803d',        // Natural lymphatic node
    roughness: 0.48,
    metalness: 0.03,
  },
  integumentary: {
    color: '#f8d7c4',        // Translucent dermal tone
    roughness: 0.35,
    metalness: 0.02,
    opacity: 0.16,
  }
};

export class ZAnatomyLoader {
  private loader = new GLTFLoader();
  public structures: ZStructureInfo[] = [];
  public systemGroups = new Map<ZSystemId, THREE.Group>();
  public allMeshes: THREE.Mesh[] = [];

  // Cardiac meshes grouped for physiological beating simulation
  public cardiacMeshes: CardiacMeshInfo[] = [];
  public cardiacCenter = new THREE.Vector3(0.018, 1.25, 0.045);

  public halfDissectionMode = true; // Left on screen = Muscles; Right on screen = Skeleton
  public isLoaded = false;
  public isIsolated = false;

  // Active highlights
  public highlightedMeshes: { mesh: THREE.Mesh; origMat: THREE.Material | THREE.Material[] }[] = [];

  public visibility: Record<ZSystemId, boolean> = {
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

  public opacity: Record<ZSystemId, number> = {
    skeletal: 1.0,
    muscular: 1.0,
    nervous: 1.0,
    cardiovascular: 1.0,
    respiratory: 1.0,
    digestive: 1.0,
    urinary: 1.0,
    lymphatic: 1.0,
    integumentary: 0.16,
  };

  public async loadAll(
    parentScene: THREE.Scene,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const systemIds: ZSystemId[] = [
      'skeletal',
      'muscular',
      'nervous',
      'cardiovascular',
      'respiratory',
      'digestive',
      'urinary',
      'lymphatic',
      'integumentary',
    ];

    systemIds.forEach((sys) => {
      const g = new THREE.Group();
      g.name = `ZAnatomy_${sys}`;
      parentScene.add(g);
      this.systemGroups.set(sys, g);
    });

    const filesToLoad: { file: string; defaultSystem: ZSystemId }[] = [
      { file: 'iskelet.glb', defaultSystem: 'skeletal' },
      { file: 'kas.glb', defaultSystem: 'muscular' },
      { file: 'ic-organlar.glb', defaultSystem: 'digestive' },
      { file: 'dolasim.glb', defaultSystem: 'cardiovascular' },
      { file: 'sinir.glb', defaultSystem: 'nervous' },
      { file: 'lenf.glb', defaultSystem: 'lymphatic' },
      { file: 'eklem.glb', defaultSystem: 'skeletal' },
    ];

    let filesLoaded = 0;
    const totalFiles = filesToLoad.length;

    for (const item of filesToLoad) {
      try {
        await this.loadSingleGlb(item.file, item.defaultSystem);
        filesLoaded++;
        if (onProgress) {
          onProgress(Math.round((filesLoaded / totalFiles) * 100));
        }
      } catch (err) {
        console.warn(`Failed loading Z-Anatomy file ${item.file}:`, err);
      }
    }

    // Compute collective cardiac center for beating animation
    if (this.cardiacMeshes.length > 0) {
      const cardiacBox = new THREE.Box3();
      this.cardiacMeshes.forEach((item) => cardiacBox.expandByObject(item.mesh));
      cardiacBox.getCenter(this.cardiacCenter);
    }

    this.isLoaded = true;
    this.updateVisibilityAndHalfDissection();
  }

  private async loadSingleGlb(filename: string, defaultSys: ZSystemId): Promise<void> {
    const url = `/models/z-anatomy/${filename}`;
    const gltf = await this.loader.loadAsync(url);
    const scene = gltf.scene;

    scene.updateMatrixWorld(true);

    const group = this.systemGroups.get(defaultSys);
    if (group) {
      group.add(scene);
    }

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const rawName = child.name || 'Anatomical Structure';
      const cleanName = this.formatAnatomyName(rawName);
      const system = this.classifySystem(cleanName, defaultSys);

      // Compute world coordinates
      const box = new THREE.Box3().setFromObject(child);
      const center = box.getCenter(new THREE.Vector3());

      let side: 'l' | 'r' | 'center' = 'center';
      if (center.x < -0.015) {
        side = 'r'; // Anatomical Right (screen Left)
      } else if (center.x > 0.015) {
        side = 'l'; // Anatomical Left (screen Right)
      }

      // Assign authentic medical PBR material
      const mat = this.createMaterialForStructure(cleanName, system);
      child.material = mat;
      child.castShadow = true;
      child.receiveShadow = true;

      child.userData = {
        rawName,
        cleanName,
        system,
        side,
        center,
        originalMaterial: mat,
      };

      const info: ZStructureInfo = {
        name: rawName,
        cleanName,
        system,
        mesh: child,
        center,
        bounds: box,
        side,
      };

      this.structures.push(info);
      this.allMeshes.push(child);

      // Track cardiac meshes ONLY in dolasim.glb (strictly in the chest, never brain)
      if (filename === 'dolasim.glb') {
        const lower = rawName.toLowerCase();
        let chamberType: 'ventricle' | 'atrium' | 'vessel' | null = null;
        if (
          (lower.includes('left_ventricle') || lower.includes('right_ventricle') || lower.includes('papillary_muscle')) &&
          !lower.includes('lateral') && !lower.includes('third') && !lower.includes('fourth')
        ) {
          chamberType = 'ventricle';
        } else if (lower.includes('left_atrium') || lower.includes('right_atrium')) {
          chamberType = 'atrium';
        }

        if (chamberType && child.geometry && child.geometry.attributes.position) {
          child.geometry.computeBoundingBox();
          const localCenter = new THREE.Vector3();
          if (child.geometry.boundingBox) {
            child.geometry.boundingBox.getCenter(localCenter);
          }
          const origPositions = new Float32Array(child.geometry.attributes.position.array);

          this.cardiacMeshes.push({
            mesh: child,
            origPositions,
            localCenter,
            chamberType,
          });
        }
      }
    });
  }

  private classifySystem(cleanName: string, defaultSys: ZSystemId): ZSystemId {
    const lower = cleanName.toLowerCase();

    // 1. Brain ventricles MUST be nervous system, NEVER cardiovascular!
    if (
      lower.includes('lateral ventricle') ||
      lower.includes('third ventricle') ||
      lower.includes('fourth ventricle')
    ) {
      return 'nervous';
    }

    if (lower.includes('kidney') || lower.includes('renal') || lower.includes('ureter') || lower.includes('urinary bladder')) {
      return 'urinary';
    }
    if (lower.includes('lung') || lower.includes('bronch') || lower.includes('trachea') || lower.includes('larynx')) {
      return 'respiratory';
    }
    if (
      lower.includes('heart') ||
      lower.includes('left ventricle') ||
      lower.includes('right ventricle') ||
      lower.includes('papillary muscle') ||
      lower.includes('left atrium') ||
      lower.includes('right atrium') ||
      lower.includes('myocardi') ||
      lower.includes('cardiac') ||
      lower.includes('coronary') ||
      lower.includes('aorta') ||
      lower.includes('artery') ||
      lower.includes('vein')
    ) {
      return 'cardiovascular';
    }
    if (
      lower.includes('brain') ||
      lower.includes('cerebr') ||
      lower.includes('cerebel') ||
      lower.includes('gyrus') ||
      lower.includes('sulcus') ||
      lower.includes('pons') ||
      lower.includes('medulla') ||
      lower.includes('thalamus') ||
      lower.includes('nerve')
    ) {
      return 'nervous';
    }
    if (lower.includes('lymph') || lower.includes('spleen') || lower.includes('thymus')) {
      return 'lymphatic';
    }
    if (
      lower.includes('liver') ||
      lower.includes('stomach') ||
      lower.includes('jejunum') ||
      lower.includes('ileum') ||
      lower.includes('colon') ||
      lower.includes('pancreas') ||
      lower.includes('gallbladder') ||
      lower.includes('esophagus') ||
      lower.includes('oesophagus')
    ) {
      return 'digestive';
    }
    if (lower.includes('bone') || lower.includes('vertebra') || lower.includes('rib') || lower.includes('skull') || lower.includes('femur')) {
      return 'skeletal';
    }
    if (lower.includes('muscle') || lower.includes('biceps')) {
      return 'muscular';
    }

    return defaultSys;
  }

  private createMaterialForStructure(name: string, system: ZSystemId): THREE.MeshStandardMaterial {
    const lower = name.toLowerCase();

    if (lower.includes('liver')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#692a22'), // Natural hepatic reddish brown
        roughness: 0.42,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('lung') || lower.includes('bronch')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#de7b79'), // Natural soft pulmonary tone
        roughness: 0.52,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
    }
    if (
      lower.includes('heart') ||
      lower.includes('ventricle') ||
      lower.includes('atrium') ||
      lower.includes('myocardi')
    ) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#842020'), // Deep living myocardial crimson
        roughness: 0.48,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('kidney') || lower.includes('renal')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#6b2118'), // Deep kidney bean tone
        roughness: 0.45,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('stomach') || lower.includes('jejunum') || lower.includes('colon') || lower.includes('intestine')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#bc8a5f'), // Natural visceral mucosal tone
        roughness: 0.46,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('brain') || lower.includes('cerebrum') || lower.includes('gyrus')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#cfb3d4'), // Natural cerebral cortical lavender-gray
        roughness: 0.50,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('artery') || lower.includes('aorta')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#991b1b'), // Organic arterial crimson
        roughness: 0.46,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('vein') || lower.includes('vena')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e3a8a'), // Deoxygenated deep venous navy
        roughness: 0.46,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
    }

    if (system === 'integumentary' || lower.includes('skin')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f4d7c8'), // Authentic living translucent dermal tone
        roughness: 0.52,
        metalness: 0.02,
        transparent: true,
        opacity: this.opacity.integumentary ?? 0.18,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -1.0,
        side: THREE.DoubleSide,
      });
    }

    const cfg = Z_SYSTEM_PALETTE[system] || Z_SYSTEM_PALETTE.skeletal;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.color),
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      side: THREE.DoubleSide,
    });
  }

  public updateVisibilityAndHalfDissection(): void {
    this.structures.forEach((st) => {
      const isSysVis = this.visibility[st.system];
      
      // If the entire system is turned off (e.g. urinary / kidneys), hide it immediately!
      if (!isSysVis) {
        st.mesh.visible = false;
        return;
      }

      let visible = true;

      if (this.halfDissectionMode) {
        // Anatomical Right (x < 0.015, left side of screen) -> Muscular System
        // Anatomical Left (x > -0.015, right side of screen) -> Skeletal System
        if (st.system === 'muscular') {
          // Hide muscles on anatomical left (x > 0.015)
          if (st.center.x > 0.015) {
            visible = false;
          }
          // Dissect superficial abdominal sheets & intercostals to reveal internal viscera
          const lowerName = st.name.toLowerCase();
          if (
            lowerName.includes('oblique') ||
            lowerName.includes('transversus_abdominis') ||
            lowerName.includes('intercostal')
          ) {
            visible = false;
          }
        } else if (st.system === 'skeletal') {
          // Hide bones on anatomical right (x < -0.015)
          if (st.center.x < -0.015) {
            visible = false;
          }
        }
      }

      st.mesh.visible = visible;
    });
  }

  public setSystemVisibility(system: ZSystemId, visible: boolean): void {
    if (system in this.visibility) {
      this.visibility[system] = visible;
      this.updateVisibilityAndHalfDissection();
    }
  }

  public setSystemOpacity(system: ZSystemId, opacity: number): void {
    if (system in this.opacity) {
      this.opacity[system] = opacity;

      const g = this.systemGroups.get(system);
      if (g) {
        g.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.opacity = opacity;
            mat.transparent = opacity < 0.99;
            mat.depthWrite = opacity >= 0.85;
          }
        });
      }
    }
  }

  public setHalfDissection(enabled: boolean): void {
    this.halfDissectionMode = enabled;
    this.updateVisibilityAndHalfDissection();
  }

  public raycast(raycaster: THREE.Raycaster): ZStructureInfo | null {
    const visibleMeshes = this.allMeshes.filter((m) => m.visible);
    const hits = raycaster.intersectObjects(visibleMeshes, false);

    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      return this.structures.find((s) => s.mesh === hitMesh) || null;
    }
    return null;
  }

  public clearHighlight(): void {
    for (const item of this.highlightedMeshes) {
      if (item.mesh && item.origMat) {
        item.mesh.material = item.origMat as THREE.Material;
      }
    }
    this.highlightedMeshes = [];
  }

  public highlightStructures(structures: ZStructureInfo[]): void {
    // 1. Reset all previous highlights first
    this.clearHighlight();

    if (!structures || structures.length === 0) return;

    // Electric cyan neon highlight material
    const highlightMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x38bdf8),
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });

    structures.forEach((info) => {
      const orig = (info.mesh.userData.originalMaterial as THREE.Material | THREE.Material[]) || info.mesh.material;
      this.highlightedMeshes.push({ mesh: info.mesh, origMat: orig });
      info.mesh.material = highlightMat;
    });
  }

  public isolateStructures(targets: ZStructureInfo[]): void {
    if (!targets || targets.length === 0) return;
    this.isIsolated = true;

    const targetMeshes = new Set(targets.map((t) => t.mesh));

    this.structures.forEach((st) => {
      const mat = st.mesh.material as THREE.MeshStandardMaterial;
      if (targetMeshes.has(st.mesh)) {
        st.mesh.visible = true;
        mat.opacity = 1.0;
        mat.transparent = false;
      } else {
        mat.opacity = 0.05;
        mat.transparent = true;
      }
      mat.needsUpdate = true;
    });
  }

  public clearIsolation(): void {
    this.isIsolated = false;
    this.structures.forEach((st) => {
      const mat = st.mesh.material as THREE.MeshStandardMaterial;
      const sysOpacity = this.opacity[st.system] ?? 1.0;
      mat.opacity = sysOpacity;
      mat.transparent = sysOpacity < 0.99;
      mat.needsUpdate = true;
    });
    this.updateVisibilityAndHalfDissection();
  }

  /**
   * Smart organ & component resolver:
   * Maps FMA IDs, colloquial names, Persian names, and multi-mesh organs (heart, lungs, brain, kidneys, etc.)
   */
  public findStructures(query: string): ZStructureInfo[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // Cardiac (Heart) - Strictly in Thorax (center.y < 1.45), NEVER Brain Ventricles!
    if (q === 'fma7088' || q === 'fma7197' || q === 'heart' || q === 'cardiac' || q === 'قلب') {
      return this.structures.filter((s) => {
        const name = s.name.toLowerCase();
        if (name.includes('lateral ventricle') || name.includes('third ventricle') || name.includes('fourth ventricle')) {
          return false;
        }
        return (
          /left ventricle|right ventricle|left atrium|right atrium|ascending aorta|pulmonary trunk|coronary|cardiac|papillary muscle|leaflet/i.test(s.name) &&
          s.center.y < 1.45
        );
      });
    }

    // Brain Ventricles (Nervous system / CSF cavities in head)
    if (q.includes('lateral ventricle') || q.includes('brain ventricle') || q === 'fma242784' || q === 'بطن مغز') {
      return this.structures.filter((s) =>
        /lateral ventricle|third ventricle|fourth ventricle/i.test(s.name)
      );
    }

    // Kidneys
    if (q === 'fma7201_l' || q === 'kidney.l' || q === 'left kidney' || q === 'کلیه چپ') {
      return this.structures.filter((s) => /kidney\.l|renal.*\.l/i.test(s.name));
    }
    if (q === 'fma7201_r' || q === 'kidney.r' || q === 'right kidney' || q === 'کلیه راست') {
      return this.structures.filter((s) => /kidney\.r|renal.*\.r/i.test(s.name));
    }
    if (q === 'fma7201' || q === 'kidney' || q === 'renal' || q === 'کلیه') {
      return this.structures.filter((s) => /kidney|renal/i.test(s.name));
    }

    // Lungs & Respiratory
    if (q === 'fma7195' || q === 'fma7196' || q === 'lungs' || q === 'lung' || q === 'respiratory' || q === 'ریه' || q === 'ریه‌ها') {
      return this.structures.filter((s) => /lung|bronch/i.test(s.name));
    }

    // Cerebrum & Brain
    if (q === 'fma5018' || q === 'cerebrum' || q === 'brain' || q === 'مغز' || q === 'مخ') {
      return this.structures.filter((s) =>
        /gyrus|sulcus|cortex|cerebr|frontal|parietal|temporal|occipital|thalamus/i.test(s.name)
      );
    }

    // Liver
    if (q === 'fma7199' || q === 'liver' || q === 'کبد') {
      return this.structures.filter((s) => /liver/i.test(s.name));
    }

    // Stomach
    if (q === 'fma7148' || q === 'stomach' || q === 'معده') {
      return this.structures.filter((s) => /stomach/i.test(s.name));
    }

    // Femur
    if (q === 'fma9915' || q === 'femur' || q === 'ران') {
      return this.structures.filter((s) => /femur/i.test(s.name));
    }

    // Biceps
    if (q === 'biceps' || q === 'بازو') {
      return this.structures.filter((s) => /biceps/i.test(s.name));
    }

    // Lymphatic & Spleen
    if (q === 'spleen' || q === 'طحال' || q === 'fma7196_spleen') {
      return this.structures.filter((s) => /spleen/i.test(s.name));
    }
    if (q === 'lymphatic' || q === 'lymph' || q === 'لنفاوی') {
      return this.structures.filter((s) => s.system === 'lymphatic');
    }

    // Integumentary & Skin
    if (q === 'fma7163' || q === 'skin' || q === 'پوست' || q === 'integumentary') {
      return this.structures.filter((s) => s.system === 'integumentary');
    }

    // Exact or substring match
    return this.structures.filter(
      (s) =>
        s.cleanName.toLowerCase() === q ||
        s.cleanName.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }

  public findStructureByName(query: string): ZStructureInfo | null {
    const list = this.findStructures(query);
    return list.length > 0 ? list[0] : null;
  }

  private formatAnatomyName(rawName: string): string {
    return rawName
      .replace(/\.l$/i, ' (Left)')
      .replace(/\.r$/i, ' (Right)')
      .replace(/_/g, ' ')
      .trim();
  }

  public dispose(): void {
    this.clearHighlight();
    this.allMeshes.forEach((m) => {
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    });
    this.systemGroups.clear();
    this.cardiacMeshes = [];
    this.structures = [];
    this.allMeshes = [];
  }
}
