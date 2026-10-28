"""
Script: build_snomed_omop_kb.py
Sprint: Phase 3 / Sprints 13 to 18 - SNOMED CT, OMOP, ICD-10, ICD-O & Orphanet Clinical Knowledge Graph
Purpose:
  1. Establishes the offline semantic bridge connecting all 48 anatomical structures (FMAIDs)
     to SNOMED CT Body Structures and deep recursive SEP (Structure-Entire-Part) subparts.
  2. Ingests high-frequency clinical disorders categorized across clinical departments:
     - Cardiology & Vascular (کاردیولوژی و عروق)
     - Neurology & Neurosurgery (نورولوژی و جراحی اعصاب)
     - Pulmonology & Infectious (ریه و بیماری‌های تنفسی)
     - Gastroenterology & Hepatology (گوارش، کبد و صفرا)
     - Orthopedics & Trauma (ارتوپدی و تروما)
     - Oncology & Neoplasms (انکولوژی و تومورها با کدهای ICD-O)
     - Nephrology & Urology (نفرولوژی و ارولوژی)
     - Endocrinology & Metabolism (غدد و متابولیسم)
     - Hematology & Immunology (خون و ایمونولوژی)
  3. Maps every disorder to:
     - |Finding site| (SNOMED Body Structure)
     - |Associated morphology| (56246009 Inflammation, 108369006 Neoplasm, 35917007 Fracture, etc.)
     - |Pathological process|
     - |Causative agent|
     - ICD-10 code
     - ICD-O Topography code (C[site].[subsite])
     - Inserm Orphanet rare disease code
     - Visual Preset Type ('pbr_inflammation', 'pbr_ischemia', 'morph_atrophy', 'procedural_mass', 'rig_fracture')
  4. Exports the compiled clinical knowledge graph for frontend sub-millisecond offline lookup.
"""

import os
import sqlite3
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "medical_knowledge.db")

# 1. Expanded SEP Hierarchies (Sub-tissue layers and parts for ANAT recursive traversal)
SEP_SUBPARTS = [
    # Heart (302551006) -> Myocardium, Endocardium, Pericardium, Coronary Artery
    ("302551006", "80891009", 1),  # Myocardium
    ("302551006", "38848004", 1),  # Endocardium
    ("302551006", "18128009", 1),  # Pericardium
    ("302551006", "41801008", 1),  # Coronary artery
    ("80891009", "53000008", 2),   # Left ventricular myocardium
    ("80891009", "39057004", 2),   # Cardiac conducting system

    # Cerebrum / Brain (113105001) -> Cerebral Cortex, White Matter, Meninges, Basal Ganglia
    ("113105001", "72410000", 1),  # Cerebral cortex
    ("113105001", "79654002", 1),  # Cerebral white matter
    ("113105001", "21114002", 1),  # Meninges
    ("113105001", "67923007", 1),  # Basal ganglia
    ("113105001", "40146001", 1),  # Middle cerebral artery

    # Liver (181277001) -> Hepatic lobule, Portal triad, Common Hepatic Duct
    ("181277001", "75772009", 1),  # Common hepatic duct
    ("181277001", "27418002", 2),  # Right hepatic duct
    ("181277001", "28273000", 2),  # Left hepatic duct
    ("181277001", "66951008", 1),  # Hepatic parenchyma / lobule
    ("181277001", "32764006", 1),  # Portal vein

    # Lungs (181216001 / 181217005) -> Bronchi, Alveoli, Pleura
    ("181216001", "955009", 1),    # Bronchial tree
    ("181216001", "31094006", 1),  # Pulmonary alveolus
    ("181216001", "3120008", 1),   # Pleura
    ("181217005", "955009", 1),    # Bronchial tree
    ("181217005", "31094006", 1),  # Pulmonary alveolus

    # Femur / Long bones (71341001) -> Periosteum, Compact bone, Bone marrow, Femoral head
    ("71341001", "44444009", 1),   # Periosteum
    ("71341001", "272673000", 1),  # Bone marrow of femur
    ("71341001", "6799000", 1),    # Head of femur
    ("71341001", "361078006", 1),  # Shaft of femur

    # Spine (122494005 / 122496007) -> Intervertebral disc, Spinal cord, Nerve roots
    ("122494005", "29624003", 1),  # Intervertebral disc
    ("122494005", "54735007", 1),  # Sacrum
    ("54735007", "64688005", 2),   # Coccyx
    ("122496007", "29624003", 1),  # Intervertebral disc lumbar
    ("122496007", "65989007", 1),  # Cauda equina

    # Kidney (59652004 / 18639004) -> Renal cortex, Renal medulla, Nephron, Glomerulus
    ("59652004", "31014005", 1),   # Renal cortex
    ("59652004", "65163004", 1),   # Renal medulla
    ("59652004", "19727002", 2),   # Renal glomerulus
    ("18639004", "31014005", 1),   # Renal cortex
    ("18639004", "19727002", 2),   # Renal glomerulus

    # Stomach (69695003) -> Gastric mucosa, Pylorus, Fundus
    ("69695003", "36214009", 1),   # Gastric mucosa
    ("69695003", "44641008", 1),   # Pylorus of stomach

    # Thyroid (69748006) -> Thyroid follicle, Thyroid capsule
    ("69748006", "385294005", 1)   # Follicular cell of thyroid
]

# 2. Comprehensive Clinical Disorders Portfolio (SNOMED CT, ICD-10, ICD-O, Orphanet, Presets)
COMPREHENSIVE_DISORDERS = [
    # -------------------------------------------------------------
    # CARDIOLOGY & VASCULAR (کاردیولوژی و عروق)
    # -------------------------------------------------------------
    {
        "snomed_id": "22298006",
        "icd10": "I21.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Myocardial infarction (disorder)",
        "term_fa": "سکته قلبی (انفارکتوس حاد میوکارد)",
        "dept": "کاردیولوژی",
        "etiology": "عروقی و ایسکمیک",
        "finding_site": "80891009", # Myocardium
        "morphology": "26036001",    # Necrosis
        "process": "417746004",
        "agent": "415582006",        # Coronary atheroma
        "course": "حاد شدید",
        "preset": "pbr_ischemia",
        "desc_fa": "نکروز ایسکمیک عضله قلب ناشی از انسداد ناگهانی شریان کرونری با قطع خون‌رسانی و اکسیژن."
    },
    {
        "snomed_id": "427396001",
        "icd10": "I21.1",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute myocardial infarction of inferior wall (disorder)",
        "term_fa": "سکته قلبی دیواره تحتانی بطن چپ",
        "dept": "کاردیولوژی",
        "etiology": "عروقی (انسداد شریان کرونری راست)",
        "finding_site": "53000008", # Left ventricular myocardium
        "morphology": "26036001",
        "process": "417746004",
        "agent": None,
        "course": "حاد تهدیدکننده حیات",
        "preset": "pbr_ischemia",
        "desc_fa": "ایسکمی و نکروز موضعی سطح دیافراگماتیک میوکارد بطن چپ، مستعد برادی‌کاردی و بلوک گره AV."
    },
    {
        "snomed_id": "371041009",
        "icd10": "I30.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute pericarditis (disorder)",
        "term_fa": "پریکاردیت حاد (التهاب پیراشامه قلب)",
        "dept": "کاردیولوژی",
        "etiology": "عفونی (ویروسی) یا خودایمنی",
        "finding_site": "18128009", # Pericardium
        "morphology": "56246009",   # Inflammation
        "process": "26036001",
        "agent": "415582006",
        "course": "حاد دردناک",
        "preset": "pbr_inflammation",
        "desc_fa": "التهاب ورقه‌های پریکارد قلب همراه با تولید افیوژن و درد قفسه سینه تشدیدشونده با دم عمیق."
    },
    {
        "snomed_id": "89138009",
        "icd10": "I42.0",
        "icdo": None,
        "orphan": "ORPHA:217604",
        "fsn_en": "Dilated cardiomyopathy (disorder)",
        "term_fa": "کاردیومیوپاتی اتساعی (گشادی حفرات قلب)",
        "dept": "کاردیولوژی",
        "etiology": "ژنتیکی، الکلی یا توکسیک",
        "finding_site": "302551006", # Heart
        "morphology": "44054006",    # Degenerative abnormality
        "process": "23583003",
        "agent": None,
        "course": "مزمن پیش‌رونده",
        "preset": "morph_atrophy",
        "desc_fa": "بزرگ شدن اتساعی بطن‌ها، نازک شدن دیواره میوکارد و نارسایی احتقانی پمپاژ قلبی."
    },
    {
        "snomed_id": "301011002",
        "icd10": "I33.0",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute infective endocarditis (disorder)",
        "term_fa": "اندوکاردیت عفونی حاد",
        "dept": "کاردیولوژی",
        "etiology": "عفونت باکتریایی (استافیلوکوک/استرپتوکوک)",
        "finding_site": "38848004", # Endocardium
        "morphology": "56246009",   # Inflammation / Vegetation
        "process": "417746004",
        "agent": "415582006",
        "course": "حاد سپتیک",
        "preset": "procedural_mass",
        "desc_fa": "تشکیل توده‌های وژتاسیون عفونی روی دریچه‌ها و سطح داخلی اندوکارد قلب با ریسک امبولی."
    },
    {
        "snomed_id": "67362008",
        "icd10": "I71.4",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Aortic aneurysm (disorder)",
        "term_fa": "آنوریسم آئورت شکمی و سینه‌ای",
        "dept": "کاردیولوژی و جراحی عروق",
        "etiology": "آترواسکلروز و دژنراسیون بافت الاستیک",
        "finding_site": "15825003", # Aorta
        "morphology": "44054006",
        "process": "23583003",
        "agent": None,
        "course": "مزمن با ریسک پارگی حاد",
        "preset": "morph_atrophy",
        "desc_fa": "اتساع موضعی دیواره شریان آئورت فراتر از ۵۰٪ قطر طبیعی با خطر خونریزی مرگبار."
    },

    # -------------------------------------------------------------
    # NEUROLOGY & NEUROSURGERY (نورولوژی و جراحی اعصاب)
    # -------------------------------------------------------------
    {
        "snomed_id": "230690007",
        "icd10": "I63.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Cerebral infarction (disorder)",
        "term_fa": "سکته مغزی ایسکمیک (انفارکتوس مغز)",
        "dept": "نورولوژی",
        "etiology": "انسداد ترومبوتیک یا امبولیک شریان مغزی",
        "finding_site": "40146001", # Middle cerebral artery / Cortex
        "morphology": "26036001",   # Liquefactive necrosis
        "process": "417746004",
        "agent": None,
        "course": "حاد ناگهانی",
        "preset": "pbr_ischemia",
        "desc_fa": "مرگ سلول‌های عصبی و نکروز مایع در کورتکس مغز ناشی از قطع جریان شریان مغزی میانی."
    },
    {
        "snomed_id": "19262005",
        "icd10": "G00.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Bacterial meningitis (disorder)",
        "term_fa": "مننژیت باکتریایی حاد",
        "dept": "نورولوژی و عفونی",
        "etiology": "عفونت مننگوکوک یا پنوموکوک",
        "finding_site": "21114002", # Meninges
        "morphology": "56246009",   # Inflammation
        "process": "417746004",
        "agent": "415582006",
        "course": "حاد اورژانسی",
        "preset": "pbr_inflammation",
        "desc_fa": "التهاب حاد پرده‌های محافظت‌کننده مغز (مننژ) همراه با ترشح اگزودای چرکی در فضای ساب‌آراکنوئید."
    },
    {
        "snomed_id": "26929004",
        "icd10": "C71.9",
        "icdo": "C71.9",
        "orphan": "ORPHA:360",
        "fsn_en": "Glioblastoma multiforme (disorder)",
        "term_fa": "گلیوبلاستوم مولتی‌فرم (تومور بدخیم مغز)",
        "dept": "انکولوژی و جراحی اعصاب",
        "etiology": "ژنتیکی و موتاسیون انکوژنیک آستروسیت‌ها",
        "finding_site": "79654002", # Cerebral white matter
        "morphology": "108369006",  # Malignant neoplasm primary
        "process": "116676008",
        "agent": None,
        "course": "فوق حاد پیش‌رونده",
        "preset": "procedural_mass",
        "desc_fa": "تهاجمی‌ترین تومور بدخیم بافت گلیال مغز با مرزهای نفوذی نامنظم، عروق‌زایی شدید و نکروز مرکزی."
    },
    {
        "snomed_id": "24700007",
        "icd10": "G20",
        "icdo": None,
        "orphan": "ORPHA:2828",
        "fsn_en": "Parkinson's disease (disorder)",
        "term_fa": "بیماری پارکینسون",
        "dept": "نورولوژی",
        "etiology": "تخریب دوپامینرژیک عقده‌های قاعده‌ای",
        "finding_site": "67923007", # Basal ganglia / Substantia nigra
        "morphology": "44054006",   # Degenerative abnormality
        "process": "23583003",
        "agent": None,
        "course": "مزمن پیش‌رونده",
        "preset": "morph_atrophy",
        "desc_fa": "دژنراسیون تدریجی نورون‌های تولیدکننده دوپامین در جسم سیاه همراه با تجمع اجسام لویی."
    },
    {
        "snomed_id": "202722002",
        "icd10": "M51.2",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Herniation of intervertebral disc (disorder)",
        "term_fa": "فتق دیسک بین‌مهره‌ای کمری",
        "dept": "جراحی اعصاب و ارتوپدی",
        "etiology": "پارگی آنولوس فیبروزوس ناشی از فشار مکانیکی",
        "finding_site": "29624003", # Intervertebral disc
        "morphology": "44054006",
        "process": "23583003",
        "agent": None,
        "course": "مزمن عودکننده",
        "preset": "morph_atrophy",
        "desc_fa": "بیرون‌زدگی هسته پالپوزوس دیسک بین‌مهره‌ای و فشار به ریشه‌های عصبی نخاع و دم اسب."
    },

    # -------------------------------------------------------------
    # GASTROENTEROLOGY & HEPATOLOGY (گوارش و کبد)
    # -------------------------------------------------------------
    {
        "snomed_id": "56246009_LIVER",
        "icd10": "K75.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Inflammatory liver disease (disorder)",
        "term_fa": "بیماری التهابی کبد (هپاتیت حاد)",
        "dept": "گوارش و کبد",
        "etiology": "عفونی (ویروس‌های هپاتیت) یا دارویی",
        "finding_site": "66951008", # Hepatic lobule
        "morphology": "56246009",   # Inflammation
        "process": "417746004",
        "agent": "415582006",
        "course": "حاد با ریسک مزمن شدن",
        "preset": "pbr_inflammation",
        "desc_fa": "پاسخ التهابی منتشر پارانشیم کبد همراه با ادم سلولی، پرخونی مویرگی و افزایش آنزیم‌های کبدی."
    },
    {
        "snomed_id": "197365007",
        "icd10": "K74.6",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Cirrhosis of liver (disorder)",
        "term_fa": "سیروز و فیبروز کبدی پیشرفته",
        "dept": "گوارش و کبد",
        "etiology": "الکلی، کبد چرب غیرالکلی (NASH) یا هپاتیت مزمن",
        "finding_site": "181277001", # Liver
        "morphology": "44054006",    # Degenerative / Fibrotic
        "process": "23583003",
        "agent": None,
        "course": "مزمن مرحله نهایی",
        "preset": "morph_atrophy",
        "desc_fa": "تخریب معماری طبیعی کبد، فیبروز پل‌زننده و تشکیل ندول‌های بازسازی‌کننده غیرطبیعی."
    },
    {
        "snomed_id": "109841003",
        "icd10": "C22.0",
        "icdo": "C22.0",
        "orphan": "ORPHA:88673",
        "fsn_en": "Hepatocellular carcinoma (disorder)",
        "term_fa": "کارسینوم هپاتوسلولار (سرطان کبد)",
        "dept": "انکولوژی و گوارش",
        "etiology": "سیروز زمینه‌ای و عفونت‌های مزمن ویروسی",
        "finding_site": "181277001", # Liver
        "morphology": "108369006",  # Malignant neoplasm
        "process": "116676008",
        "agent": None,
        "course": "مزمن تهاجمی",
        "preset": "procedural_mass",
        "desc_fa": "تومور بدخیم اولیه هپاتوسیت‌های کبد با عروق‌زایی شدید شریانی و تهاجم به وریدهای پورتال."
    },
    {
        "snomed_id": "203358004",
        "icd10": "K83.0",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Ascending cholangitis (disorder)",
        "term_fa": "کلانژیت صعودی حاد مجاری صفراوی",
        "dept": "گوارش و جراحی",
        "etiology": "انسداد مجرا با سنگ صفراوی و تکثیر باکتری‌ها",
        "finding_site": "75772009", # Common hepatic duct
        "morphology": "56246009",   # Purulent inflammation
        "process": "417746004",
        "agent": "415582006",
        "course": "فوق حاد شوک‌زا",
        "preset": "pbr_inflammation",
        "desc_fa": "عفونت باکتریایی خطرناک مجاری صفراوی داخل و خارج کبدی با علائم سه‌گانه تب، یرقان و درد شکم."
    },
    {
        "snomed_id": "235595009",
        "icd10": "K81.0",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute cholecystitis (disorder)",
        "term_fa": "کوله سیستیت حاد (التهاب کیسه صفرا)",
        "dept": "گوارش و جراحی",
        "etiology": "انسداد مجرای سیستیک توسط سنگ صفراوی",
        "finding_site": "28231008", # Gallbladder
        "morphology": "56246009",
        "process": "417746004",
        "agent": None,
        "course": "حاد التهابی",
        "preset": "pbr_inflammation",
        "desc_fa": "تورم شدید، اتساع و التهاب دیواره کیسه صفرا ناشی از گیر افتادن سنگ در خروجی صفرا."
    },
    {
        "snomed_id": "397825006",
        "icd10": "K25.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Gastric ulcer (disorder)",
        "term_fa": "زخم پپتیک معده",
        "dept": "گوارش",
        "etiology": "عفونت هلیکوباکتر پیلوری یا مصرف طولانی NSAID",
        "finding_site": "36214009", # Gastric mucosa
        "morphology": "56246009",   # Ulcerative erosion
        "process": "417746004",
        "agent": "415582006",
        "course": "مزمن همراه با خونریزی حاد",
        "preset": "pbr_inflammation",
        "desc_fa": "از بین رفتن سد مخاطی معده و تخریب لایه‌های زیرین توسط اسید و پپسین با ریسک سوراخ‌شدگی."
    },
    {
        "snomed_id": "75694006",
        "icd10": "K85.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute pancreatitis (disorder)",
        "term_fa": "پانکراتیت حاد (التهاب لوزالمعده)",
        "dept": "گوارش و مراقبت‌های ویژه",
        "etiology": "سنگ‌های صفراوی، الکل یا هیپرتری‌گلیسریدمی",
        "finding_site": "15776009", # Pancreas
        "morphology": "26036001",   # Autodigestion necrosis
        "process": "417746004",
        "agent": None,
        "course": "حاد بسیار شدید",
        "preset": "pbr_ischemia",
        "desc_fa": "فعال شدن نابه‌جای آنزیم‌های پانکراس و خودهضمی بافت، ادم حجیم و نکروز چربی موضعی."
    },

    # -------------------------------------------------------------
    # PULMONOLOGY & RESPIRATORY (ریه و سیستم تنفس)
    # -------------------------------------------------------------
    {
        "snomed_id": "233604007",
        "icd10": "J18.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Pneumonia (disorder)",
        "term_fa": "سینه‌پهلو (پنومونی ریه)",
        "dept": "ریه و عفونی",
        "etiology": "عفونت باکتریایی (استرپتوکوک پنومونیه) یا ویروسی",
        "finding_site": "31094006", # Pulmonary alveolus
        "morphology": "56246009",   # Exudative consolidation
        "process": "417746004",
        "agent": "415582006",
        "course": "حاد تب‌دار",
        "preset": "pbr_inflammation",
        "desc_fa": "پر شدن کیسه‌های هوایی ریه از مایع، گلبول‌های سفید و چرک با کاهش شدید ظرفیت اکسیژن‌گیری."
    },
    {
        "snomed_id": "363358000",
        "icd10": "C34.9",
        "icdo": "C34.9",
        "orphan": "ORPHA:252199",
        "fsn_en": "Malignant neoplasm of bronchus and lung",
        "term_fa": "سرطان بدخیم برونکوس و ریه",
        "dept": "انکولوژی و ریه",
        "etiology": "دخانیات، آزبست و جهش‌های انکوژنی EGFR/KRAS",
        "finding_site": "955009",    # Bronchial tree
        "morphology": "108369006",  # Malignant neoplasm
        "process": "116676008",
        "agent": None,
        "course": "مزمن پیش‌رونده",
        "preset": "procedural_mass",
        "desc_fa": "توده بدخیم منشا گرفته از مخاط راه‌های هوایی با توانایی انسداد برونش و متاستاز به مدیاستن."
    },
    {
        "snomed_id": "195967001",
        "icd10": "J44.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Chronic obstructive pulmonary disease",
        "term_fa": "بیماری انسدادی مزمن ریه (COPD)",
        "dept": "ریه",
        "etiology": "استنشاق طولانی‌مدت دود سیگار و ذرات آلاینده",
        "finding_site": "181216001", # Lung
        "morphology": "44054006",    # Emphysematous destruction
        "process": "23583003",
        "agent": None,
        "course": "مزمن غیرقابل بازگشت",
        "preset": "morph_atrophy",
        "desc_fa": "تخریب سپتوم‌های بین حبابچه‌ای (آمفیزم) و التهاب مزمن راه‌های هوایی کوچک با احتباس هوا."
    },

    # -------------------------------------------------------------
    # ORTHOPEDICS & TRAUMA (ارتوپدی و تروما)
    # -------------------------------------------------------------
    {
        "snomed_id": "31261009",
        "icd10": "S72.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Fracture of femur (disorder)",
        "term_fa": "شکستگی استخوان ران (فمور)",
        "dept": "ارتوپدی و تروما",
        "etiology": "ترومای مکانیکی سنگین یا پوکی استخوان",
        "finding_site": "361078006", # Shaft of femur
        "morphology": "35917007",    # Fracture
        "process": "417746004",
        "agent": None,
        "course": "حاد با ریسک خونریزی داخلی",
        "preset": "rig_fracture",
        "desc_fa": "گسستگی کامل قشر کورتیکال استخوان ران، جابه‌جایی زاویه‌دار قطعات و آسیب به شریان فمورال."
    },
    {
        "snomed_id": "93870000",
        "icd10": "S32.1",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Fracture of sacrum (disorder)",
        "term_fa": "شکستگی استخوان خاجی (ساکروم)",
        "dept": "ارتوپدی",
        "etiology": "سقوط از بلندی یا تصادفات جاده‌ای لگن",
        "finding_site": "54735007", # Sacrum
        "morphology": "35917007",
        "process": "417746004",
        "agent": None,
        "course": "حاد دردناک",
        "preset": "rig_fracture",
        "desc_fa": "شکستگی قوس خلفی کمربند لگنی همراه با ریسک خونریزی شبکه وریدی خلف صفاق و آسیب شبکه خاجی."
    },
    {
        "snomed_id": "263223001",
        "icd10": "S32.2",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Fracture of coccyx (disorder)",
        "term_fa": "شکستگی دنبالچه (کوکسیکس)",
        "dept": "ارتوپدی",
        "etiology": "ضربه مستقیم به ناحیه نشیمنگاه",
        "finding_site": "64688005", # Coccyx
        "morphology": "35917007",
        "process": "417746004",
        "agent": None,
        "course": "حاد دنبالچه‌درد (کوکسیدینی)",
        "preset": "rig_fracture",
        "desc_fa": "آسیب تروماتیک بندهای انتهای ستون مهره‌ها همراه با درد شدید هنگام نشستن و تحرک."
    },
    {
        "snomed_id": "399261000",
        "icd10": "M81.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Osteoporosis (disorder)",
        "term_fa": "پوکی استخوان (استئوپروز)",
        "dept": "ارتوپدی و غدد",
        "etiology": "کاهش استروژن پس از یائسگی یا افزایش سن",
        "finding_site": "71341001", # Femur / Trabecular bone
        "morphology": "44054006",
        "process": "23583003",
        "agent": None,
        "course": "مزمن خاموش",
        "preset": "morph_atrophy",
        "desc_fa": "کاهش تراکم مواد معدنی و نازک شدن ترابکول‌های اسفنجی با افزایش شکنندگی استخوان‌ها."
    },

    # -------------------------------------------------------------
    # NEPHROLOGY & UROLOGY (نفرولوژی و ارولوژی)
    # -------------------------------------------------------------
    {
        "snomed_id": "36171008",
        "icd10": "N00.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Acute glomerulonephritis (disorder)",
        "term_fa": "گلومرولونفریت حاد کلیه",
        "dept": "نفرولوژی",
        "etiology": "واکنش ایمنی پس از عفونت استرپتوکوکی",
        "finding_site": "19727002", # Glomerulus
        "morphology": "56246009",   # Immune-complex inflammation
        "process": "417746004",
        "agent": "415582006",
        "course": "حاد اورمی",
        "preset": "pbr_inflammation",
        "desc_fa": "رسوب کمپلکس‌های ایمنی در غشای پایه گلومرول با پیدایش هماچوری، پروتئینوری و افزایش فشار خون."
    },
    {
        "snomed_id": "41607009",
        "icd10": "C64",
        "icdo": "C64.9",
        "orphan": "ORPHA:217071",
        "fsn_en": "Renal cell carcinoma (disorder)",
        "term_fa": "سرطان سلول کلیوی (تومور بدخیم کلیه)",
        "dept": "انکولوژی و ارولوژی",
        "etiology": "جهش ژن VHL و استعمال دخانیات",
        "finding_site": "31014005", # Renal cortex
        "morphology": "108369006",  # Clear cell carcinoma
        "process": "116676008",
        "agent": None,
        "course": "مزمن تهاجمی",
        "preset": "procedural_mass",
        "desc_fa": "توده نئوپلاستیک با منشا لوله‌های پروگزیمال کورتکس کلیه با گرایش به تهاجم به ورید رنال و IVC."
    },

    # -------------------------------------------------------------
    # ENDOCRINOLOGY (غدد و درون‌ریز)
    # -------------------------------------------------------------
    {
        "snomed_id": "44054006",
        "icd10": "E11.9",
        "icdo": None,
        "orphan": None,
        "fsn_en": "Type 2 diabetes mellitus (disorder)",
        "term_fa": "دیابت قندی نوع ۲",
        "dept": "غدد و متابولیسم",
        "etiology": "مقاومت به انسولین و نقص ترشحی سلول‌های بتای پانکراس",
        "finding_site": "15776009", # Pancreas
        "morphology": "44054006",   # Amyloid degeneration
        "process": "23583003",
        "agent": None,
        "course": "مزمن مادام‌العمر",
        "preset": "morph_atrophy",
        "desc_fa": "رسوب آمیلوئید در جزایر لانگرهانس پانکراس، کاهش توده سلول‌های بتا و هیپرگلیسمی مزمن."
    },
    {
        "snomed_id": "363478007",
        "icd10": "C73",
        "icdo": "C73.9",
        "orphan": "ORPHA:100085",
        "fsn_en": "Malignant neoplasm of thyroid gland",
        "term_fa": "سرطان بدخیم تیروئید (پاپیلاری/فولیکولار)",
        "dept": "انکولوژی و غدد",
        "etiology": "پرتوگیری یونیزان قبلی و موتاسیون ژن BRAF",
        "finding_site": "69748006", # Thyroid
        "morphology": "108369006",
        "process": "116676008",
        "agent": None,
        "course": "مزمن گرهی",
        "preset": "procedural_mass",
        "desc_fa": "ندول بدخیم در بافت تیروئید با ساختارهای پاپیلاری و کلسیفیکاسیون پساموما بادی."
    }
]

def build_knowledge_base():
    print("=" * 75)
    print("Building Phase 3 Clinical Knowledge Graph (SNOMED CT, OMOP, ICD-10, ICD-O)")
    print("=" * 75)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Update/Inject SEP Hierarchies
    print("[*] Ingesting deep recursive SEP tissue subparts...")
    cursor.executemany("""
    INSERT OR REPLACE INTO anatomy_hierarchy_sep (parent_snomed_id, child_snomed_id, depth_level)
    VALUES (?, ?, ?)
    """, SEP_SUBPARTS)

    # 2. Ingest Comprehensive Clinical Disorders
    print("[*] Ingesting categorized clinical disorders into disorders_pathology table...")
    inserted_disorders = 0
    for d in COMPREHENSIVE_DISORDERS:
        cursor.execute("""
        INSERT OR REPLACE INTO disorders_pathology
        (snomed_disorder_id, icd10_code, icdo_topography_code, orphan_code, fsn_en, preferred_term_fa,
         clinical_department, etiology_category, finding_site_snomed_id, associated_morphology_id,
         pathological_process_id, causative_agent_id, clinical_course, visual_preset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            d["snomed_id"],
            d["icd10"],
            d["icdo"],
            d["orphan"],
            d["fsn_en"],
            d["term_fa"],
            d["dept"],
            d["etiology"],
            d["finding_site"],
            d["morphology"],
            d["process"],
            d["agent"],
            d["course"],
            d["preset"]
        ))
        inserted_disorders += 1

    conn.commit()
    print(f"[SUCCESS] Stored {inserted_disorders} enriched clinical disorders.")

    # 3. Compile high-speed offline JSON knowledge graph for frontend
    print("\n[*] Compiling full clinical knowledge graph for frontend...")
    cursor.execute("SELECT fma_id, name_en, name_fa, snomed_body_structure_id FROM anatomical_structures")
    structures = cursor.fetchall()

    knowledge_graph = {}
    total_relations = 0

    for fma_id, name_en, name_fa, snomed_root in structures:
        # Run recursive ANAT query for each structure
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
        for row in cursor.fetchall():
            disorders.append({
                "snomedDisorderId": row[0],
                "icd10Code": row[1],
                "icdoTopographyCode": row[2],
                "orphanCode": row[3],
                "fsnEn": row[4],
                "preferredTermFa": row[5],
                "clinicalDepartment": row[6],
                "etiologyCategory": row[7],
                "associatedMorphologyId": row[8],
                "clinicalCourse": row[9],
                "visualPresetType": row[10],
                "descriptionFa": f"{row[5]} ({row[4]}) با کد بین‌المللی {row[1] or 'نامشخص'} در دپارتمان {row[6]}."
            })
            total_relations += 1

        if disorders:
            knowledge_graph[fma_id] = {
                "fmaId": fma_id,
                "nameEn": name_en,
                "nameFa": name_fa,
                "snomedRootId": snomed_root,
                "disorders": disorders
            }

    frontend_export_path = os.path.join(BASE_DIR, "..", "..", "frontend", "src", "data", "pathologyKnowledgeGraph.json")
    with open(frontend_export_path, "w", encoding="utf-8") as f:
        json.dump(knowledge_graph, f, ensure_ascii=False, indent=2)

    conn.close()

    print(f"[EXPORT] Successfully exported {len(knowledge_graph)} indexed organs with {total_relations} active clinical relationships.")
    print(f"         Output file: {frontend_export_path}")
    print("=" * 75)

if __name__ == "__main__":
    import sys
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
    build_knowledge_base()
