-- ============================================================================
-- 3D Anatomy & Pathophysiology Simulation Platform
-- Database Schema: FMA v4.6 <-> SNOMED CT SEP Hierarchy & Pathology Mapping
-- Compatible with: SQLite 3.35+ and PostgreSQL 14+
-- ============================================================================

-- جدول قطعات سه‌بعدی و مفاهیم آناتومیک پایه (مرحله اول)
CREATE TABLE IF NOT EXISTS anatomical_structures (
    fma_id VARCHAR(32) PRIMARY KEY,              -- مثال: FMA13478 (ستون فقرات) یا FMA7163 (پوست)
    snomed_body_structure_id VARCHAR(32) NOT NULL, -- کد معادل در شاخه Body Structure در SNOMED CT
    name_en VARCHAR(255) NOT NULL,
    name_fa VARCHAR(255) NOT NULL,
    system_category VARCHAR(64) NOT NULL,        -- یکی از ۱۵ سیستم مرد یا ۱۸ سیستم زن
    gender_model VARCHAR(16) NOT NULL,           -- 'male', 'female', 'both'
    glb_mesh_node_name VARCHAR(128) NOT NULL,
    bbox_min_x FLOAT, bbox_min_y FLOAT, bbox_min_z FLOAT,
    bbox_max_x FLOAT, bbox_max_y FLOAT, bbox_max_z FLOAT
);

CREATE INDEX IF NOT EXISTS idx_anat_snomed ON anatomical_structures(snomed_body_structure_id);
CREATE INDEX IF NOT EXISTS idx_anat_system ON anatomical_structures(system_category, gender_model);
CREATE INDEX IF NOT EXISTS idx_anat_name_en ON anatomical_structures(name_en);
CREATE INDEX IF NOT EXISTS idx_anat_name_fa ON anatomical_structures(name_fa);

-- جدول سلسله‌مراتب ساختار-کل-جزء (SEP) برای پیمایش بازگشتی الگوریتم ANAT
CREATE TABLE IF NOT EXISTS anatomy_hierarchy_sep (
    parent_snomed_id VARCHAR(32) NOT NULL,
    child_snomed_id VARCHAR(32) NOT NULL,        -- شامل زیرگونه‌ها (is-a) و اجزای درونی (part-of)
    depth_level INT NOT NULL,
    PRIMARY KEY (parent_snomed_id, child_snomed_id)
);

CREATE INDEX IF NOT EXISTS idx_sep_parent ON anatomy_hierarchy_sep(parent_snomed_id);
CREATE INDEX IF NOT EXISTS idx_sep_child ON anatomy_hierarchy_sep(child_snomed_id);

-- جدول بیماری‌ها و پروفایل تاثیر پاتولوژیک روی بافت (مرحله دوم)
CREATE TABLE IF NOT EXISTS disorders_pathology (
    snomed_disorder_id VARCHAR(32) PRIMARY KEY,  -- مثال: 22298006 (سکته قلبی)
    icd10_code VARCHAR(16),
    icdo_topography_code VARCHAR(16),           -- فرمت C[site].[subsite] برای نئوپلاسم‌ها
    orphan_code VARCHAR(32),                    -- کد بیماری‌های نادر Inserm Orphanet
    fsn_en VARCHAR(512) NOT NULL,               -- Fully Specified Name
    preferred_term_fa VARCHAR(255) NOT NULL,
    clinical_department VARCHAR(64) NOT NULL,   -- کاردیولوژی، گوارش، ارتوپدی و غیره
    etiology_category VARCHAR(64),              -- ژنتیکی، محیطی، تروما، سبک زندگی
    finding_site_snomed_id VARCHAR(32) NOT NULL, -- اتصال به ساختار آناتومیک هدف
    associated_morphology_id VARCHAR(32),       -- مثال: 56246009 (التهاب)
    pathological_process_id VARCHAR(32),
    causative_agent_id VARCHAR(32),
    clinical_course VARCHAR(64),
    visual_preset_type VARCHAR(64) NOT NULL     -- 'pbr_inflammation', 'pbr_ischemia', 'morph_atrophy', 'procedural_mass', 'rig_fracture'
);

CREATE INDEX IF NOT EXISTS idx_disorder_site ON disorders_pathology(finding_site_snomed_id);
CREATE INDEX IF NOT EXISTS idx_disorder_dept ON disorders_pathology(clinical_department);
CREATE INDEX IF NOT EXISTS idx_disorder_icd10 ON disorders_pathology(icd10_code);
