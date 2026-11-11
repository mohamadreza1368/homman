"""
Script: build_release_data.py
Purpose:
  Single reproducible data pipeline command exporting validated, provenance-tagged JSON bundles
  from medical_knowledge.db and BodyParts3D atlas.json:
    1. frontend/src/data/anatomyCatalog.json (Canonical AnatomyRecord list with unique meshNames)
    2. frontend/src/data/pathologyKnowledgeGraph.json (Versioned Knowledge Graph with provenance & license metadata)
    3. pipeline/reports/unmapped_meshes_report.json (Developer audit report of unmapped 3D meshes)

Usage:
  python pipeline/scripts/build_release_data.py
  python pipeline/scripts/build_release_data.py --check
"""

import argparse
import datetime
import json
import os
import sqlite3
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
DB_PATH = os.path.join(ROOT_DIR, "pipeline", "data", "medical_knowledge.db")
ATLAS_PATH = os.path.join(ROOT_DIR, "frontend", "public", "models", "atlas.json")
CATALOG_OUT = os.path.join(ROOT_DIR, "frontend", "src", "data", "anatomyCatalog.json")
KG_OUT = os.path.join(ROOT_DIR, "frontend", "src", "data", "pathologyKnowledgeGraph.json")
REPORT_OUT = os.path.join(ROOT_DIR, "pipeline", "reports", "unmapped_meshes_report.json")

SCHEMA_VERSION = "2.0.0"
SOURCE_VERSION = "BodyParts3D-4.0 / FMA-4.6 / KB-2026.1"
REVIEWER_NAME = "دکتر محمدرضا — بازبینی علمی اولیه (در انتظار تأیید نهایی هیئت علمی پزشکی)"
REVIEWED_DATE = "2026-11-11"
LICENSE_RESTRICTION = (
    "محتوای آموزشی غیربالینی؛ شناسه‌های FMA، SNOMED CT و ICD صرفاً برای ارجاع آموزشی "
    "و نمایه علمی درج شده‌اند و تابع مجوزهای سازمان‌های مرجع خود هستند."
)

SYSTEM_NORMALIZE = {
    "skeletal": "skeletal",
    "muscular": "muscular",
    "circulatory": "cardiovascular",
    "cardiovascular": "cardiovascular",
    "respiratory": "respiratory",
    "digestive": "digestive",
    "nervous": "nervous",
    "urinary": "urinary",
    "integumentary": "integumentary",
    "endocrine": "endocrine",
    "lymphatic": "lymphatic",
    "reproductive": "reproductive",
}


def stable_id_from_fma(fma_id: str, name_en: str) -> str:
    slug = (
        fma_id.lower()
        .replace("fma", "")
        .replace(" ", "_")
    )
    name_slug = (
        "".join(ch if ch.isalnum() else "_" for ch in name_en.lower())
        .strip("_")
    )
    while "__" in name_slug:
        name_slug = name_slug.replace("__", "_")
    return f"anatomy:{name_slug[:40]}_{slug}"


def match_parts_for_record(fma_id: str, part: dict) -> bool:
    """Deterministic non-overlapping assignment rules mapping each atlas.json part ID to at most one AnatomyRecord."""
    name = part["name"].lower()
    sys_name = part["system"]

    # 1. Cardiac vs Brain Ventricles disambiguation (Critical: brain ventricles NEVER belong to cardiac)
    is_brain_ventricle = any(
        k in name for k in ("lateral ventricle", "third ventricle", "fourth ventricle", "interventricular foramen")
    )

    if fma_id == "FMA7088":  # Whole Heart (ventricles, atria, myocardium wall, and valves)
        return sys_name == "cardiac" and not is_brain_ventricle
    if fma_id == "FMA7197":  # Sub-tissue reference (SEP myocardium)
        return False
    if fma_id == "FMA242784":  # Brain ventricles (CSF cavities)
        return is_brain_ventricle
    if fma_id == "FMA7163":  # Skin / Integumentary
        return sys_name == "integumentary"
    if fma_id == "FMA7165":  # Aorta
        return sys_name == "arterial" and "aorta" in name
    if fma_id == "FMA4720":  # Pulmonary artery
        return sys_name == "arterial" and "pulmonary artery" in name
    if fma_id == "FMA4721":  # Superior vena cava
        return sys_name == "venous" and "superior vena cava" in name
    if fma_id == "FMA4722":  # Inferior vena cava
        return sys_name == "venous" and "inferior vena cava" in name
    if fma_id == "FMA7394":  # Trachea
        return name == "trachea"
    if fma_id == "FMA55099":  # Larynx (epiglottis + thyroid cartilage)
        return part["id"] in ("FJ2770", "FJ2808")
    if fma_id == "FMA7195":  # Right lung: 3 authentic lung lobes + right bronchial tree
        return sys_name == "respiratory" and (
            "right" in name and ("bronch" in name or "bronchus" in name)
        )
    if fma_id == "FMA7196":  # Left lung: 2 authentic lung lobes + left bronchial tree
        return sys_name == "respiratory" and (
            ("left" in name or "lingular" in name) and ("bronch" in name or "lingular" in name)
        )
    if fma_id == "FMA14654":
        return part["id"] == "FJ3079"  # Common hepatic duct
    if fma_id == "FMA14653":
        return part["id"] == "FJ3096"  # Left hepatic duct
    if fma_id == "FMA14652":
        return part["id"] == "FJ3123"  # Right hepatic duct
    if fma_id == "FMA7199":  # Whole Liver: Hepatovenous Couinaud segments II..IX + Caudate lobe + biliary tributaries
        return (
            part["id"] == "FJ2816"
            or "hepatovenous segment" in name
            or (sys_name == "digestive" and ("hepatic biliary tree" in name or "caudate lobe" in name))
        )
    if fma_id == "FMA7202":
        return part["id"] in ("FJ2817", "FJ3080")  # Gallbladder + Cystic duct
    if fma_id == "FMA7148":
        return name == "stomach"
    if fma_id == "FMA7198":
        return "pancreas" in name or "pancreatic duct" in name
    if fma_id == "FMA7200":  # Small intestine
        return sys_name == "digestive" and any(k in name for k in ("duodenum", "jejunum", "ileum"))
    if fma_id == "FMA7203":  # Large intestine
        return sys_name == "digestive" and any(k in name for k in ("colon", "rectum", "appendix"))
    if fma_id == "FMA7201_L":
        return name == "left kidney"
    if fma_id == "FMA7201_R":
        return name == "right kidney"
    if fma_id == "FMA7204":
        return name == "urinary bladder"
    if fma_id == "FMA5018":  # Cerebrum
        return (
            sys_name in ("nervous", "brain")
            and not is_brain_ventricle
            and any(
                k in name
                for k in (
                    "gyrus", "lobe", "insula", "hippocampus", "corpus callosum",
                    "thalamus", "amygdala", "caudate", "putamen", "globus",
                    "fornix", "white matter", "internal capsule", "commissure"
                )
            )
        )
    if fma_id == "FMA5080":
        return "cerebellum" in name and sys_name in ("nervous", "brain")
    if fma_id == "FMA7130":
        return sys_name in ("nervous", "brain") and name in ("pons", "midbrain", "medulla oblongata")
    if fma_id == "FMA7131":
        return part["id"] == "FJ1737"  # Central canal of spinal cord
    if fma_id == "FMA5018_SKULL":
        return sys_name == "skeletal" and any(
            k in name
            for k in (
                "frontal bone", "parietal bone", "occipital bone", "temporal bone",
                "sphenoid bone", "ethmoid", "maxilla", "zygomatic bone", "nasal bone"
            )
        )
    if fma_id == "FMA52749":
        return sys_name == "skeletal" and "mandible" in name
    if fma_id == "FMA13478":
        return sys_name == "skeletal" and any(
            k in name for k in ("cervical vertebra", "atlas", "axis")
        )
    if fma_id == "FMA13479":
        return sys_name == "skeletal" and "thoracic vertebra" in name
    if fma_id == "FMA13480":
        return sys_name == "skeletal" and "lumbar vertebra" in name
    if fma_id == "FMA16202":
        return sys_name == "skeletal" and name == "sacrum"
    if fma_id == "FMA7485":
        return sys_name == "skeletal" and "sternum" in name
    if fma_id == "FMA7574":
        return sys_name == "skeletal" and "rib" in name
    if fma_id == "FMA13328":
        return sys_name == "skeletal" and "clavicle" in name
    if fma_id == "FMA13329":
        return sys_name == "skeletal" and name.endswith("scapula")
    if fma_id == "FMA16585":
        return sys_name == "skeletal" and name.endswith("humerus")
    if fma_id == "FMA23466":
        return sys_name == "skeletal" and name.endswith("radius")
    if fma_id == "FMA23467":
        return sys_name == "skeletal" and name.endswith("ulna")
    if fma_id == "FMA16586":
        return sys_name == "skeletal" and "hip bone" in name
    if fma_id == "FMA9915":
        return sys_name == "skeletal" and name.endswith("femur")
    if fma_id == "FMA24467":
        return sys_name == "skeletal" and name.endswith("patella")
    if fma_id == "FMA24476":
        return sys_name == "skeletal" and name.endswith("tibia")
    if fma_id == "FMA24477":
        return sys_name == "skeletal" and name.endswith("fibula")
    if fma_id == "FMA7194":
        return name == "spleen"
    if fma_id == "FMA7193":
        return "thymus" in name
    if fma_id == "FMA13889":
        return "pituitary gland" in name
    if fma_id == "FMA9604":
        return "adrenal gland" in name
    if fma_id == "FMA37670":  # Biceps brachii (extra muscular educational landmark)
        return "biceps brachii" in name
    return False


# Authentic bilingual descriptions mapped cleanly by FMA ID
Z_ANATOMY_HINTS = {
    "FMA7088": ["Left_ventricle", "Right_ventricle", "Left_atrium", "Right_atrium", "Aortic_valve", "Mitral_valve"],
    "FMA7197": ["Papillary_muscles", "Myocardium"],
    "FMA7195": ["Right_lung", "Superior_lobe_of_right_lung", "Middle_lobe_of_right_lung", "Inferior_lobe_of_right_lung"],
    "FMA7196": ["Left_lung", "Superior_lobe_of_left_lung", "Inferior_lobe_of_left_lung"],
    "FMA7199": ["Liver", "Right_lobe_of_liver", "Left_lobe_of_liver"],
    "FMA7148": ["Stomach"],
    "FMA7201_L": ["Left_kidney"],
    "FMA7201_R": ["Right_kidney"],
    "FMA5018": ["Frontal_lobe", "Parietal_lobe", "Temporal_lobe", "Occipital_lobe", "Corpus_callosum"],
    "FMA9915": ["Femur.l", "Femur.r"],
    "FMA37670": ["Biceps_brachii"],
    "FMA7194": ["Spleen"],
    "FMA242784": ["Lateral_ventricle", "Third_ventricle", "Fourth_ventricle"],
}

# Authentic curated pathology clinical mechanism Persian + English descriptions
DISORDER_DESCRIPTIONS_FA = {
    "22298006": "نکروز ایسکمیک بافت میوکارد ناشی از کاهش یا انسداد خون‌رسانی کرونری (نمایش آموزشی مفهومی).",
    "427396001": "آسیب ایسکمیک دیواره تحتانی بطن چپ در قلمرو عروق کرونری (نمایش آموزشی مفهومی).",
    "371041009": "واکنش التهابی کیسه‌ی پریکارد اطراف قلب همراه با تجمع مایع آموزشی.",
    "233604007": "التهاب پارانشیم ریه و فضاهای آلوئولی در واکنش به عوامل عفونی.",
    "363358000": "تکثیر نئوپلاستیک سلول‌های بافت ریه با کد توپوگرافی انکولوژی ICD-O C34.9.",
    "195967001": "تنگی مجاری هوایی برونش همراه با التهاب مزمن دیواره راه‌های تنفسی.",
    "197365007": "فیبروز پیش‌رونده بافت کبد و بازسازی ندولار پارانشیم هپاتیک.",
    "235856003": "پاسخ التهابی کبدی با تغییرات رنگ‌دانه و تورم موضعی (مفهومی).",
    "230690007": "کاهش خون‌رسانی در قلمرو عروقی نیمکره مخ مغز.",
    "202722002": "تغییر شکل دیسک بین‌مهره‌ای و مجاورت با ریشه‌های عصبی نخاع.",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify generated output matches files on disk")
    args = parser.parse_args()

    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Missing SQLite database: {DB_PATH}")
        sys.exit(1)

    atlas_parts = []
    if os.path.exists(ATLAS_PATH):
        with open(ATLAS_PATH, "r", encoding="utf-8") as f:
            atlas_parts = json.load(f).get("parts", [])
    else:
        print(f"[WARN] {ATLAS_PATH} not present; preserving existing catalog meshNames if available.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT fma_id, snomed_body_structure_id, name_en, name_fa, system_category,
               bbox_min_x, bbox_min_y, bbox_min_z, bbox_max_x, bbox_max_y, bbox_max_z
        FROM anatomical_structures
        ORDER BY system_category ASC, fma_id ASC
        """
    ).fetchall()

    # Supplementary anatomical landmarks present in UI callouts & BodyParts3D
    extra_records_defs = [
        {
            "fma_id": "FMA37670",
            "snomed_body_structure_id": "244778006",
            "name_en": "Biceps brachii muscle",
            "name_fa": "عضله دوسر بازو",
            "system_category": "Muscular",
            "bbox": [-0.26, 1.07, -0.04, 0.26, 1.42, 0.04],
        },
        {
            "fma_id": "FMA242784",
            "snomed_body_structure_id": "35764002",
            "name_en": "Cerebral ventricular system (CSF cavities)",
            "name_fa": "بطن‌های مغزی (حفرات مایع مغزی-نخاعی)",
            "system_category": "Nervous",
            "bbox": [-0.04, 1.56, -0.08, 0.04, 1.66, 0.03],
        },
    ]

    all_structure_rows = [dict(r) for r in rows] + extra_records_defs

    assigned_mesh_ids = set()
    catalog_records = []
    record_by_fma = {}

    for row in all_structure_rows:
        fma_id = row["fma_id"]
        sys_cat = SYSTEM_NORMALIZE.get(row["system_category"].lower(), "skeletal")
        rec_id = stable_id_from_fma(fma_id, row["name_en"])

        matched_mesh_ids = []
        for p in atlas_parts:
            if p["id"] in assigned_mesh_ids:
                continue
            if match_parts_for_record(fma_id, p):
                matched_mesh_ids.append(p["id"])
                assigned_mesh_ids.add(p["id"])

        # Attach authentic 5-lobe lung meshes extracted from Z-Anatomy (lungs-lobes.glb)
        if fma_id == "FMA7195":
            for lid in ("BP3D_LUNG_R_SUP", "BP3D_LUNG_R_MID", "BP3D_LUNG_R_INF"):
                if lid not in assigned_mesh_ids:
                    matched_mesh_ids.append(lid)
                    assigned_mesh_ids.add(lid)
        elif fma_id == "FMA7196":
            for lid in ("BP3D_LUNG_L_SUP", "BP3D_LUNG_L_INF"):
                if lid not in assigned_mesh_ids:
                    matched_mesh_ids.append(lid)
                    assigned_mesh_ids.add(lid)

        bbox = (
            row.get("bbox")
            or [
                row["bbox_min_x"],
                row["bbox_min_y"],
                row["bbox_min_z"],
                row["bbox_max_x"],
                row["bbox_max_y"],
                row["bbox_max_z"],
            ]
        )

        record = {
            "id": rec_id,
            "fmaId": fma_id,
            "snomedBodyStructureId": row["snomed_body_structure_id"],
            "meshNames": matched_mesh_ids,
            "zAnatomyNames": Z_ANATOMY_HINTS.get(fma_id, [row["name_en"].replace(" ", "_")]),
            "nameEn": row["name_en"],
            "nameFa": row["name_fa"],
            "system": sys_cat,
            "bbox": bbox,
            "descriptionEn": f"{row['name_en']} ({fma_id}) indexed anatomical structure in the {sys_cat} system for educational reference.",
            "descriptionFa": f"ساختار تشریحی {row['name_fa']} (شناسه مرجع {fma_id}) در دستگاه {sys_cat} — جهت آموزش و مرجع تصویری آناتومی.",
            "source": "BodyParts3D v4.0 + FMA v4.6",
            "sourceVersion": SOURCE_VERSION,
            "reviewedBy": REVIEWER_NAME,
            "reviewedAt": REVIEWED_DATE,
            "contentStatus": "reference",
        }
        catalog_records.append(record)
        record_by_fma[fma_id] = record

    unmapped_parts = [
        {"id": p["id"], "name": p["name"], "conceptId": p["conceptId"], "system": p["system"]}
        for p in atlas_parts
        if p["id"] not in assigned_mesh_ids
    ]

    catalog_bundle = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": REVIEWED_DATE,
        "terminologyNotice": LICENSE_RESTRICTION,
        "reviewedBy": REVIEWER_NAME,
        "reviewedAt": REVIEWED_DATE,
        "records": catalog_records,
    }

    # Export Versioned Knowledge Graph with Full Provenance
    kg_organs = {}
    total_relations = 0

    for row in rows:
        fma_id = row["fma_id"]
        snomed_root = row["snomed_body_structure_id"]

        query_sql = """
        WITH RECURSIVE descendants AS (
            SELECT CAST(:snomed_root AS VARCHAR) AS structure_id, 0 AS depth
            UNION ALL
            SELECT sep.child_snomed_id, d.depth + 1
            FROM anatomy_hierarchy_sep sep
            INNER JOIN descendants d ON sep.parent_snomed_id = d.structure_id
            WHERE d.depth < 10
        )
        SELECT DISTINCT
            dp.snomed_disorder_id,
            dp.icd10_code,
            dp.icdo_topography_code,
            dp.orphan_code,
            dp.fsn_en,
            dp.preferred_term_fa,
            dp.clinical_department,
            dp.etiology_category,
            dp.associated_morphology_id,
            dp.clinical_course,
            dp.visual_preset_type
        FROM disorders_pathology dp
        INNER JOIN descendants desc ON dp.finding_site_snomed_id = desc.structure_id
        ORDER BY dp.clinical_department, dp.preferred_term_fa;
        """
        cursor.execute(query_sql, {"snomed_root": snomed_root})
        disorders = []
        for drow in cursor.fetchall():
            snomed_dis_id = drow[0]
            icd10 = drow[1]
            fsn_en = drow[4]
            term_fa = drow[5]
            dept = drow[6]
            preset = drow[10]

            desc_fa = DISORDER_DESCRIPTIONS_FA.get(
                snomed_dis_id,
                f"{term_fa} ({fsn_en}) با کد ارجاع {icd10 or 'نامشخص'} در حیطه تخصصی {dept}. این محتوا صرفاً جنبه نمایش مفهومی و آموزشی دارد.",
            )
            desc_en = (
                f"Educational visual concept for {fsn_en} "
                f"(SNOMED CT {snomed_dis_id}, ICD-10 {icd10 or 'N/A'}) mapped to {row['name_en']}."
            )

            disorders.append(
                {
                    "snomedDisorderId": snomed_dis_id,
                    "icd10Code": icd10,
                    "icdoTopographyCode": drow[2],
                    "orphanCode": drow[3],
                    "fsnEn": fsn_en,
                    "preferredTermFa": term_fa,
                    "clinicalDepartment": dept,
                    "etiologyCategory": drow[7],
                    "associatedMorphologyId": drow[8],
                    "clinicalCourse": drow[9],
                    "visualPresetType": preset,
                    "descriptionEn": desc_en,
                    "descriptionFa": desc_fa,
                    "source": "OMOP / SNOMED CT SEP Curated Educational Graph",
                    "sourceVersion": SOURCE_VERSION,
                    "reviewedBy": REVIEWER_NAME,
                    "reviewedAt": REVIEWED_DATE,
                    "contentStatus": "educational_visualization",
                    "licenseRestriction": LICENSE_RESTRICTION,
                }
            )
            total_relations += 1

        if disorders:
            rec = record_by_fma.get(fma_id)
            kg_organs[fma_id] = {
                "recordId": rec["id"] if rec else stable_id_from_fma(fma_id, row["name_en"]),
                "fmaId": fma_id,
                "nameEn": row["name_en"],
                "nameFa": row["name_fa"],
                "snomedRootId": snomed_root,
                "source": "OMOP / SNOMED CT SEP Curated Educational Graph",
                "sourceVersion": SOURCE_VERSION,
                "reviewedBy": REVIEWER_NAME,
                "reviewedAt": REVIEWED_DATE,
                "contentStatus": "educational_visualization",
                "licenseRestriction": LICENSE_RESTRICTION,
                "disorders": disorders,
            }

    kg_bundle = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": REVIEWED_DATE,
        "terminologyNotice": LICENSE_RESTRICTION,
        "organs": kg_organs,
    }

    report_bundle = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "totalAtlasParts": len(atlas_parts),
        "mappedPartsCount": len(assigned_mesh_ids),
        "unmappedPartsCount": len(unmapped_parts),
        "note": (
            "Unmapped anatomical sub-structures (e.g. minor vascular branches/individual muscles) "
            "must NOT be shown with clinical pathology assertions in public UI."
        ),
        "unmappedSample": unmapped_parts[:100],
    }

    if args.check:
        with open(CATALOG_OUT, "r", encoding="utf-8") as f:
            existing_cat = json.load(f)
        with open(KG_OUT, "r", encoding="utf-8") as f:
            existing_kg = json.load(f)
        if existing_cat != catalog_bundle or existing_kg != kg_bundle:
            print("[FAIL] Exported JSON files do not match pipeline output. Run build_release_data.py.")
            sys.exit(1)
        print("[OK] Pipeline check passed cleanly.")
        conn.close()
        return

    os.makedirs(os.path.dirname(REPORT_OUT), exist_ok=True)
    with open(CATALOG_OUT, "w", encoding="utf-8") as f:
        json.dump(catalog_bundle, f, ensure_ascii=False, indent=2)
    with open(KG_OUT, "w", encoding="utf-8") as f:
        json.dump(kg_bundle, f, ensure_ascii=False, indent=2)
    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        json.dump(report_bundle, f, ensure_ascii=False, indent=2)

    conn.close()
    print(
        f"[OK] Exported {len(catalog_records)} AnatomyRecords ({len(assigned_mesh_ids)} mapped atlas meshes, "
        f"{len(unmapped_parts)} unmapped in dev report) and {len(kg_organs)} organs / {total_relations} educational disorders."
    )


if __name__ == "__main__":
    main()
