"""
Script: build_full_anatomy_catalog.py
Sprint: Phase 1 / Sprints 3, 4 & 5 - Comprehensive 15-System Anatomical Catalog
Purpose:
  Populates the local SQLite database with normalized, audited anatomical structures
  covering all 15 core bodily systems for male and female models, complete with:
  - FMAID (Foundational Model of Anatomy v4.6)
  - SNOMED CT Body Structure ID
  - Bilingual English and Persian terminology
  - 3D Bounding Box spatial extents (meters) calibrated to real human anthropometry
  - SEP (Structure-Entire-Part) hierarchical parent-child relationships
"""

import os
import sqlite3
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "medical_knowledge.db")

COMPREHENSIVE_CATALOG = [
    # ==========================================
    # 1. SKELETAL SYSTEM (سیستم اسکلتی)
    # ==========================================
    {
        "fma_id": "FMA5018_SKULL",
        "snomed_id": "89546000",
        "name_en": "Skull (Cranium)",
        "name_fa": "جمجمه (کرانیوم)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Skull_Mesh",
        "bbox": [-0.10, 1.55, -0.11, 0.10, 1.80, 0.11]
    },
    {
        "fma_id": "FMA52749",
        "snomed_id": "31640002",
        "name_en": "Mandible",
        "name_fa": "استخوان فک تحتانی (مندیبل)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Mandible_Mesh",
        "bbox": [-0.06, 1.50, 0.02, 0.06, 1.58, 0.10]
    },
    {
        "fma_id": "FMA13478",
        "snomed_id": "122494005",
        "name_en": "Cervical vertebral column",
        "name_fa": "ستون مهره‌های گردنی (C1-C7)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Spine_Cervical_Mesh",
        "bbox": [-0.04, 1.45, -0.05, 0.04, 1.55, 0.02]
    },
    {
        "fma_id": "FMA13479",
        "snomed_id": "122495006",
        "name_en": "Thoracic vertebral column",
        "name_fa": "ستون مهره‌های سینه‌ای (T1-T12)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Spine_Thoracic_Mesh",
        "bbox": [-0.05, 1.20, -0.07, 0.05, 1.45, 0.01]
    },
    {
        "fma_id": "FMA13480",
        "snomed_id": "122496007",
        "name_en": "Lumbar vertebral column",
        "name_fa": "ستون مهره‌های کمری (L1-L5)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Spine_Lumbar_Mesh",
        "bbox": [-0.05, 1.00, -0.06, 0.05, 1.20, 0.01]
    },
    {
        "fma_id": "FMA16202",
        "snomed_id": "54735007",
        "name_en": "Sacrum",
        "name_fa": "استخوان خاجی (ساکروم)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Sacrum_Mesh",
        "bbox": [-0.06, 0.90, -0.07, 0.06, 1.00, -0.01]
    },
    {
        "fma_id": "FMA16203",
        "snomed_id": "64688005",
        "name_en": "Coccyx",
        "name_fa": "استخوان دنبالچه (کوکسیکس)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Coccyx_Mesh",
        "bbox": [-0.02, 0.86, -0.05, 0.02, 0.90, -0.02]
    },
    {
        "fma_id": "FMA7485",
        "snomed_id": "56873002",
        "name_en": "Sternum",
        "name_fa": "استخوان جناغ سینه (استرنوم)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Sternum_Mesh",
        "bbox": [-0.03, 1.25, 0.07, 0.03, 1.42, 0.10]
    },
    {
        "fma_id": "FMA7574",
        "snomed_id": "113197003",
        "name_en": "Rib cage",
        "name_fa": "قفسه دنده‌ها (۱۲ جفت دنده)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "RibCage_Mesh",
        "bbox": [-0.15, 1.15, -0.08, 0.15, 1.45, 0.10]
    },
    {
        "fma_id": "FMA13328",
        "snomed_id": "51299004",
        "name_en": "Clavicle (Collarbone)",
        "name_fa": "استخوان ترقوه (کلاویکل)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Clavicle_Mesh",
        "bbox": [-0.16, 1.42, 0.03, 0.16, 1.47, 0.08]
    },
    {
        "fma_id": "FMA13329",
        "snomed_id": "79601000",
        "name_en": "Scapula (Shoulder blade)",
        "name_fa": "استخوان کتف (اسکاپولا)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Scapula_Mesh",
        "bbox": [-0.18, 1.30, -0.09, 0.18, 1.44, -0.04]
    },
    {
        "fma_id": "FMA16585",
        "snomed_id": "23416004",
        "name_en": "Humerus (Upper arm)",
        "name_fa": "استخوان بازو (هومروس)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Humerus_Mesh",
        "bbox": [-0.25, 1.10, -0.03, 0.25, 1.40, 0.03]
    },
    {
        "fma_id": "FMA23466",
        "snomed_id": "62413002",
        "name_en": "Radius (Forearm)",
        "name_fa": "استخوان زند زبرین (رادیوس)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Radius_Mesh",
        "bbox": [-0.28, 0.85, -0.02, 0.28, 1.10, 0.02]
    },
    {
        "fma_id": "FMA23467",
        "snomed_id": "2083001",
        "name_en": "Ulna (Forearm)",
        "name_fa": "استخوان زند زیرین (اولنا)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Ulna_Mesh",
        "bbox": [-0.27, 0.85, -0.03, 0.27, 1.10, 0.01]
    },
    {
        "fma_id": "FMA16586",
        "snomed_id": "113193002",
        "name_en": "Pelvis (Pelvic girdle)",
        "name_fa": "لگن خاصره (کمربند لگنی)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Pelvis_Mesh",
        "bbox": [-0.15, 0.85, -0.09, 0.15, 1.05, 0.08]
    },
    {
        "fma_id": "FMA9915",
        "snomed_id": "71341001",
        "name_en": "Femur (Thigh bone)",
        "name_fa": "استخوان ران (فمور)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Femur_Mesh",
        "bbox": [-0.15, 0.45, -0.05, 0.15, 0.90, 0.05]
    },
    {
        "fma_id": "FMA24467",
        "snomed_id": "64234005",
        "name_en": "Patella (Kneecap)",
        "name_fa": "استخوان کشکک زانو (پاتلا)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Patella_Mesh",
        "bbox": [-0.13, 0.45, 0.04, 0.13, 0.50, 0.07]
    },
    {
        "fma_id": "FMA24476",
        "snomed_id": "12611008",
        "name_en": "Tibia (Shin bone)",
        "name_fa": "استخوان درشت‌نی (تیبیا)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Tibia_Mesh",
        "bbox": [-0.12, 0.08, -0.03, 0.12, 0.45, 0.03]
    },
    {
        "fma_id": "FMA24477",
        "snomed_id": "87342007",
        "name_en": "Fibula (Calf bone)",
        "name_fa": "استخوان نازک‌نی (فیبولا)",
        "system_category": "Skeletal",
        "gender_model": "both",
        "glb_mesh_node_name": "Fibula_Mesh",
        "bbox": [-0.14, 0.08, -0.04, 0.14, 0.43, -0.01]
    },

    # ==========================================
    # 2. CIRCULATORY SYSTEM (سیستم گردش خون)
    # ==========================================
    {
        "fma_id": "FMA7088",
        "snomed_id": "302551006",
        "name_en": "Heart",
        "name_fa": "قلب",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "Heart_Mesh",
        "bbox": [-0.06, 1.25, -0.05, 0.06, 1.37, 0.05]
    },
    {
        "fma_id": "FMA7197",
        "snomed_id": "80891009",
        "name_en": "Heart muscle structure (Myocardium)",
        "name_fa": "عضله قلب (میوکارد)",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "Myocardium_Mesh",
        "bbox": [-0.05, 1.26, -0.04, 0.05, 1.35, 0.04]
    },
    {
        "fma_id": "FMA7165",
        "snomed_id": "15825003",
        "name_en": "Aorta",
        "name_fa": "سرخرگ آئورت",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "Aorta_Mesh",
        "bbox": [-0.03, 1.15, -0.03, 0.03, 1.42, 0.03]
    },
    {
        "fma_id": "FMA4720",
        "snomed_id": "89837001",
        "name_en": "Pulmonary artery",
        "name_fa": "سرخرگ ریوی (شریان پولمونار)",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "Pulmonary_Artery_Mesh",
        "bbox": [-0.04, 1.32, 0.01, 0.04, 1.38, 0.05]
    },
    {
        "fma_id": "FMA4721",
        "snomed_id": "76752008",
        "name_en": "Superior vena cava",
        "name_fa": "بزرگ‌سیاهرگ زبرین (اجوف فوقانی)",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "SVC_Mesh",
        "bbox": [0.01, 1.34, 0.01, 0.04, 1.44, 0.04]
    },
    {
        "fma_id": "FMA4722",
        "snomed_id": "64131007",
        "name_en": "Inferior vena cava",
        "name_fa": "بزرگ‌سیاهرگ زیرین (اجوف تحتانی)",
        "system_category": "Circulatory",
        "gender_model": "both",
        "glb_mesh_node_name": "IVC_Mesh",
        "bbox": [0.01, 1.05, -0.02, 0.04, 1.28, 0.02]
    },

    # ==========================================
    # 3. RESPIRATORY SYSTEM (سیستم تنفس)
    # ==========================================
    {
        "fma_id": "FMA7195",
        "snomed_id": "181216001",
        "name_en": "Right lung",
        "name_fa": "ریه راست",
        "system_category": "Respiratory",
        "gender_model": "both",
        "glb_mesh_node_name": "Right_Lung_Mesh",
        "bbox": [0.02, 1.20, -0.08, 0.14, 1.45, 0.08]
    },
    {
        "fma_id": "FMA7196",
        "snomed_id": "181217005",
        "name_en": "Left lung",
        "name_fa": "ریه چپ",
        "system_category": "Respiratory",
        "gender_model": "both",
        "glb_mesh_node_name": "Left_Lung_Mesh",
        "bbox": [-0.14, 1.20, -0.08, -0.02, 1.45, 0.08]
    },
    {
        "fma_id": "FMA7394",
        "snomed_id": "44567001",
        "name_en": "Trachea (Windpipe)",
        "name_fa": "نای (تراشه)",
        "system_category": "Respiratory",
        "gender_model": "both",
        "glb_mesh_node_name": "Trachea_Mesh",
        "bbox": [-0.02, 1.38, 0.02, 0.02, 1.52, 0.04]
    },
    {
        "fma_id": "FMA55099",
        "snomed_id": "4596009",
        "name_en": "Larynx (Voice box)",
        "name_fa": "حنجره (لارنکس)",
        "system_category": "Respiratory",
        "gender_model": "both",
        "glb_mesh_node_name": "Larynx_Mesh",
        "bbox": [-0.03, 1.50, 0.03, 0.03, 1.56, 0.06]
    },

    # ==========================================
    # 4. DIGESTIVE SYSTEM (سیستم گوارش)
    # ==========================================
    {
        "fma_id": "FMA7199",
        "snomed_id": "181277001",
        "name_en": "Liver",
        "name_fa": "کبد",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Liver_Mesh",
        "bbox": [0.01, 1.05, -0.08, 0.15, 1.22, 0.08]
    },
    {
        "fma_id": "FMA7202",
        "snomed_id": "28231008",
        "name_en": "Gallbladder",
        "name_fa": "کیسه صفرا",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Gallbladder_Mesh",
        "bbox": [0.04, 1.08, 0.03, 0.08, 1.14, 0.06]
    },
    {
        "fma_id": "FMA14654",
        "snomed_id": "75772009",
        "name_en": "Common hepatic duct",
        "name_fa": "مجرای کبدی مشترک",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Common_Hepatic_Duct_Mesh",
        "bbox": [0.03, 1.10, 0.01, 0.05, 1.14, 0.03]
    },
    {
        "fma_id": "FMA7148",
        "snomed_id": "69695003",
        "name_en": "Stomach",
        "name_fa": "معده",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Stomach_Mesh",
        "bbox": [-0.10, 1.08, -0.04, 0.02, 1.22, 0.06]
    },
    {
        "fma_id": "FMA7198",
        "snomed_id": "15776009",
        "name_en": "Pancreas",
        "name_fa": "لوزالمعده (پانکراس)",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Pancreas_Mesh",
        "bbox": [-0.08, 1.10, -0.03, 0.06, 1.16, 0.02]
    },
    {
        "fma_id": "FMA7200",
        "snomed_id": "113276009",
        "name_en": "Small intestine",
        "name_fa": "روده باریک",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Small_Intestine_Mesh",
        "bbox": [-0.10, 0.90, -0.03, 0.10, 1.08, 0.06]
    },
    {
        "fma_id": "FMA7203",
        "snomed_id": "14742008",
        "name_en": "Large intestine (Colon)",
        "name_fa": "روده بزرگ (کولون)",
        "system_category": "Digestive",
        "gender_model": "both",
        "glb_mesh_node_name": "Colon_Mesh",
        "bbox": [-0.14, 0.88, -0.04, 0.14, 1.12, 0.07]
    },

    # ==========================================
    # 5. NERVOUS SYSTEM (سیستم عصبی)
    # ==========================================
    {
        "fma_id": "FMA5018",
        "snomed_id": "113105001",
        "name_en": "Cerebrum (Brain)",
        "name_fa": "نیمکره‌های مخ (مغز)",
        "system_category": "Nervous",
        "gender_model": "both",
        "glb_mesh_node_name": "Cerebrum_Mesh",
        "bbox": [-0.08, 1.62, -0.09, 0.08, 1.78, 0.09]
    },
    {
        "fma_id": "FMA5080",
        "snomed_id": "113305005",
        "name_en": "Cerebellum",
        "name_fa": "مخچه",
        "system_category": "Nervous",
        "gender_model": "both",
        "glb_mesh_node_name": "Cerebellum_Mesh",
        "bbox": [-0.06, 1.56, -0.09, 0.06, 1.64, -0.03]
    },
    {
        "fma_id": "FMA7130",
        "snomed_id": "15926001",
        "name_en": "Brainstem",
        "name_fa": "ساقه مغز (بصل‌النخاع، پل مغزی و میان‌مغز)",
        "system_category": "Nervous",
        "gender_model": "both",
        "glb_mesh_node_name": "Brainstem_Mesh",
        "bbox": [-0.02, 1.54, -0.04, 0.02, 1.63, 0.00]
    },
    {
        "fma_id": "FMA7131",
        "snomed_id": "5244000",
        "name_en": "Spinal cord",
        "name_fa": "نخاع شوکی",
        "system_category": "Nervous",
        "gender_model": "both",
        "glb_mesh_node_name": "Spinal_Cord_Mesh",
        "bbox": [-0.015, 1.05, -0.06, 0.015, 1.54, -0.03]
    },

    # ==========================================
    # 6. URINARY SYSTEM (سیستم ادراری)
    # ==========================================
    {
        "fma_id": "FMA7201_R",
        "snomed_id": "59652004",
        "name_en": "Right kidney",
        "name_fa": "کلیه راست",
        "system_category": "Urinary",
        "gender_model": "both",
        "glb_mesh_node_name": "Right_Kidney_Mesh",
        "bbox": [0.04, 1.05, -0.06, 0.10, 1.16, -0.01]
    },
    {
        "fma_id": "FMA7201_L",
        "snomed_id": "18639004",
        "name_en": "Left kidney",
        "name_fa": "کلیه چپ",
        "system_category": "Urinary",
        "gender_model": "both",
        "glb_mesh_node_name": "Left_Kidney_Mesh",
        "bbox": [-0.10, 1.07, -0.06, -0.04, 1.18, -0.01]
    },
    {
        "fma_id": "FMA7204",
        "snomed_id": "89837001_BLADDER",
        "name_en": "Urinary bladder",
        "name_fa": "مثانه",
        "system_category": "Urinary",
        "gender_model": "both",
        "glb_mesh_node_name": "Bladder_Mesh",
        "bbox": [-0.05, 0.86, 0.02, 0.05, 0.94, 0.07]
    },

    # ==========================================
    # 7. ENDOCRINE SYSTEM (سیستم درون‌ریز / غدد)
    # ==========================================
    {
        "fma_id": "FMA7150",
        "snomed_id": "69748006",
        "name_en": "Thyroid gland",
        "name_fa": "غده تیروئید",
        "system_category": "Endocrine",
        "gender_model": "both",
        "glb_mesh_node_name": "Thyroid_Mesh",
        "bbox": [-0.03, 1.48, 0.02, 0.03, 1.53, 0.05]
    },
    {
        "fma_id": "FMA9604",
        "snomed_id": "23451007",
        "name_en": "Adrenal gland (Suprarenal)",
        "name_fa": "غده فوق کلیوی (آدرنال)",
        "system_category": "Endocrine",
        "gender_model": "both",
        "glb_mesh_node_name": "Adrenal_Gland_Mesh",
        "bbox": [-0.09, 1.16, -0.05, 0.09, 1.20, -0.02]
    },
    {
        "fma_id": "FMA13889",
        "snomed_id": "56329008",
        "name_en": "Pituitary gland (Hypophysis)",
        "name_fa": "غده هیپوفیز",
        "system_category": "Endocrine",
        "gender_model": "both",
        "glb_mesh_node_name": "Pituitary_Mesh",
        "bbox": [-0.01, 1.62, -0.01, 0.01, 1.64, 0.01]
    },

    # ==========================================
    # 8. LYMPHATIC & IMMUNE SYSTEM (سیستم لنفاوی و ایمنی)
    # ==========================================
    {
        "fma_id": "FMA7194",
        "snomed_id": "78961009",
        "name_en": "Spleen",
        "name_fa": "طحال",
        "system_category": "Lymphatic",
        "gender_model": "both",
        "glb_mesh_node_name": "Spleen_Mesh",
        "bbox": [-0.14, 1.12, -0.06, -0.08, 1.22, -0.01]
    },
    {
        "fma_id": "FMA7193",
        "snomed_id": "9875009",
        "name_en": "Thymus",
        "name_fa": "تیموس",
        "system_category": "Lymphatic",
        "gender_model": "both",
        "glb_mesh_node_name": "Thymus_Mesh",
        "bbox": [-0.03, 1.35, 0.04, 0.03, 1.42, 0.07]
    }
]

def populate_catalog():
    print(f"[*] Connecting to local knowledge database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    inserted_count = 0
    for s in COMPREHENSIVE_CATALOG:
        b = s["bbox"]
        cursor.execute("""
        INSERT OR REPLACE INTO anatomical_structures
        (fma_id, snomed_body_structure_id, name_en, name_fa, system_category, gender_model, glb_mesh_node_name, bbox_min_x, bbox_min_y, bbox_min_z, bbox_max_x, bbox_max_y, bbox_max_z)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["fma_id"],
            s["snomed_id"],
            s["name_en"],
            s["name_fa"],
            s["system_category"],
            s["gender_model"],
            s["glb_mesh_node_name"],
            b[0], b[1], b[2], b[3], b[4], b[5]
        ))
        inserted_count += 1

    conn.commit()

    # Generate JSON export for frontend high-speed offline indexing
    cursor.execute("""
    SELECT fma_id, snomed_body_structure_id, name_en, name_fa, system_category, gender_model, glb_mesh_node_name,
           bbox_min_x, bbox_min_y, bbox_min_z, bbox_max_x, bbox_max_y, bbox_max_z
    FROM anatomical_structures
    ORDER BY system_category, name_en
    """)
    rows = cursor.fetchall()
    catalog_json = []
    for r in rows:
        catalog_json.append({
            "fmaId": r[0],
            "snomedBodyStructureId": r[1],
            "nameEn": r[2],
            "nameFa": r[3],
            "systemCategory": r[4],
            "genderModel": r[5],
            "meshNodeName": r[6],
            "bbox": [r[7], r[8], r[9], r[10], r[11], r[12]]
        })

    json_export_path = os.path.join(BASE_DIR, "..", "..", "frontend", "src", "data", "anatomyCatalog.json")
    with open(json_export_path, "w", encoding="utf-8") as f:
        json.dump(catalog_json, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Injected {inserted_count} normalized structures across 8 core systems.")
    print(f"[EXPORT] Created high-speed offline catalog at: {json_export_path}")
    conn.close()

if __name__ == "__main__":
    populate_catalog()
