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

// Medical PBR Material Palette
export const Z_SYSTEM_PALETTE = {
  skeletal: {
    color: '#eae3d2',        // Realistic ivory bone
    roughness: 0.45,
    metalness: 0.05,
  },
  muscular: {
    color: '#b8483f',        // Striated red muscle
    roughness: 0.52,
    metalness: 0.02,
  },
  nervous: {
    color: '#eab308',        // Neural golden amber
    roughness: 0.40,
    metalness: 0.05,
  },
  cardiovascular: {
    color: '#dc2626',        // Arterial blood red
    roughness: 0.35,
    metalness: 0.08,
  },
  respiratory: {
    color: '#f28482',        // Pulmonary lung pink
    roughness: 0.42,
    metalness: 0.02,
  },
  digestive: {
    color: '#d4a373',        // Visceral intestinal tone
    roughness: 0.38,
    metalness: 0.04,
  },
  urinary: {
    color: '#8b3a3a',        // Renal cortex deep red
    roughness: 0.35,
    metalness: 0.05,
  },
  lymphatic: {
    color: '#10b981',        // Lymphatic node emerald
    roughness: 0.40,
    metalness: 0.05,
  },
  integumentary: {
    color: '#f8d7c4',        // Translucent dermal tone
    roughness: 0.30,
    metalness: 0.02,
    opacity: 0.16,
  }
};

export class ZAnatomyLoader {
  private loader = new GLTFLoader();
  public structures: ZStructureInfo[] = [];
  public systemGroups = new Map<ZSystemId, THREE.Group>();
  public allMeshes: THREE.Mesh[] = [];

  public halfDissectionMode = true; // Right side muscles, Left side skeleton, Center organs
  public isLoaded = false;
  public selectedMesh: THREE.Mesh | null = null;
  public highlightedMesh: THREE.Mesh | null = null;

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
    // 1. Create root groups for systems
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

    // 2. Build subtle translucent skin silhouette
    this.buildTranslucentSkinSilhouette();

    this.isLoaded = true;
    this.updateVisibilityAndHalfDissection();
  }

  private async loadSingleGlb(filename: string, defaultSys: ZSystemId): Promise<void> {
    const url = `/models/z-anatomy/${filename}`;
    const gltf = await this.loader.loadAsync(url);
    const scene = gltf.scene;

    // Traverse all meshes and assign materials & classification
    scene.updateMatrixWorld(true);

    const meshesToAdd: { mesh: THREE.Mesh; sys: ZSystemId }[] = [];

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const rawName = child.name || 'Anatomical Structure';
      const cleanName = this.formatAnatomyName(rawName);
      const system = this.classifySystem(cleanName, defaultSys);

      // Determine side (.r = right, .l = left)
      let side: 'l' | 'r' | 'center' = 'center';
      if (rawName.endsWith('.r') || cleanName.toLowerCase().includes('right')) {
        side = 'r';
      } else if (rawName.endsWith('.l') || cleanName.toLowerCase().includes('left')) {
        side = 'l';
      }

      // Compute world bounds
      child.geometry.computeBoundingBox();
      const bounds = child.geometry.boundingBox?.clone() || new THREE.Box3();
      bounds.applyMatrix4(child.matrixWorld);
      const center = bounds.getCenter(new THREE.Vector3());

      // If side is still center, check x coordinate
      if (side === 'center') {
        if (center.x > 0.015) side = 'r';
        else if (center.x < -0.015) side = 'l';
      }

      // Assign authentic PBR material
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
        bounds,
        side,
      };

      this.structures.push(info);
      this.allMeshes.push(child);
      meshesToAdd.push({ mesh: child, sys: system });
    });

    // Add meshes to their respective system groups in the scene
    meshesToAdd.forEach(({ mesh, sys }) => {
      const g = this.systemGroups.get(sys);
      if (g) {
        g.add(mesh);
      }
    });
  }

  private classifySystem(cleanName: string, defaultSys: ZSystemId): ZSystemId {
    const lower = cleanName.toLowerCase();

    // Specific organ classifications in ic-organlar.glb
    if (lower.includes('lung') || lower.includes('bronch') || lower.includes('trachea')) {
      return 'respiratory';
    }
    if (lower.includes('kidney') || lower.includes('ureter') || lower.includes('urinary bladder')) {
      return 'urinary';
    }
    if (lower.includes('heart') || lower.includes('aorta') || lower.includes('artery') || lower.includes('vein')) {
      return 'cardiovascular';
    }
    if (lower.includes('brain') || lower.includes('cerebr') || lower.includes('nerve')) {
      return 'nervous';
    }
    if (lower.includes('lymph') || lower.includes('spleen') || lower.includes('thymus')) {
      return 'lymphatic';
    }
    if (lower.includes('bone') || lower.includes('vertebra') || lower.includes('rib') || lower.includes('skull')) {
      return 'skeletal';
    }
    if (lower.includes('muscle')) {
      return 'muscular';
    }

    return defaultSys;
  }

  private createMaterialForStructure(name: string, system: ZSystemId): THREE.MeshStandardMaterial {
    const lower = name.toLowerCase();

    // Organ-specific custom colors
    if (lower.includes('liver')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#7f3b32'), // Deep hepatic brown-red
        roughness: 0.35,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('lung')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f28482'), // Soft pink lungs
        roughness: 0.45,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('heart')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#9e2a2b'), // Cardiac crimson
        roughness: 0.35,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('kidney')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#7c2d12'), // Renal red
        roughness: 0.36,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('stomach') || lower.includes('jejunum') || lower.includes('colon') || lower.includes('intestine')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d4a373'), // Gastrointestinal warm amber
        roughness: 0.38,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('brain') || lower.includes('cerebrum')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d8b4e2'), // Cerebral lavender
        roughness: 0.45,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('artery') || lower.includes('aorta')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#dc2626'), // Arterial red
        roughness: 0.32,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
    }
    if (lower.includes('vein') || lower.includes('vena')) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2563eb'), // Venous blue
        roughness: 0.32,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
    }

    const cfg = Z_SYSTEM_PALETTE[system];
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.color),
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      side: THREE.DoubleSide,
    });
  }

  private buildTranslucentSkinSilhouette(): void {
    const skinGroup = this.systemGroups.get('integumentary');
    if (!skinGroup) return;

    // Build anatomical translucent skin silhouette around the body
    // Using subtle capsules/spheres matching body contour
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fcd5ce'),
      transparent: true,
      opacity: this.opacity.integumentary,
      roughness: 0.3,
      metalness: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Torso silhouette
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 16, 32), skinMat.clone());
    torso.position.set(0, 1.20, 0.01);
    torso.name = 'Skin of Torso';
    skinGroup.add(torso);

    // Head silhouette
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), skinMat.clone());
    head.scale.set(0.9, 1.15, 1.05);
    head.position.set(0, 1.68, 0.02);
    head.name = 'Skin of Head';
    skinGroup.add(head);

    // Left leg silhouette (on the skeletal side)
    const legLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.72, 12, 24), skinMat.clone());
    legLeft.position.set(-0.11, 0.50, 0.0);
    legLeft.name = 'Skin of Left Leg';
    skinGroup.add(legLeft);

    // Left arm silhouette (on the skeletal side)
    const armLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.52, 12, 24), skinMat.clone());
    armLeft.position.set(-0.25, 1.12, 0.0);
    armLeft.name = 'Skin of Left Arm';
    skinGroup.add(armLeft);
  }

  public updateVisibilityAndHalfDissection(): void {
    this.structures.forEach((st) => {
      const isSysVis = this.visibility[st.system];
      let visible = isSysVis;

      if (this.halfDissectionMode && visible) {
        // Anatomical Right (x > 0.005) -> Muscular System
        // Anatomical Left (x < -0.005) -> Skeletal System
        // Midline & Visceral Organs (Digestive, Respiratory, Urinary, Heart, Brain) -> Visible on both sides
        if (st.system === 'muscular') {
          // Hide muscles on anatomical left side
          if (st.center.x < -0.01) {
            visible = false;
          }
        } else if (st.system === 'skeletal') {
          // Hide bones on anatomical right side (where muscles are displayed)
          if (st.center.x > 0.01) {
            visible = false;
          }
        }
      }

      st.mesh.visible = visible;
    });

    // Update skin group visibility
    const skinGroup = this.systemGroups.get('integumentary');
    if (skinGroup) {
      skinGroup.visible = this.visibility.integumentary;
    }
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

      // Update materials of this system
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

  public highlightStructure(info: ZStructureInfo | null): void {
    // Reset previous highlight
    if (this.highlightedMesh) {
      const orig = this.highlightedMesh.userData.originalMaterial as THREE.MeshStandardMaterial;
      if (orig) {
        this.highlightedMesh.material = orig;
      }
      this.highlightedMesh = null;
    }

    if (!info) return;

    this.highlightedMesh = info.mesh;
    // Electric blue neon glow (as seen on the left kidney in user image)
    const highlightMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x38bdf8),
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    info.mesh.material = highlightMat;
  }

  public findStructureByName(query: string): ZStructureInfo | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    return (
      this.structures.find(
        (s) =>
          s.cleanName.toLowerCase() === q ||
          s.cleanName.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      ) || null
    );
  }

  private formatAnatomyName(rawName: string): string {
    // Remove .l or .r suffix and format
    let clean = rawName
      .replace(/\.l$/i, ' (Left)')
      .replace(/\.r$/i, ' (Right)')
      .replace(/_/g, ' ')
      .trim();

    return clean;
  }

  public dispose(): void {
    this.allMeshes.forEach((m) => {
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    });
    this.systemGroups.clear();
    this.structures = [];
    this.allMeshes = [];
  }
}
