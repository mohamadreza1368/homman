"""
Script: init_database.py
Purpose: Initializes local SQLite medical knowledge database, sets up tables,
         and loads seed mappings for foundational anatomical structures and pathologies.
"""

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "medical_knowledge.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Execute Schema DDL
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)
    print(f"[OK] Database schema initialized at: {DB_PATH}")

    # 2. Seed Core Anatomical Structures (Sample of key structures)
    seed_structures = [
        # fma_id, snomed_id, name_en, name_fa, system, gender, mesh_node, bbox min/max
        ("FMA7088", "302551006", "Heart", "قلب", "Circulatory", "both", "Heart_Mesh", -0.06, 1.25, -0.05, 0.06, 1.37, 0.05),
        ("FMA7197", "80891009", "Heart muscle structure", "میوکارد (عضله قلب)", "Circulatory", "both", "Myocardium_Mesh", -0.05, 1.26, -0.04, 0.05, 1.35, 0.04),
        ("FMA7163", "39937001", "Skin of body", "پوست کل بدن", "Integumentary", "both", "Skin_Mesh", -0.25, 0.0, -0.15, 0.25, 1.80, 0.15),
        ("FMA7195", "181216001", "Right lung", "ریه راست", "Respiratory", "both", "Right_Lung_Mesh", 0.02, 1.20, -0.08, 0.14, 1.45, 0.08),
        ("FMA7196", "181217005", "Left lung", "ریه چپ", "Respiratory", "both", "Left_Lung_Mesh", -0.14, 1.20, -0.08, -0.02, 1.45, 0.08),
        ("FMA7199", "181277001", "Liver", "کبد", "Digestive", "both", "Liver_Mesh", 0.01, 1.05, -0.08, 0.15, 1.22, 0.08),
        ("FMA7201", "64033007", "Kidney", "کلیه", "Urinary", "both", "Kidney_Mesh", -0.12, 1.05, -0.06, 0.12, 1.18, 0.06),
        ("FMA5018", "113105001", "Cerebral hemisphere", "نیمکره مخ", "Nervous", "both", "Cerebrum_Mesh", -0.08, 1.62, -0.09, 0.08, 1.78, 0.09),
        ("FMA13478", "122494005", "Cervical vertebral column", "ستون فقرات گردنی", "Skeletal", "both", "Spine_Cervical_Mesh", -0.03, 1.48, -0.04, 0.03, 1.60, 0.04),
        ("FMA9915", "71341001", "Femur", "استخوان ران (فمور)", "Skeletal", "both", "Femur_Mesh", 0.05, 0.45, -0.05, 0.15, 0.90, 0.05)
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO anatomical_structures 
    (fma_id, snomed_body_structure_id, name_en, name_fa, system_category, gender_model, glb_mesh_node_name, bbox_min_x, bbox_min_y, bbox_min_z, bbox_max_x, bbox_max_y, bbox_max_z)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, seed_structures)

    # 3. Seed SEP Hierarchy (Parent -> Child relationships)
    seed_sep = [
        # Heart (302551006) -> Myocardium (80891009)
        ("302551006", "80891009", 1),
        # Myocardium (80891009) -> Left ventricular myocardium (subpart)
        ("80891009", "53000008", 2)
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO anatomy_hierarchy_sep (parent_snomed_id, child_snomed_id, depth_level)
    VALUES (?, ?, ?)
    """, seed_sep)

    # 4. Seed High-Frequency Disorders with Morphologies & Visual Presets
    seed_disorders = [
        ("22298006", "I21.9", None, None, "Myocardial infarction (disorder)", "سکته قلبی (انفارکتوس میوکارد)", "کاردیولوژی", "تروما و عروقی", "80891009", "56246009", "26036001", None, "حمله‌ای / حاد", "pbr_ischemia"),
        ("427396001", "I21.1", None, None, "Acute myocardial infarction of inferior wall", "سکته قلبی حاد دیواره تحتانی", "کاردیولوژی", "عروقی", "80891009", "56246009", "26036001", None, "حاد", "pbr_ischemia"),
        ("56246009_LIVER", "K75.9", None, None, "Inflammatory liver disease (disorder)", "بیماری التهابی کبد (هپاتیت)", "گوارش", "عفونی / ایمنی", "181277001", "56246009", "23583003", None, "حاد و مزمن", "pbr_inflammation"),
        ("31261009", "S72.9", None, None, "Fracture of femur (disorder)", "شکستگی استخوان ران", "ارتوپدی", "تروما", "71341001", "35917007", "417746004", None, "تروما حاد", "rig_fracture"),
        ("126906006", "C50.9", "C50.9", None, "Neoplasm of breast (disorder)", "تومور پستان", "انکولوژی", "ژنتیکی / محیطی", "39937001", "108369006", "116676008", None, "مزمن پیش‌رونده", "procedural_mass")
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO disorders_pathology
    (snomed_disorder_id, icd10_code, icdo_topography_code, orphan_code, fsn_en, preferred_term_fa, clinical_department, etiology_category, finding_site_snomed_id, associated_morphology_id, pathological_process_id, causative_agent_id, clinical_course, visual_preset_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, seed_disorders)

    conn.commit()
    conn.close()
    print("[SUCCESS] Seeded core anatomical structures and pathology relationships.")

if __name__ == "__main__":
    init_db()
