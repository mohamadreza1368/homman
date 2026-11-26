#!/usr/bin/env node
/**
 * HOOMAAN Asset Pipeline - MuscleMimic (MyoFullBody) Extractor
 *
 * Parses all MuJoCo XML files in vendor_refs/musclemimic_models/musclemimic_models/model/
 * to extract empirical joints (axis, range_rad, range_deg), muscles (force, tendon),
 * and spatial tendon routing site lists into public/anatomy/musclemimic_data.json.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const MODEL_DIR = join(PROJECT_ROOT, "vendor_refs", "musclemimic_models", "musclemimic_models", "model");
const OUT_JSON = join(PROJECT_ROOT, "public", "anatomy", "musclemimic_data.json");

function parseAttrs(tagStr) {
  const attrs = {};
  for (const m of tagStr.matchAll(/([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  for (const m of tagStr.matchAll(/([a-zA-Z0-9_]+)\s*=\s*'([^']*)'/g)) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function walkXml(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) walkXml(full, out);
    else if (f.endsWith(".xml")) out.push(full);
  }
  return out;
}

function main() {
  const xmlFiles = walkXml(MODEL_DIR);
  const joints = new Map();
  const muscles = new Map();
  const tendons = new Map();

  for (const file of xmlFiles) {
    const xml = readFileSync(file, "utf8");

    for (const m of xml.matchAll(/<joint\s+([^>]+)\/?>/g)) {
      const a = parseAttrs(m[1]);
      if (!a.name || a.name === "root") continue;
      const rangeRad = a.range ? a.range.trim().split(/\s+/).map(Number) : null;
      const rangeDeg = rangeRad
        ? rangeRad.map((r) => Number(((r * 180) / Math.PI).toFixed(1)))
        : null;
      joints.set(a.name, {
        name: a.name,
        axis: a.axis ? a.axis.trim().split(/\s+/).map(Number) : [0, 0, 1],
        range_rad: rangeRad,
        range_deg: rangeDeg,
        damping: a.damping ? Number(a.damping) : undefined,
      });
    }

    for (const m of xml.matchAll(/<muscle\s+([^>]+)\/?>/g)) {
      const a = parseAttrs(m[1]);
      if (!a.name) continue;
      muscles.set(a.name, {
        name: a.name,
        tendon: a.tendon ?? a.name,
        force: a.force ? Number(a.force) : undefined,
        scale: a.scale ? Number(a.scale) : undefined,
      });
    }

    for (const m of xml.matchAll(/<spatial\s+([^>]*)>([\s\S]*?)<\/spatial>/g)) {
      const a = parseAttrs(m[1]);
      if (!a.name) continue;
      const sites = [...m[2].matchAll(/<site\s+[^>]*site=["']([^"']+)["']/g)].map((s) => s[1]);
      tendons.set(a.name, {
        name: a.name,
        site_count: sites.length,
        sites,
      });
    }
  }

  const payload = {
    source: "amathislab/musclemimic_models (MyoFullBody)",
    joint_count: joints.size,
    muscle_count: muscles.size,
    tendon_count: tendons.size,
    joints: [...joints.values()],
    muscles: [...muscles.values()],
    tendons: [...tendons.values()],
  };

  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `[MuscleMimic] Extracted ${payload.joint_count} joints, ${payload.muscle_count} muscles, ${payload.tendon_count} tendons -> ${OUT_JSON}`,
  );
}

main();
