"""
Script: query_anat.py
Purpose: Tests the recursive ANAT (Structure-Entire-Part) query engine against the local database,
         demonstrating automated traversal of tissue subparts (e.g. Heart -> Myocardium -> Myocardial Infarction).
"""

import os
import sqlite3
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "medical_knowledge.db")

def query_disorders_for_fma(fma_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    sql = """
    WITH RECURSIVE anatomical_descendants AS (
        -- Step 1: Base selected organ structure
        SELECT snomed_body_structure_id AS structure_id, name_en, name_fa, 0 AS depth
        FROM anatomical_structures
        WHERE fma_id = :fma_id
        
        UNION ALL
        
        -- Step 2: Recursive retrieval of all parts, layers, and sub-tissues (SEP)
        SELECT sep.child_snomed_id, s.name_en, s.name_fa, ad.depth + 1
        FROM anatomy_hierarchy_sep sep
        INNER JOIN anatomical_descendants ad ON sep.parent_snomed_id = ad.structure_id
        LEFT JOIN anatomical_structures s ON s.snomed_body_structure_id = sep.child_snomed_id
        WHERE ad.depth < 12
    )
    SELECT DISTINCT
        ad.name_en AS affected_structure_en,
        ad.name_fa AS affected_structure_fa,
        d.snomed_disorder_id,
        d.icd10_code,
        d.fsn_en,
        d.preferred_term_fa,
        d.clinical_department,
        d.etiology_category,
        d.visual_preset_type
    FROM disorders_pathology d
    INNER JOIN anatomical_descendants ad ON d.finding_site_snomed_id = ad.structure_id
    ORDER BY d.clinical_department ASC, d.preferred_term_fa ASC;
    """

    cursor.execute(sql, {"fma_id": fma_id})
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results

if __name__ == "__main__":
    import sys
    # Ensure UTF-8 output on Windows consoles
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
    target_fma = sys.argv[1] if len(sys.argv) > 1 else "FMA7088" # Default: Heart
    print(f"Executing recursive ANAT query for structure: {target_fma}")
    disorders = query_disorders_for_fma(target_fma)
    print(f"Found {len(disorders)} related disorders via SEP tree traversal:")
    for d in disorders:
        print(f" - [{d['clinical_department']}] {d['preferred_term_fa']} ({d['fsn_en']}) | ICD-10: {d['icd10_code']} | Preset: {d['visual_preset_type']}")
