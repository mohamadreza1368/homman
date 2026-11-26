/**
 * Supplementary Reference Anatomy Integration
 *
 * Supplies ManifestOrgan metadata and anatomically sculpted BufferGeometries
 * for structures absent from the upstream Z-Anatomy GLB export (ileum,
 * caecum + vermiform appendix, rectum + anal canal, thoracic duct + cisterna
 * chyli, vocal folds) so they render natively through OrganMesh, appear in
 * AnatomyTree, respond to selection/isolation/hover/CT-slicing, and share the
 * exact biological Fresnel shading and palette of native organs.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AnatomyManifest, ManifestOrgan } from "@/lib/schemas";

export const SUPPLEMENTARY_MANIFEST_ORGANS: ManifestOrgan[] = [
  {
    organ_id: "ileum",
    ta2_latin: "Ileum",
    name_en: "Ileum",
    system: "digestive",
    mesh_file: "bp3d_missing_male.glb",
    node: "Ileum",
    path: ["Alimentary system", "Small intestine"],
  },
  {
    organ_id: "caecum",
    ta2_latin: "Caecum et Appendix vermiformis",
    name_en: "Caecum and vermiform appendix",
    system: "digestive",
    mesh_file: "digestive_male.glb",
    node: "__supp_caecum__",
    path: ["Alimentary system", "Large intestine"],
  },
  {
    organ_id: "rectum",
    ta2_latin: "Rectum et Canalis analis",
    name_en: "Rectum and anal canal",
    system: "digestive",
    mesh_file: "bp3d_missing_male.glb",
    node: "Rectum",
    path: ["Alimentary system", "Large intestine"],
  },
  {
    organ_id: "right_seminal_vesicle",
    ta2_latin: "Glandula vesiculosa dextra",
    name_en: "Right seminal vesicle",
    system: "reproductive",
    mesh_file: "bp3d_missing_male.glb",
    node: "Right seminal vesicle",
    path: ["Male genital system"],
  },
  {
    organ_id: "left_seminal_vesicle",
    ta2_latin: "Glandula vesiculosa sinistra",
    name_en: "Left seminal vesicle",
    system: "reproductive",
    mesh_file: "bp3d_missing_male.glb",
    node: "Left seminal vesicle",
    path: ["Male genital system"],
  },
  {
    organ_id: "thoracic_duct",
    ta2_latin: "Ductus thoracicus et Cisterna chyli",
    name_en: "Thoracic duct",
    system: "lymphatic",
    mesh_file: "lymphatic_male.glb",
    node: "__supp_thoracic_duct__",
    path: ["Lymphatic trunks"],
  },
  {
    organ_id: "vocal_folds",
    ta2_latin: "Plicae vocales",
    name_en: "Vocal folds",
    system: "respiratory",
    mesh_file: "respiratory_male.glb",
    node: "__supp_vocal_folds__",
    path: ["Larynx"],
  },
];

// Only structures without a real GLB node need procedural BufferGeometry fallback
const PROCEDURAL_SUPPLEMENTARY_IDS = new Set(["caecum", "thoracic_duct", "vocal_folds"]);

export function isSupplementaryOrganId(organId: string): boolean {
  return PROCEDURAL_SUPPLEMENTARY_IDS.has(organId);
}

/**
 * Merges supplementary organs into the male manifest if not already present.
 */
export function enrichManifestWithSupplementaryOrgans(manifest: AnatomyManifest): AnatomyManifest {
  const existingIds = new Set(manifest.organs.map((o) => o.organ_id));
  const additions = SUPPLEMENTARY_MANIFEST_ORGANS.filter((o) => !existingIds.has(o.organ_id));
  if (additions.length === 0) return manifest;
  return {
    ...manifest,
    organs: [...manifest.organs, ...additions],
  };
}

/**
 * Generates an organic sculpted tube geometry along a CatmullRomCurve3 with
 * variable radius modulation along length (u) and circumference (theta),
 * plus hemispherical end caps so there are no open pipe ends.
 */
function buildSculptedTube(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radialSegments: number,
  radiusFn: (u: number, theta: number) => number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const p = curve.getPointAt(u);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;

    // Smooth hemispherical dome taper at the very tips (first/last 4%)
    let capScale = 1.0;
    if (u < 0.03) capScale = Math.max(0.15, Math.sin((u / 0.03) * (Math.PI / 2)));
    else if (u > 0.97) capScale = Math.max(0.15, Math.sin(((1 - u) / 0.03) * (Math.PI / 2)));

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const r = radiusFn(u, theta) * capScale;

      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);

      const vx = p.x + r * (cos * N.x + sin * B.x);
      const vy = p.y + r * (cos * N.y + sin * B.y);
      const vz = p.z + r * (cos * N.z + sin * B.z);

      positions.push(vx, vy, vz);
      uvs.push(u, v);
    }
  }

  for (let j = 1; j <= tubularSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setIndex(indices);
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds anatomically sculpted BufferGeometry in world-space coordinates
 * anchored directly to the real neighboring organ bounds in the scene.
 */
export function buildSupplementaryOrganGeometry(
  organId: string,
  worldBoxes: ReadonlyMap<string, THREE.Box3>,
  worldCentres: ReadonlyMap<string, THREE.Vector3>,
): THREE.BufferGeometry | null {
  if (organId === "ileum") {
    const jejBox = worldBoxes.get("jejunum");
    const ascBox = worldBoxes.get("ascending_colon");
    const start = jejBox
      ? new THREE.Vector3(
          (jejBox.min.x + jejBox.max.x) * 0.5 + 0.01,
          jejBox.min.y + 0.03,
          (jejBox.min.z + jejBox.max.z) * 0.5,
        )
      : new THREE.Vector3(0.01, 0.91, 0.045);

    const ileocecalEnd = ascBox
      ? new THREE.Vector3(
          ascBox.min.x + 0.032,
          ascBox.min.y + 0.025,
          (ascBox.min.z + ascBox.max.z) * 0.5,
        )
      : new THREE.Vector3(-0.065, 0.90, 0.02);

    // Multi-loop coiled intestinal trajectory nestled in hypogastric/right iliac region
    const pts = [
      start,
      start.clone().add(new THREE.Vector3(0.025, -0.022, 0.012)),
      start.clone().add(new THREE.Vector3(-0.018, -0.036, 0.022)),
      start.clone().add(new THREE.Vector3(0.022, -0.052, 0.005)),
      start.clone().add(new THREE.Vector3(-0.025, -0.058, 0.018)),
      start.clone().add(new THREE.Vector3(-0.005, -0.042, -0.008)),
      start.clone().lerp(ileocecalEnd, 0.72).add(new THREE.Vector3(0.01, -0.02, 0.012)),
      ileocecalEnd.clone().add(new THREE.Vector3(0.018, -0.006, 0.004)),
      ileocecalEnd,
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return buildSculptedTube(curve, 110, 14, (u) => {
      // Subtle peristaltic/circular fold ripples matching real small intestine
      return 0.0105 * (1 + 0.08 * Math.sin(u * Math.PI * 28));
    });
  }

  if (organId === "caecum") {
    const ascBox = worldBoxes.get("ascending_colon");
    const top = ascBox
      ? new THREE.Vector3(
          (ascBox.min.x + ascBox.max.x) * 0.5,
          ascBox.min.y + 0.018,
          (ascBox.min.z + ascBox.max.z) * 0.5,
        )
      : new THREE.Vector3(-0.085, 0.915, 0.015);

    const bottom = top.clone().add(new THREE.Vector3(0.004, -0.045, 0.006));
    const caecumCurve = new THREE.CatmullRomCurve3([
      top,
      top.clone().lerp(bottom, 0.5).add(new THREE.Vector3(-0.003, 0, 0.004)),
      bottom,
    ]);

    // Sculpted haustra + 3 taeniae coli indentations matching Ascending colon
    const caecumBody = buildSculptedTube(caecumCurve, 28, 18, (u, theta) => {
      const haustra = 1 + 0.13 * Math.abs(Math.sin(u * Math.PI * 2.5));
      const taeniae = 1 - 0.06 * Math.pow(Math.cos(theta * 1.5), 4);
      const dome = u > 0.78 ? Math.cos(((u - 0.78) / 0.22) * (Math.PI / 2) * 0.7) : 1.0;
      return 0.021 * haustra * taeniae * dome;
    });

    // Vermiform appendix arising posteromedially from caecum base
    const appStart = bottom.clone().add(new THREE.Vector3(0.012, 0.006, -0.006));
    const appCurve = new THREE.CatmullRomCurve3([
      appStart,
      appStart.clone().add(new THREE.Vector3(0.016, -0.016, -0.008)),
      appStart.clone().add(new THREE.Vector3(0.028, -0.028, -0.016)),
      appStart.clone().add(new THREE.Vector3(0.036, -0.022, -0.022)),
    ]);
    const appendix = buildSculptedTube(appCurve, 22, 10, (u) => 0.0036 * (1 - 0.2 * u));

    const merged = mergeGeometries([caecumBody, appendix], false);
    caecumBody.dispose();
    appendix.dispose();
    return merged;
  }

  if (organId === "rectum") {
    const sigBox = worldBoxes.get("sigmoid_colon");
    const start = sigBox
      ? new THREE.Vector3(
          (sigBox.min.x + sigBox.max.x) * 0.5,
          sigBox.min.y + 0.015,
          (sigBox.min.z + sigBox.max.z) * 0.5 - 0.008,
        )
      : new THREE.Vector3(0.002, 0.815, -0.052);

    // True sacral flexure + lateral curves + perineal anal canal bend
    const pts = [
      start,
      start.clone().add(new THREE.Vector3(0.005, -0.032, -0.012)),
      start.clone().add(new THREE.Vector3(-0.004, -0.064, -0.006)),
      start.clone().add(new THREE.Vector3(0.0, -0.088, 0.004)), // Anorectal flexure
      start.clone().add(new THREE.Vector3(0.0, -0.108, -0.006)), // Anal canal
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return buildSculptedTube(curve, 36, 16, (u) => {
      // Rectal ampulla dilation around u = 0.55..0.72, tapering cleanly into anal canal
      if (u < 0.75) {
        const ampulla = Math.sin((u / 0.75) * Math.PI) * 0.005;
        return 0.0135 + ampulla;
      }
      const analTaper = (u - 0.75) / 0.25;
      return 0.0135 * (1 - 0.35 * analTaper);
    });
  }

  if (organId === "thoracic_duct") {
    const azygos = worldCentres.get("azygos_vein");
    const paraNodes = worldCentres.get("paratracheal_thoracic_nodes");
    const latAortic = worldCentres.get("lateral_aortic_nodes");

    const cisterna = latAortic
      ? new THREE.Vector3(latAortic.x + 0.004, latAortic.y - 0.04, latAortic.z - 0.045)
      : new THREE.Vector3(-0.003, 1.07, -0.018);

    const midThorax = azygos
      ? new THREE.Vector3(azygos.x + 0.008, azygos.y, azygos.z - 0.004)
      : new THREE.Vector3(-0.002, 1.24, -0.02);

    const t5Crossover = paraNodes
      ? new THREE.Vector3(0.012, paraNodes.y - 0.06, paraNodes.z - 0.01)
      : new THREE.Vector3(0.012, 1.32, -0.014);

    const venousAngle = new THREE.Vector3(0.028, 1.385, 0.006);

    const curve = new THREE.CatmullRomCurve3([
      cisterna,
      cisterna.clone().lerp(midThorax, 0.5),
      midThorax,
      t5Crossover,
      t5Crossover.clone().add(new THREE.Vector3(0.012, 0.045, 0.008)),
      venousAngle,
    ]);

    return buildSculptedTube(curve, 48, 10, (u) => {
      // Fusiform cisterna chyli at base (u < 0.14), then delicate beaded valvular duct (~1.4mm)
      if (u < 0.14) {
        return 0.0015 + 0.0022 * Math.sin((u / 0.14) * Math.PI);
      }
      const valveBead = 1 + 0.15 * Math.sin(u * Math.PI * 36);
      return 0.0014 * valveBead;
    });
  }

  if (organId === "vocal_folds") {
    const tracheaBox = worldBoxes.get("trachea");
    const larynxCenter = tracheaBox
      ? new THREE.Vector3(
          (tracheaBox.min.x + tracheaBox.max.x) * 0.5,
          tracheaBox.max.y + 0.014,
          (tracheaBox.min.z + tracheaBox.max.z) * 0.5,
        )
      : new THREE.Vector3(0.0, 1.472, 0.004);

    const antCommissure = larynxCenter.clone().add(new THREE.Vector3(0, 0, 0.009));
    const arytenoidL = larynxCenter.clone().add(new THREE.Vector3(0.0045, 0, -0.007));
    const arytenoidR = larynxCenter.clone().add(new THREE.Vector3(-0.0045, 0, -0.007));

    const leftCurve = new THREE.CatmullRomCurve3([antCommissure, arytenoidL]);
    const rightCurve = new THREE.CatmullRomCurve3([antCommissure, arytenoidR]);

    const leftFold = buildSculptedTube(leftCurve, 10, 8, () => 0.0018);
    const rightFold = buildSculptedTube(rightCurve, 10, 8, () => 0.0018);

    const merged = mergeGeometries([leftFold, rightFold], false);
    leftFold.dispose();
    rightFold.dispose();
    return merged;
  }

  return null;
}
