import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface BrainStructure {
  node: string;
  name: string;
  latin: string;
  region: string;
  side: "left" | "right" | "midline";
}

export interface BrainRegion {
  name: string;
  latin: string;
  division: string;
  centre: THREE.Vector3;
}

export interface Brain {
  geometry: THREE.BufferGeometry;
  regions: BrainRegion[];
  bottom: number;
  top: number;
  normalise: { centre: THREE.Vector3; scale: number };
}

export interface BrainSource {
  meshUrl: string;
  structures: readonly BrainStructure[];
  dracoPath: string;
}

interface SharedDracoEntry {
  loader: DRACOLoader;
  users: number;
}

const activeDecoders = new Map<string, SharedDracoEntry>();

/**
 * Retrieves a shared reference-counted DRACOLoader instance for the given decoder asset path.
 */
export function acquireDraco(decoderPath: string): DRACOLoader {
  let record = activeDecoders.get(decoderPath);
  if (!record) {
    const draco = new DRACOLoader().setDecoderPath(decoderPath);
    record = { loader: draco, users: 0 };
    activeDecoders.set(decoderPath, record);
  }
  record.users += 1;
  return record.loader;
}

/**
 * Decrements reference count for the shared Draco loader and releases worker pool when unused.
 */
export function releaseDraco(decoderPath: string): void {
  const record = activeDecoders.get(decoderPath);
  if (!record) {
    return;
  }
  record.users -= 1;
  if (record.users <= 0) {
    record.loader.dispose();
    activeDecoders.delete(decoderPath);
  }
}

/**
 * Loads cerebral structures from GLTF/GLB asset bundle, applying Draco decoding and node unification.
 */
export async function loadBrain(source: BrainSource): Promise<Brain> {
  const dracoInstance = acquireDraco(source.dracoPath);
  const gltfLoader = new GLTFLoader().setDRACOLoader(dracoInstance);

  try {
    const gltfPayload = await gltfLoader.loadAsync(source.meshUrl);
    gltfPayload.scene.updateMatrixWorld(true);

    const sceneNodes = new Map<string, THREE.Object3D>();
    gltfPayload.scene.traverse((node) => {
      sceneNodes.set(node.name, node);
    });

    return buildBrain(source.structures, (identifier) => {
      return (
        sceneNodes.get(identifier) ??
        sceneNodes.get(THREE.PropertyBinding.sanitizeNodeName(identifier))
      );
    });
  } finally {
    releaseDraco(source.dracoPath);
  }
}

/**
 * Merges and normalizes disparate anatomical sub-meshes into a unified indexed brain geometry.
 */
export function buildBrain(
  structures: readonly BrainStructure[],
  findNode: (nodeName: string) => THREE.Object3D | undefined,
): Brain {
  const regionMap = new Map<string, number>();
  const regionDescriptors: {
    name: string;
    latin: string;
    division: string;
    bounds: THREE.Box3;
  }[] = [];
  const extractedGeometries: THREE.BufferGeometry[] = [];

  for (const item of structures) {
    const obj = findNode(item.node);
    if (!obj) continue;

    let regionIdx = regionMap.get(item.name);
    if (regionIdx === undefined) {
      regionIdx = regionDescriptors.length;
      regionMap.set(item.name, regionIdx);
      regionDescriptors.push({
        name: item.name,
        latin: item.latin,
        division: item.region,
        bounds: new THREE.Box3(),
      });
    }

    obj.traverse((child) => {
      const meshChild = child as THREE.Mesh;
      if (!meshChild.isMesh || !meshChild.geometry) return;
      extractedGeometries.push(worldGeometry(meshChild, regionIdx!));
    });
  }

  if (extractedGeometries.length === 0) {
    throw new Error("No brain structures were found in the mesh file.");
  }

  const combinedGeometry = mergeGeometries(extractedGeometries, false);
  for (const geom of extractedGeometries) {
    geom.dispose();
  }

  if (!combinedGeometry) {
    throw new Error("The brain's meshes could not be merged.");
  }

  // Scale and translate into unit sphere coordinate frame
  combinedGeometry.computeBoundingSphere();
  const sphere = combinedGeometry.boundingSphere!;
  const normalizationScale = 1 / sphere.radius;
  const centralOffset = sphere.center.clone();

  combinedGeometry.translate(-centralOffset.x, -centralOffset.y, -centralOffset.z);
  combinedGeometry.scale(normalizationScale, normalizationScale, normalizationScale);
  combinedGeometry.computeBoundingBox();
  combinedGeometry.computeBoundingSphere();

  // Accumulate per-region bounding extents
  const posAttr = combinedGeometry.getAttribute("position") as THREE.BufferAttribute;
  const regionAttr = combinedGeometry.getAttribute("region") as THREE.BufferAttribute;
  const vertexPoint = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertexPoint.fromBufferAttribute(posAttr, i);
    const regId = regionAttr.getX(i);
    regionDescriptors[regId]!.bounds.expandByPoint(vertexPoint);
  }

  // Sort regions bottom-to-top by vertical coordinate
  const ranked = regionDescriptors
    .map((desc, originalIdx) => ({
      desc,
      originalIdx,
      elevation: desc.bounds.getCenter(new THREE.Vector3()).y,
    }))
    .sort((r1, r2) => r1.elevation - r2.elevation);

  const remappedIndices = new Map<number, number>();
  ranked.forEach((entry, newRank) => {
    remappedIndices.set(entry.originalIdx, newRank);
  });

  for (let i = 0; i < regionAttr.count; i++) {
    regionAttr.setX(i, remappedIndices.get(regionAttr.getX(i))!);
  }
  regionAttr.needsUpdate = true;

  return {
    geometry: combinedGeometry,
    regions: ranked.map(({ desc }) => ({
      name: desc.name,
      latin: desc.latin,
      division: desc.division,
      centre: desc.bounds.getCenter(new THREE.Vector3()),
    })),
    bottom: combinedGeometry.boundingBox!.min.y,
    top: combinedGeometry.boundingBox!.max.y,
    normalise: {
      centre: centralOffset,
      scale: normalizationScale,
    },
  };
}

/**
 * Extracts world-transformed geometry from a mesh instance, appending custom region attribute.
 */
export function worldGeometry(mesh: THREE.Mesh, regionId: number): THREE.BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const srcGeo = mesh.geometry;
  const cloneGeo = new THREE.BufferGeometry();

  cloneGeo.setAttribute("position", srcGeo.getAttribute("position").clone());
  if (srcGeo.getAttribute("normal")) {
    cloneGeo.setAttribute("normal", srcGeo.getAttribute("normal").clone());
  }

  if (srcGeo.index) {
    cloneGeo.setIndex(srcGeo.index.clone());
  } else {
    cloneGeo.setIndex([...Array(srcGeo.getAttribute("position").count).keys()]);
  }

  cloneGeo.applyMatrix4(mesh.matrixWorld);
  if (!cloneGeo.getAttribute("normal")) {
    cloneGeo.computeVertexNormals();
  }

  const vCount = cloneGeo.getAttribute("position").count;
  cloneGeo.setAttribute(
    "region",
    new THREE.BufferAttribute(new Float32Array(vCount).fill(regionId), 1),
  );

  return cloneGeo;
}
