import { describe, expect, it } from "vitest";
import { getJointKinematicsProfile, getTissuePhysicsProfile } from "./biomechanicsCatalog";

describe("biomechanicsCatalog", () => {
  it("resolves MuscleMimic DoF and ROM profiles for major joints and muscles", () => {
    const elbow = getJointKinematicsProfile("biceps_brachii_l");
    expect(elbow).toBeDefined();
    expect(elbow?.dofCount).toBe(2);
    expect(elbow?.axes[0]?.romDegrees).toContain("145°");

    const knee = getJointKinematicsProfile("rectus_femoris_r");
    expect(knee).toBeDefined();
    expect(knee?.myoFullBodyId).toContain("knee_angle");
  });

  it("provides constitutive mechanical properties for every anatomical system", () => {
    const bone = getTissuePhysicsProfile("skeletal");
    expect(bone.youngsModulus).toContain("GPa");

    const muscle = getTissuePhysicsProfile("muscular");
    expect(muscle.constitutiveModel).toContain("Hill-type");
  });
});
