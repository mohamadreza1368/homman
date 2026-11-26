import { describe, expect, it } from "vitest";
import { MICRO_ANATOMY_CATALOG, getMicroAnatomyProfile } from "./microAnatomyCatalog";

describe("microAnatomyCatalog", () => {
  it("contains 5 core organ micro-anatomy & histology profiles", () => {
    expect(MICRO_ANATOMY_CATALOG.length).toBe(5);
    expect(getMicroAnatomyProfile("kidney_l")?.id).toBe("renal_nephron");
    expect(getMicroAnatomyProfile("liver")?.id).toBe("hepatic_lobule");
    expect(getMicroAnatomyProfile("inferior_lobe_of_right_lung")?.id).toBe("alveolar_unit");
    expect(getMicroAnatomyProfile("stomach")?.id).toBe("gastric_gland");
    expect(getMicroAnatomyProfile("spinal_dura")?.id).toBe("meninges_bbb");
  });

  it("includes specialized cellular layers for renal nephron and gastric gland", () => {
    const stomach = getMicroAnatomyProfile("mucosa_of_stomach");
    expect(stomach).toBeDefined();
    expect(stomach?.layers.some((l) => l.nameEn.includes("Parietal"))).toBe(true);
    expect(stomach?.layers.some((l) => l.nameEn.includes("Chief"))).toBe(true);
  });
});
