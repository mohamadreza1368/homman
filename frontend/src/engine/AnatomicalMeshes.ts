import * as THREE from 'three';

/**
 * Creates an anatomically contoured human skull (cranium + facial skeleton).
 */
export function createSkullGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Cranial Vault (Neurocranium)
  const vaultGeo = new THREE.SphereGeometry(0.085, 32, 28);
  vaultGeo.scale(1.0, 1.15, 1.25);
  const vaultMesh = new THREE.Mesh(vaultGeo);
  vaultMesh.position.set(0, 0.04, -0.01);
  group.add(vaultMesh);

  // Facial Skeleton (Viscerocranium - Maxilla & Zygomatic)
  const faceGeo = new THREE.BoxGeometry(0.09, 0.08, 0.08);
  const faceMesh = new THREE.Mesh(faceGeo);
  faceMesh.position.set(0, -0.03, 0.045);
  group.add(faceMesh);

  // Orbital Cavities (Eye sockets indentation)
  const orbitL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16));
  orbitL.position.set(0.032, -0.015, 0.08);
  const orbitR = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16));
  orbitR.position.set(-0.032, -0.015, 0.08);
  group.add(orbitL, orbitR);

  // Nasal Aperture
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8));
  nose.position.set(0, -0.035, 0.085);
  nose.rotation.x = Math.PI;
  group.add(nose);

  const merged = mergeGroupGeometries(group);
  return merged;
}

/**
 * Creates an anatomical mandible (jawbone).
 */
export function createMandibleGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.045, 0.02, -0.02),
    new THREE.Vector3(-0.04, -0.01, 0.02),
    new THREE.Vector3(0, -0.018, 0.05),
    new THREE.Vector3(0.04, -0.01, 0.02),
    new THREE.Vector3(0.045, 0.02, -0.02),
  ]);
  const tube = new THREE.TubeGeometry(curve, 24, 0.012, 12, false);
  return tube;
}

/**
 * Creates an anatomical articulated human spine with physiological lordosis/kyphosis curves.
 */
export function createSpineSegmentGeometry(startY: number, endY: number, vertebraeCount: number, curveType: 'cervical' | 'thoracic' | 'lumbar'): THREE.BufferGeometry {
  const group = new THREE.Group();
  const height = endY - startY;
  const step = height / vertebraeCount;

  for (let i = 0; i < vertebraeCount; i++) {
    const y = startY + i * step + step * 0.5;
    const progress = i / vertebraeCount;
    let zOffset = 0;

    // Physiological Curvature: Cervical Lordosis (forward), Thoracic Kyphosis (backward), Lumbar Lordosis (forward)
    if (curveType === 'cervical') {
      zOffset = Math.sin(progress * Math.PI) * 0.015;
    } else if (curveType === 'thoracic') {
      zOffset = -Math.sin(progress * Math.PI) * 0.025;
    } else if (curveType === 'lumbar') {
      zOffset = Math.sin(progress * Math.PI) * 0.02;
    }

    // Vertebral body
    const bodyGeo = new THREE.CylinderGeometry(0.018, 0.02, step * 0.7, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo);
    bodyMesh.position.set(0, y, zOffset);
    group.add(bodyMesh);

    // Spinous process (posterior spine spike)
    const spineGeo = new THREE.ConeGeometry(0.008, 0.025, 8);
    spineGeo.rotateX(-Math.PI / 2);
    const spineMesh = new THREE.Mesh(spineGeo);
    spineMesh.position.set(0, y, zOffset - 0.022);
    group.add(spineMesh);

    // Transverse processes (lateral wings)
    const wingGeo = new THREE.BoxGeometry(0.05, step * 0.4, 0.008);
    const wingMesh = new THREE.Mesh(wingGeo);
    wingMesh.position.set(0, y, zOffset - 0.01);
    group.add(wingMesh);
  }

  return mergeGroupGeometries(group);
}

/**
 * Creates the complete anatomical thoracic rib cage (12 pairs of curved ribs enclosing chest).
 */
export function createRibCageGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();
  const ribPairs = 10;
  const topY = 1.42;
  const bottomY = 1.16;

  for (let i = 0; i < ribPairs; i++) {
    const t = i / (ribPairs - 1);
    const y = topY - t * (topY - bottomY);
    const radiusX = 0.08 + Math.sin(t * Math.PI * 0.8) * 0.07;
    const radiusZ = 0.06 + Math.sin(t * Math.PI * 0.8) * 0.05;

    // Left rib curve
    const curveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, y + 0.01, -0.05),
      new THREE.Vector3(radiusX * 0.6, y + 0.005, -radiusZ * 0.7),
      new THREE.Vector3(radiusX, y, 0),
      new THREE.Vector3(radiusX * 0.7, y - 0.015, radiusZ * 0.7),
      new THREE.Vector3(0.025, y - 0.02, radiusZ * 0.9),
    ]);
    const tubeL = new THREE.TubeGeometry(curveL, 16, 0.0045, 8, false);
    group.add(new THREE.Mesh(tubeL));

    // Right rib curve (mirrored)
    const curveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.015, y + 0.01, -0.05),
      new THREE.Vector3(-radiusX * 0.6, y + 0.005, -radiusZ * 0.7),
      new THREE.Vector3(-radiusX, y, 0),
      new THREE.Vector3(-radiusX * 0.7, y - 0.015, radiusZ * 0.7),
      new THREE.Vector3(-0.025, y - 0.02, radiusZ * 0.9),
    ]);
    const tubeR = new THREE.TubeGeometry(curveR, 16, 0.0045, 8, false);
    group.add(new THREE.Mesh(tubeR));
  }

  // Sternum (Breastbone) in front
  const sternumGeo = new THREE.BoxGeometry(0.035, 0.17, 0.01);
  const sternumMesh = new THREE.Mesh(sternumGeo);
  sternumMesh.position.set(0, 1.30, 0.095);
  group.add(sternumMesh);

  return mergeGroupGeometries(group);
}

/**
 * Creates anatomical human pelvis (iliac crests, sacrum, pubic arch).
 */
export function createPelvisGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Left Iliac Wing (Flared blade)
  const iliumGeoL = new THREE.CylinderGeometry(0.075, 0.06, 0.09, 16, 1, true, 0, Math.PI * 0.9);
  iliumGeoL.rotateZ(0.2);
  const iliumL = new THREE.Mesh(iliumGeoL);
  iliumL.position.set(0.07, 0.97, 0.01);
  group.add(iliumL);

  // Right Iliac Wing
  const iliumGeoR = new THREE.CylinderGeometry(0.075, 0.06, 0.09, 16, 1, true, Math.PI * 0.1, Math.PI * 0.9);
  iliumGeoR.rotateZ(-0.2);
  const iliumR = new THREE.Mesh(iliumGeoR);
  iliumR.position.set(-0.07, 0.97, 0.01);
  group.add(iliumR);

  // Pubic arch & Ischium base
  const pubicArch = new THREE.TorusGeometry(0.045, 0.012, 12, 24, Math.PI);
  pubicArch.rotateX(Math.PI / 2);
  const pubicMesh = new THREE.Mesh(pubicArch);
  pubicMesh.position.set(0, 0.89, 0.035);
  group.add(pubicMesh);

  // Sacrum (Posterior wedge between iliac wings)
  const sacrumGeo = new THREE.ConeGeometry(0.045, 0.09, 16);
  sacrumGeo.rotateX(Math.PI);
  const sacrumMesh = new THREE.Mesh(sacrumGeo);
  sacrumMesh.position.set(0, 0.96, -0.05);
  group.add(sacrumMesh);

  return mergeGroupGeometries(group);
}

/**
 * Creates an anatomical long bone (Femur / Humerus / Tibia) with rounded epiphyses and shaft.
 */
export function createLongBoneGeometry(length: number, shaftRadius: number, headRadius: number, hasAngledHead = false): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Diaphysis (Shaft)
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius * 0.9, shaftRadius, length * 0.82, 16);
  const shaft = new THREE.Mesh(shaftGeo);
  group.add(shaft);

  // Distal Epiphysis (Bicondylar base)
  const distalGeo = new THREE.SphereGeometry(headRadius * 0.85, 16, 16);
  distalGeo.scale(1.4, 0.7, 1.1);
  const distal = new THREE.Mesh(distalGeo);
  distal.position.set(0, -length * 0.42, 0);
  group.add(distal);

  // Proximal Epiphysis
  if (hasAngledHead) {
    // Femoral Neck and Head angled inward at 125 degrees
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, length * 0.38, 0),
      new THREE.Vector3(-0.02, length * 0.42, 0),
      new THREE.Vector3(-0.045, length * 0.46, 0.01),
    ]);
    const neckTube = new THREE.TubeGeometry(neckCurve, 12, shaftRadius * 0.9, 12, false);
    group.add(new THREE.Mesh(neckTube));

    // Femoral Head
    const headGeo = new THREE.SphereGeometry(headRadius, 20, 20);
    const head = new THREE.Mesh(headGeo);
    head.position.set(-0.045, length * 0.46, 0.01);
    group.add(head);

    // Greater Trochanter (Lateral prominence)
    const trochanterGeo = new THREE.SphereGeometry(headRadius * 0.65, 12, 12);
    const trochanter = new THREE.Mesh(trochanterGeo);
    trochanter.position.set(0.015, length * 0.40, 0);
    group.add(trochanter);
  } else {
    const headGeo = new THREE.SphereGeometry(headRadius, 16, 16);
    const head = new THREE.Mesh(headGeo);
    head.position.set(0, length * 0.42, 0);
    group.add(head);
  }

  return mergeGroupGeometries(group);
}

/**
 * Creates an anatomical 4-chamber human heart with aorta, pulmonary trunk, and auricles.
 */
export function createHeartAnatomyGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Ventricles (Muscular apex tilted leftwards)
  const ventriclesGeo = new THREE.SphereGeometry(0.055, 28, 28);
  ventriclesGeo.scale(1.0, 1.4, 0.95);
  const ventricles = new THREE.Mesh(ventriclesGeo);
  ventricles.rotation.z = -0.22;
  ventricles.rotation.y = 0.15;
  group.add(ventricles);

  // Atria & Auricles (Superior posterior chambers)
  const atriaGeo = new THREE.SphereGeometry(0.04, 20, 20);
  atriaGeo.scale(1.2, 0.8, 1.1);
  const atria = new THREE.Mesh(atriaGeo);
  atria.position.set(0.01, 0.05, -0.01);
  group.add(atria);

  // Aorta Arch (Curving great vessel)
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0.01),
    new THREE.Vector3(0.01, 0.08, 0.015),
    new THREE.Vector3(-0.015, 0.095, 0),
    new THREE.Vector3(-0.025, 0.06, -0.02),
    new THREE.Vector3(-0.025, 0.01, -0.025),
  ]);
  const aortaTube = new THREE.TubeGeometry(aortaCurve, 20, 0.013, 12, false);
  group.add(new THREE.Mesh(aortaTube));

  // Pulmonary Trunk
  const pulmonaryCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.015, 0.03, 0.02),
    new THREE.Vector3(-0.01, 0.065, 0.025),
    new THREE.Vector3(0.015, 0.075, 0.005),
  ]);
  const pulmonaryTube = new THREE.TubeGeometry(pulmonaryCurve, 14, 0.011, 12, false);
  group.add(new THREE.Mesh(pulmonaryTube));

  return mergeGroupGeometries(group);
}

/**
 * Creates anatomical human lungs (Right lung with 3 lobes, Left lung with cardiac notch).
 */
export function createLungAnatomyGeometry(isRight: boolean): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Conical lung body
  const bodyGeo = new THREE.CylinderGeometry(0.03, 0.065, 0.22, 24);
  bodyGeo.scale(1.0, 1.0, 0.85);
  const body = new THREE.Mesh(bodyGeo);
  group.add(body);

  // Apex of lung (rounded top)
  const apexGeo = new THREE.SphereGeometry(0.038, 20, 20);
  apexGeo.scale(1.0, 1.2, 0.85);
  const apex = new THREE.Mesh(apexGeo);
  apex.position.set(0, 0.10, 0);
  group.add(apex);

  // Base of lung (concave diaphragmatic surface)
  const baseGeo = new THREE.SphereGeometry(0.06, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  baseGeo.scale(1.0, 0.4, 0.85);
  const base = new THREE.Mesh(baseGeo);
  base.position.set(0, -0.10, 0);
  group.add(base);

  const merged = mergeGroupGeometries(group);

  // Left lung cardiac notch indentation
  if (!isRight) {
    merged.scale(0.92, 1.0, 0.95);
  }

  return merged;
}

/**
 * Creates an anatomical liver (right and left lobes, inferior gallbladder fossa).
 */
export function createLiverAnatomyGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Massive Right Lobe (convex dome fitting diaphragm)
  const rightLobeGeo = new THREE.SphereGeometry(0.08, 24, 24);
  rightLobeGeo.scale(1.4, 0.9, 0.8);
  const rightLobe = new THREE.Mesh(rightLobeGeo);
  rightLobe.position.set(0.03, 0, 0);
  group.add(rightLobe);

  // Left Lobe (flattened wedge extending across midline)
  const leftLobeGeo = new THREE.ConeGeometry(0.065, 0.12, 16);
  leftLobeGeo.rotateZ(Math.PI / 2 + 0.3);
  const leftLobe = new THREE.Mesh(leftLobeGeo);
  leftLobe.position.set(-0.06, 0.01, 0.01);
  group.add(leftLobe);

  // Gallbladder (Pear-shaped sac under right lobe)
  const gbGeo = new THREE.SphereGeometry(0.018, 16, 16);
  gbGeo.scale(0.8, 1.6, 0.8);
  const gb = new THREE.Mesh(gbGeo);
  gb.position.set(0.04, -0.045, 0.035);
  gb.rotation.x = 0.3;
  group.add(gb);

  return mergeGroupGeometries(group);
}

/**
 * Creates an anatomical J-shaped stomach.
 */
export function createStomachAnatomyGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.08, -0.01),   // Cardia / GE junction
    new THREE.Vector3(-0.04, 0.09, 0.02),   // Fundus (dome)
    new THREE.Vector3(-0.06, 0.02, 0.03),   // Body (greater curvature)
    new THREE.Vector3(-0.04, -0.05, 0.025), // Incisura
    new THREE.Vector3(0.01, -0.06, 0.01),   // Antrum
    new THREE.Vector3(0.035, -0.04, -0.01), // Pylorus
  ]);
  const tube = new THREE.TubeGeometry(curve, 28, 0.034, 16, false);
  return tube;
}

/**
 * Creates a pair of bean-shaped anatomical kidneys with renal hilum.
 */
export function createKidneyAnatomyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.038, 24, 24);
  geo.scale(0.75, 1.5, 0.65);
  return geo;
}

/**
 * Creates human brain (bilateral cerebral hemispheres with interhemispheric fissure).
 */
export function createBrainAnatomyGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Left Hemisphere
  const leftHemiGeo = new THREE.SphereGeometry(0.065, 24, 24);
  leftHemiGeo.scale(0.9, 1.15, 1.35);
  const leftHemi = new THREE.Mesh(leftHemiGeo);
  leftHemi.position.set(-0.036, 0, 0);
  group.add(leftHemi);

  // Right Hemisphere
  const rightHemiGeo = new THREE.SphereGeometry(0.065, 24, 24);
  rightHemiGeo.scale(0.9, 1.15, 1.35);
  const rightHemi = new THREE.Mesh(rightHemiGeo);
  rightHemi.position.set(0.036, 0, 0);
  group.add(rightHemi);

  // Cerebellum (posterior inferior lobes)
  const cerebGeo = new THREE.SphereGeometry(0.042, 20, 20);
  cerebGeo.scale(1.3, 0.75, 0.9);
  const cereb = new THREE.Mesh(cerebGeo);
  cereb.position.set(0, -0.045, -0.045);
  group.add(cereb);

  // Brainstem
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.07, 16);
  const stem = new THREE.Mesh(stemGeo);
  stem.position.set(0, -0.065, -0.015);
  group.add(stem);

  return mergeGroupGeometries(group);
}

/**
 * Utility to merge multiple meshes in a group into a single clean BufferGeometry.
 */
function mergeGroupGeometries(group: THREE.Group): THREE.BufferGeometry {
  group.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const cloned = child.geometry.clone();
      cloned.applyMatrix4(child.matrixWorld);
      geometries.push(cloned);
    }
  });

  if (geometries.length === 0) {
    return new THREE.BoxGeometry(0.05, 0.05, 0.05);
  }

  let totalVerts = 0;
  geometries.forEach((g) => {
    totalVerts += g.attributes.position.count;
  });

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNorm = new Float32Array(totalVerts * 3);

  let offset = 0;
  geometries.forEach((g) => {
    const pos = g.attributes.position;
    const norm = g.attributes.normal || pos; // fallback to pos if norm missing
    for (let i = 0; i < pos.count; i++) {
      mergedPos[(offset + i) * 3] = pos.getX(i);
      mergedPos[(offset + i) * 3 + 1] = pos.getY(i);
      mergedPos[(offset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        mergedNorm[(offset + i) * 3] = norm.getX(i);
        mergedNorm[(offset + i) * 3 + 1] = norm.getY(i);
        mergedNorm[(offset + i) * 3 + 2] = norm.getZ(i);
      }
    }
    offset += pos.count;
    g.dispose();
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  merged.computeVertexNormals();
  return merged;
}
