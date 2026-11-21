import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldGeometry, type Brain } from "./brainLoader";

export interface OrganRef {
  id: string;
  node: string;
  file: string;
}

export interface OrganBatchResult {
  unifiedGeometry: THREE.BufferGeometry;
  loadedOrganIds: string[];
  organBoundingBoxes: THREE.Box3[];
  unionBoundingBox: THREE.Box3;
}

export async function fetchOrganBatch(
  requestedOrgans: readonly OrganRef[],
  avatarData: Brain,
  fileUrl: (f: string) => string,
  gltfLoader: GLTFLoader,
  gltfNodeCache: Map<string, Promise<Map<string, THREE.Object3D>>>,
  isCancelled: () => boolean,
): Promise<OrganBatchResult | null> {
  const files = new Map<string, OrganRef[]>();
  for (const organ of requestedOrgans) {
    const list = files.get(organ.file) ?? [];
    list.push(organ);
    files.set(organ.file, list);
  }

  const verified: string[] = [];
  const parts: THREE.BufferGeometry[] = [];

  for (const [filePath, refs] of files) {
    let nodeDict: Map<string, THREE.Object3D>;
    try {
      let pending = gltfNodeCache.get(filePath);
      if (!pending) {
        pending = gltfLoader.loadAsync(fileUrl(filePath)).then((gltf) => {
          gltf.scene.updateMatrixWorld(true);
          const map = new Map<string, THREE.Object3D>();
          gltf.scene.traverse((node) => map.set(node.name, node));
          return map;
        });
        pending.catch(() => gltfNodeCache.delete(filePath));
        gltfNodeCache.set(filePath, pending);
      }
      nodeDict = await pending;
    } catch {
      continue;
    }

    if (isCancelled()) return null;

    for (const ref of refs) {
      const target =
        nodeDict.get(ref.node) ??
        nodeDict.get(THREE.PropertyBinding.sanitizeNodeName(ref.node));
      if (!target) continue;

      const regionIndex = verified.push(ref.id) - 1;
      target.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.geometry) {
          parts.push(worldGeometry(m, regionIndex));
        }
      });
    }
  }

  if (parts.length === 0 || isCancelled()) {
    for (const part of parts) part.dispose();
    return null;
  }

  const unified = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!unified) return null;

  const { centre: c, scale: s } = avatarData.normalise;
  unified.translate(-c.x, -c.y, -c.z);
  unified.scale(s, s, s);

  const posAttr = unified.getAttribute("position");
  const regAttr = unified.getAttribute("region");
  const organBoundingBoxes = verified.map(() => new THREE.Box3());

  const tempPoint = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    const regIdx = regAttr.getX(i);
    tempPoint.fromBufferAttribute(posAttr, i);
    organBoundingBoxes[regIdx]?.expandByPoint(tempPoint);
  }

  const unionBoundingBox = new THREE.Box3();
  for (const box of organBoundingBoxes) {
    if (!box.isEmpty()) unionBoundingBox.union(box);
  }

  return {
    unifiedGeometry: unified,
    loadedOrganIds: verified,
    organBoundingBoxes,
    unionBoundingBox,
  };
}
