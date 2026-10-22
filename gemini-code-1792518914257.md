# نقشه راه جامع فنی و بک‌لاگ مهندسی اسپرینت‌به‌اسپرینت (TECHNICAL_ROADMAP.md)

## ۱. مشخصات معماری سیستم (System Architecture Overview)

این سند، مرجع فنی و اجرایی تیم مهندسی برای ساخت پلتفرم سه‌بعدی آموزش آناتومی (مرحله اول) و شبیه‌ساز هوشمند بیماری‌ها و پاتوفیزیولوژی (مرحله دوم) در طول **۲۴ اسپرینت دوهفته‌ای (۱۲ ماه)** است.

```
+-----------------------------------------------------------------------------------+

| CLIENT LAYER (React + RTL shadcn/ui) |
| +-------------------------------------+  +------------------------------------+ |
| | Stage 1: 3D Anatomy Explorer | | Stage 2: Pathology & Clinical UI | |
| | - 360 Orbit & BVH Raycaster | | - Department & Etiology Filters | |
| | - 15/18 System Layers & Explode View| | - POMR Timeline & 5W1H Ring | |
| | - Bilingual Search (FA/EN/FMAID) | | - 11-System Homeostasis Flowcharts | |
| +-------------------------------------+  +------------------------------------+ |
+-----------------------------------------------------------------------------------+
|
                                         v
+-----------------------------------------------------------------------------------+

| 3D RENDERING & SIMULATION ENGINE (Three.js / WebXR) |
| +------------------------+ +-------------------------+ +----------------------+ |
| | Asset & Memory Manager | | Custom GLSL Shaders | | Deformation Pipeline | |
| | - GLTFLoader + Draco | | - 3-Axis Clipping Planes| | - 1st: Bone Skinning | |
| | - KTX2 / BasisU (GPU) | | - Opacity Blending | | - 2nd: Blend Shapes | |
| | - Frustum-Priority LOD | | - PBR Inflammation/MI | | - 52 ARKit / FACS AUs| |
| | - IndexedDB Preloading | | - Temp-Scaled Threshold | | - Procedural Masses | |
| +------------------------+ +-------------------------+ +----------------------+ |
+-----------------------------------------------------------------------------------+
|
                                         v
+-----------------------------------------------------------------------------------+

| OFFLINE MEDICAL KNOWLEDGE GRAPH & COLLABORATION LAYER |
| +-----------------------------------------------+  +--------------------------+ |
| | Local Relational/Graph DB (SQLite / Postgres) | | Real-Time Sync Engine | |
| | - FMA v4.6 <-> SNOMED CT Body Structure Map | | - Yjs CRDT WebSockets | |
| | - SEP Hierarchy & Recursive ANAT Query Engine | | - Sub-ms Viewport, Cursor| |
| | - Finding Site + Associated Morphology + ICD | | & Clipping Plane Sync | |
| +-----------------------------------------------+  +--------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## ۲. فهرست منابع، دیتاست‌ها و مستندات فنی مورد نیاز در اسپرینت‌ها

### ۲.۱. منابع مرحله اول (مدل‌های سه‌بعدی و هستی‌شناسی آناتومی)
* **پورتال اصلی BodyParts3D / Anatomography (مدل مرد):** http://lifesciencedb.jp/ag/bp3d/
* **دانلود مستقیم فایل‌های VTK / STL / OBJ دیتاست BodyParts3D:** http://lifesciencedb.jp/ag/bp3d/download/
* **مرورگر آنلاین BodyParts3D نسخه ۴.۳:** http://lifesciencedb.jp/bp3d/?lng=en
* **مخزن گیت‌هاب Human Atlas (کد مرجع React + Three.js + RTL + مدل مرد و زن):** https://github.com/slorksmo/Human-Atlas
* **دموی زنده Human Atlas:** https://atlas.taim.best
* **مخزن گیت‌هاب فایل‌های باینری STL و نگاشت FMAID:** https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
* **پروژه انسان مرئی (Visible Human Project - پایه مدل زن HuBMAP):** http://www.nlm.nih.gov/research/visible/visible_human.html
* **هستی‌شناسی مدل بنیادین آناتومی (FMA در OBO Foundry):** http://www.obofoundry.org/cgi-bin/detail.cgi?id=fma_lite
* **مقاله ممیزی خطاهای هستی‌شناسی FMA و BodyParts3D:** https://pmc.ncbi.nlm.nih.gov/articles/PMC6371295/
* **مقاله فرمول‌های توپولوژی فضایی BodyParts3D:** https://pmc.ncbi.nlm.nih.gov/articles/PMC2686534/

### ۲.۲. منابع مرحله دوم (گراف دانش بیماری‌ها و کدگذاری بالینی)
* **راهنمای رسمی مدل مفهومی و ویژگی‌های SNOMED CT:** https://docs.snomed.org/snomed-ct-practical-guides/snomed-ct-starter-guide/6-snomed-ct-concept-model
* **مستندات رسمی الگوی ساختار-کل-جزء (SEP) در SNOMED CT:** https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/anatomical-concept-model
* **مقاله مرجع الگوریتم پیمایش بازگشتی ANAT در برابر TAXO:** https://pmc.ncbi.nlm.nih.gov/articles/PMC1560776/
* **مستندات دسترسی برنامه‌نویسی به کدهای SNOMED با OMOPHub:** https://omophub.com/blog/snomed-codes
* **مرورگر SNOMED CT در NCBO BioPortal:** https://purl.bioontology.org/ontology/SNOMEDCT/38866009
* **مقاله روش‌شناسی بازاستفاده از هستی‌شناسی‌های پزشکی و محدودیت‌های API:** https://www.researchgate.net/publication/304020679_A_Methodology_for_Biomedical_Ontology_Reuse
* **راهنمای جامع سینتکس عبارات ترکیبی SNOMED CT و اتصال به ICD-10 و FHIR:** https://tiro.health/resources/snomed-ct-complete-guide-medical-documentation-belgium
* **مقاله سیستم پرونده پزشکی سه‌بعدی، مدل POMR و پرسشنامه استاندارد SUS:** https://pmc.ncbi.nlm.nih.gov/articles/PMC12524217/

### ۲.۳. منابع موتور گرافیکی، شیدرها، بهینه‌سازی و رگولاتوری
* **راهنمای فنی Blend Shapes، Morph Targets و استاندارد ARKit / FACS:** https://mocaponline.com/blogs/mocap-news/blend-shapes-morph-targets-guide
* **مستندات پیاده‌سازی ۵۲ Blendshape صورت در Three.js:** https://hiukim.github.io/mind-ar-js-doc/more-examples/threejs-face-blendshapes/
* **مبحث فنی حل مشکل ترتیب Skinning و Blend Shapes با Compute Shaders:** https://discussions.unity.com/t/blendshapes-morph-targets-on-whole-body-working-with-skeletal-animation/1603597
* **مقاله شیدرهای برش مقطعی، Opacity Blending و کالیبراسیون اطمینان MRI:** https://www.mdpi.com/2076-3417/16/14/7067
* **استانداردهای بودجه چندضلعی (Polygon Budget) و مقیاس مدل‌های پزشکی:** https://proofly.store/medical-3d-models
* **راهنمای بهینه‌سازی WebXR، KTX2/Basis Universal و Unity/Unreal:** https://proofly.store/vr-ar-3d-models
* **معماری پایپ‌لاین فشرده‌سازی دارایی‌ها و همگام‌سازی بلادرنگ Yjs CRDT:** https://aeionos.com/modules/spatial
* **راهنمای جامع رگولاتوری FDA و EU MDR برای اپلیکیشن‌های موبایل پزشکی:** https://meddeviceguide.com/blog/mobile-medical-applications-regulatory-guide

---

## ۳. برنامه فنی تفصیلی به تفکیک هر اسپرینت (Sprint 1 تا Sprint 24)

---

### فاز صفر: زیرساخت، خط لوله گرافیکی و معماری داده (ماه ۱)

#### اسپرینت ۱ (هفته ۱ و ۲): راه‌اندازی موتور رندرینگ سه‌بعدی و پایپ‌لاین فشرده‌سازی GPU
* **چالش فنی:** بارگذاری مدل‌های سه‌بعدی پزشکی روی مرورگر موبایل و هدست‌های واقعیت مجازی به دلیل حجم بالای هندسه و رمزگشایی تکسچرهای PNG/JPG در پردازنده مرکزی (CPU) باعث پر شدن سریع VRAM و کرش کردن صفحه می‌شود.
* **وظایف مهندسی:**
  - [ ] راه‌اندازی پروژه با پشته React، TypeScript، Tailwind CSS، کتابخانه رابط کاربری `shadcn/ui` و موتور Three.js (`@react-three/fiber`، `@react-three/drei`، `@react-three/xr`).
  - [ ] پیکربندی `DRACOLoader` مبتنی بر WebAssembly جهت رمزگشایی هندسه‌های فشرده در فرمت باینری `GLB`.
  - [ ] پیکربندی `KTX2Loader` به همراه ترنسکودر `Basis Universal` (پسوند استاندارد `KHR_texture_basisu`) تا تکسچرها به صورت بومی روی GPU باقی بمانند و حجم اشغال‌شده در حافظه گرافیکی ۶ تا ۸ برابر کاهش یابد.
  - [ ] تنظیم پارامترهای رندرینگ WebXR شامل فعال‌سازی `renderer.xr.enabled = true`، تنظیم `renderer.setPixelRatio(window.devicePixelRatio)` (برای پشتیبانی از مقیاس رندر ۱.۵ برابری در مرورگر Meta Quest) و استفاده از `XRControllerModelFactory` برای کنترلرهای استاندارد Khronos.
  - [ ] *مسیر موازی در صورت استفاده از Unity:* نصب پکیج `GLTFast` در Unity 2022+، فعال‌سازی `OpenXR` و `XR Interaction Toolkit`، تنظیم `Scale Factor = 1`، افزودن `Rigidbody` با برخورددهنده‌های محدب (Convex Hulls) و فعال‌سازی `GPU Instancing` و `Static Batching`.
* **نمونه کد پیاده‌سازی زیرساخت بارگذاری (`AssetLoader.ts`):**
```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export function createMedicalAssetLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/wasm/draco/');
  dracoLoader.setDecoderConfig({ type: 'wasm' });

  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('/wasm/basis/');
  ktx2Loader.detectSupport(renderer);

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);

  return gltfLoader;
}
```
* **معیار پذیرش فنی (DoD):** بارگذاری موفقیت‌آمیز یک فایل نمونه `.glb` فشرده‌شده با Draco و KTX2 روی مرورگر موبایل و دسکتاپ بدون خطای WebGL و تایید عدم رمزگشایی تکسچر روی CPU در پروفایلر مرورگر.

---

#### اسپرینت ۲ (هفته ۳ و ۴): طراحی اسکیمای پایگاه داده محلی و مستندسازی رگولاتوری
* **چالش فنی:** ۱) طراحی اسکیمای دیتابیس که بتواند هزاران قطعه سه‌بعدی را بدون تاخیر به ده‌ها هزار کد بیماری متصل کند؛ ۲) جلوگیری از قرار گرفتن اپلیکیشن در دسته تجهیزات پزشکی تحت نظارت (SaMD) در قوانین FDA و EU MDR و جلوگیری از رد شدن اپ در بررسی‌های Apple App Store.
* **وظایف مهندسی:**
  - [ ] تدوین سند فنی **Intended Use (کاربرد مورد نظر)** و ثبت منطق عدم شمول در تعریف دستگاه پزشکی (**Category 1: Not a Device**) طبق دستورالعمل FDA و EU MDR Rule 11 (معرفی صریح محصول به عنوان نسخه الکترونیکی اطلس و رفرنس آموزشی پزشکی).
  - [ ] ایجاد فیلترهای کنترلی روی متون رابط کاربری و توضیحات مارکتینگ جهت اطمینان از عدم ارائه توصیه تشخیصی یا درمانی مستقیم به بیمار (زیرا FDA معافیت سیستم‌های پشتیبانی تصمیم‌گیری بالینی یا CDS را به ابزارهای رو به بیمار اعمال نمی‌کند).
  - [ ] پیاده‌سازی الزامات Apple App Store در متادیتای پروژه (لینک سیاست حفظ حریم خصوصی، انتشار تحت نام موسسه آموزشی/درمانی معتبر و عدم فروش داده‌های HealthKit به تبلیغ‌کنندگان).
  - [ ] پیاده‌سازی اسکیمای پایگاه داده رابطه‌ای/گراف در SQLite / PostgreSQL به همراه ایندکس‌های ترکیبی برای جستجوی زیر یک میلی‌ثانیه:
```sql
CREATE TABLE anatomical_structures (
    fma_id VARCHAR(32) PRIMARY KEY,          -- مثال: FMA13478 (ستون فقرات) یا FMA7163 (پوست)
    snomed_body_structure_id VARCHAR(32) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_fa VARCHAR(255) NOT NULL,
    system_category VARCHAR(64) NOT NULL,    -- یکی از ۱۵ سیستم مرد یا ۱۸ سیستم زن
    gender_model VARCHAR(16) NOT NULL,       -- 'male', 'female', 'both'
    glb_mesh_node_name VARCHAR(128) NOT NULL,
    bbox_min_x FLOAT, bbox_min_y FLOAT, bbox_min_z FLOAT,
    bbox_max_x FLOAT, bbox_max_y FLOAT, bbox_max_z FLOAT
);

CREATE INDEX idx_anat_snomed ON anatomical_structures(snomed_body_structure_id);
CREATE INDEX idx_anat_system ON anatomical_structures(system_category, gender_model);

CREATE TABLE anatomy_hierarchy_sep (
    parent_snomed_id VARCHAR(32) NOT NULL,
    child_snomed_id VARCHAR(32) NOT NULL,    -- شامل زیرگونه‌ها (is-a) و اجزای درونی (part-of)
    depth_level INT NOT NULL,
    PRIMARY KEY (parent_snomed_id, child_snomed_id)
);

CREATE INDEX idx_sep_parent ON anatomy_hierarchy_sep(parent_snomed_id);

CREATE TABLE disorders_pathology (
    snomed_disorder_id VARCHAR(32) PRIMARY KEY, -- مثال: 22298006 (سکته قلبی)
    icd10_code VARCHAR(16),
    icdo_topography_code VARCHAR(16),           -- فرمت C[site].[subsite] برای نئوپلاسم‌ها
    orphan_code VARCHAR(32),                    -- کد بیماری‌های نادر Inserm Orphanet
    fsn_en VARCHAR(512) NOT NULL,               -- Fully Specified Name
    preferred_term_fa VARCHAR(255) NOT NULL,
    clinical_department VARCHAR(64) NOT NULL,   -- کاردیولوژی، گوارش، ارتوپدی و غیره
    etiology_category VARCHAR(64),              -- ژنتیکی، محیطی، تروما، سبک زندگی
    finding_site_snomed_id VARCHAR(32) NOT NULL,
    associated_morphology_id VARCHAR(32),       -- مثال: 56246009 (التهاب)
    pathological_process_id VARCHAR(32),
    causative_agent_id VARCHAR(32),
    clinical_course VARCHAR(64),
    visual_preset_type VARCHAR(64) NOT NULL     -- 'pbr_inflammation', 'pbr_ischemia', 'morph_atrophy', 'procedural_mass', 'rig_fracture'
);

CREATE INDEX idx_disorder_site ON disorders_pathology(finding_site_snomed_id);
CREATE INDEX idx_disorder_dept ON disorders_pathology(clinical_department);
```
* **معیار پذیرش فنی (DoD):** ایجاد کامل دیتابیس محلی، اجرای تست کوئری‌های ایندکس‌شده و تکمیل پرونده فنی رگولاتوری Non-Device Rationale.

---

### فاز اول: مهندسی دارایی‌های سه‌بعدی و پالایش هستی‌شناختی آناتومی (ماه‌های ۲ و ۳)

#### اسپرینت ۳ (هفته ۵ و ۶): تامین دیتاست‌های خام و پاکسازی هندسی مش‌های غیرمنیفولد (Mesh Curing)
* **چالش فنی:** مدل‌های خام استخراج‌شده از MRI در دیتاست `BodyParts3D` (مانند مش سطح پوست با کد `FMA7163`) حاوی ترکیبی پیچیده از سطوح داخلی و خارجی، حفره‌های باز و مثلث‌های غیرمنیفولد (Non-manifold triangles) هستند که در زمان اعمال شیدرهای برش مقطعی یا محاسبات تغییر شکل بافت دچار فروپاشی گرافیکی می‌شوند.
* **وظایف مهندسی:**
  - [ ] دانلود کامل دیتاست **BodyParts3D v4.0** برای مدل مرد (۲,۲۳۴ قطعه مجزا، ۳,۴۳۲ مفهوم نام‌گذاری شده در ۱۵ سیستم، مجموعاً ۲,۲۸۸,۲۶۸ مثلث).
  - [ ] دانلود دیتاست **Human Reference Atlas v1.10 (HuBMAP)** مبتنی بر پروژه انسان مرئی کتابخانه ملی پزشکی آمریکا به همراه دیتاست عضلات اندام تحتانی زن دانشگاه دنور (Andreassen et al. 2023) برای مدل زن (۱,۲۲۰ قطعه، ۱,۴۳۹ مفهوم در ۱۸ سیستم، مجموعاً ۲,۷۶۵,۴۹۲ مثلث).
  - [ ] نوشتن اسکریپت پایتون در محیط Blender (`bpy`) برای پاکسازی خودکار هندسه (Mesh Curing): جداسازی پوسته خارجی از سطوح داخلی در `FMA7163`، حذف رئوس تکراری (`Merge by Distance`)، بستن حفره‌های مرزی جهت ایجاد هندسه کاملاً آب‌بند (**Watertight / Manifold**) و یکسان‌سازی جهت بردارهای نرمال به سمت بیرون.
* **نمونه اسکریپت Blender Python برای پاکسازی خودکار مش‌ها (`cure_meshes.py`):**
```python
import bpy
import bmesh

def cure_anatomical_mesh(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    
    bm = bmesh.from_edit_mesh(obj.data)
    # ۱. حذف رئوس تکراری و جوش دادن لبه‌های باز نزدیک به هم
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    
    # ۲. شناسایی و حذف هندسه غیرمنیفولد و لبه‌های معلق
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=True, use_boundary=False)
    bpy.ops.mesh.delete(type='VERT')
    
    # ۳. پر کردن حفره‌های مرزی برای ایجاد مش آب‌بند (Watertight)
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=False, use_boundary=True)
    bpy.ops.mesh.edge_face_add()
    
    # ۴. بازمحاسبه جهت نرمال‌ها به سمت بیرون و مثلث‌بندی استاندارد
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')
```
* **معیار پذیرش فنی (DoD):** تایید وضعیت `Watertight / Manifold = True` برای تمامی ۲,۲۳۴ قطعه مرد و ۱,۲۲۰ قطعه زن بدون وجود لبه‌های باز یا وجوه متقاطع.

---

#### اسپرینت ۴ (هفته ۷ و ۸): ممیزی هستی‌شناسی FMA و اصلاح خطاهای قطعه‌بندی آناتومیک
* **چالش فنی:** بررسی‌های علمی نشان داده‌اند که در دیتاست خام `BodyParts3D` (که با نسخه ۳.۰ هستی‌شناسی FMA برچسب خورده) و برخی اطلس‌های تجاری، خطاهای نام‌گذاری و قطعه‌بندی وجود دارد که اعتبار علمی نرم‌افزار را زیر سوال می‌برد.
* **وظایف مهندسی:**
  - [ ] تطبیق جدول شناسه‌های `FMAID` مدل‌های سه‌بعدی با نسخه ۴.۶ هستی‌شناسی **Foundational Model of Anatomy (FMA)** (شامل بیش از ۱۰۰,۰۰۰ کلاس آناتومیک و روابط جزء به کل منطقه‌ای `Regional parts` و ساختاری `Constitutional parts`).
  - [ ] **اصلاح خطای کمربند لگنی راست (`Right pelvic girdle`):** جداسازی مش استخوان خاجی (`Sacrum`) و دنبالچه (`Coccyx`) که در دیتاست BodyParts3D به اشتباه با یکدیگر ترکیب شده و صرفاً با کلاس `Sacrum` برچسب خورده‌اند.
  - [ ] **اصلاح خطای درخت صفراوی (`Biliary tree`):** اصلاح مرزهای قطعه‌بندی «مجرای کبدی مشترک» (`Common hepatic duct`) و جایگزینی برچسب سطح بالای `Segment of biliary tree` با شناسه‌های دقیق مجاری صفراوی چپ و راست.
  - [ ] **کنترل یکتایی سلسله‌مراتب نام‌گذاری:** رفع خطای اطلاق یک نام واحد به کل عضو و زیربخش آن به صورت هم‌زمان (مشابه خطای برچسب‌گذاری `Gall bladder` در Visible Body).
* **معیار پذیرش فنی (DoD):** امضای تاییدیه جدول نهایی نگاشت `Mesh_Node_Name <-> FMAID` توسط متخصص آناتومی تیم بدون هیچ‌گونه تداخل یا ابهام معنایی.

---

#### اسپرینت ۵ (هفته ۹ و ۱۰): هم‌ترازی فضایی کمترین مربعات، کالیبراسیون مقیاس و ایندکس توپولوژیک
* **چالش فنی:** عدم تطابق فضایی میان مدل مرد (BodyParts3D) و مدل زن (HuBMAP + Denver Lower Limb) در هنگام سوییچ کاربر، و ضرورت تعریف یک دستگاه مختصات استاندارد برای جانمایی دقیق تومورها در مرحله دوم.
* **وظایف مهندسی:**
  - [ ] کالیبراسیون مقیاس واقعی آناتومیک (Real-World Metric Scale): تنظیم ابعاد کل بدن در واحد متر به گونه‌ای که ارتفاع قلب انسان دقیقاً حدود ۱۲ سانتی‌متر و عرض آن ۸ سانتی‌متر، و طول قدامی-خلفی جمجمه حدود ۲۲ سانتی‌متر باشد.
  - [ ] پیاده‌سازی الگوریتم **برازش کمترین مربعات (Least-Squares Spatial Registration)** بر روی نقاط مرجع اسکلتی مشترک در هر دو مدل (ستون فقرات، جناغ سینه، لگن، فمور، تیبیا، فیبولا، کشکک و مغز) تا هر ناحیه کالبدی دقیقاً به ساختارهایی که به آن‌ها متصل است یا آن‌ها را دربر می‌گیرد چفت شود.
  - [ ] محاسبه و ذخیره ماتریس روابط توپولوژیک فضایی بر اساس تعریف ریاضی BodyParts3D (تعیین شمول `A has part B`، قرارگیری در درون `A part of B` و مجاورت مرزی `A attaches to / continuous with B` از طریق بررسی اشتراک نقاط درونی و مرزی مش‌ها) جهت ایندکس کردن مکان ضایعات و بیوپسی‌ها.
* **معیار پذیرش فنی (DoD):** تغییر آنی بین مدل مرد و زن در صحنه سه‌بعدی بدون جابه‌جایی مرکز دوربین یا پرش فضایی ساختارهای اسکلتی مرجع.

---

#### اسپرینت ۶ (هفته ۱۱ و ۱۲): تولید سطوح جزئیات (LOD)، اعمال بودجه چندضلعی و کامپایل نهایی GLB
* **چالش فنی:** مجموع مثلث‌های مدل خام مرد (۲.۲۸ میلیون) و زن (۲.۷۶ میلیون) فراتر از توان رندرینگ بلادرنگ پردازنده‌های گرافیکی موبایل است و باید بدون از دست رفتن جزئیات بالینی، به بودجه‌های استاندارد هر پلتفرم شکسته شود.
* **وظایف مهندسی:**
  - [ ] تولید خودکار زنجیره سطوح جزئیات پیش‌رونده (**Progressive Mesh LODs**): ساخت `LOD0` (جزئیات کامل برای نمای نزدیک) و `LOD1` (کاهش ۵۰ درصدی تعداد مثلث‌ها برای نمای کلی).
  - [ ] اعمال محدودیت‌های سخت‌گیرانه بودجه چندضلعی (Polygon Budget) و تکسچر:
    * **هر عضو در ابزار تحت وب (Three.js):** ۲,۰۰۰ تا ۱۵,۰۰۰ مثلث، تکسچر ۲۰۴۸ پیکسل با فشرده‌سازی KTX2 و جداسازی هندسه مقطع عرضی در یک لایه مش مستقل.
    * **هر عضو در حالت واقعیت افزوده موبایل (Mobile AR):** ۱,۰۰۰ تا ۵,۰۰۰ مثلث با تکسچر ۱۰۲۴ تا ۲۰۴۸ پیکسل.
    * **کل صحنه فعال روی پردازنده گرافیکی موبایل (WebGL 2 / WebGPU):** مجموعاً ۳۰,۰۰۰ تا ۸۰,۰۰۰ مثلث در صحنه، تکسچرهای ۵۱۲x۵۱۲ تا ۱۰۲۴x۱۰۲۴ پیکسل (KTX2/Basis) و حداکثر فراخوانی رسم (`Draw Calls`) کمتر یا مساوی ۳۰.
    * **نسخه شبیه‌ساز دسکتاپ (Unity / Unreal):** ۱۰,۰۰۰ تا ۵۰,۰۰۰ مثلث به ازای هر عضو با تکسچر ۲۰۴۸ تا ۴۰۹۶ پیکسل (در صورت استفاده از Unreal Engine 5 روی هدست موبایل، غیرفعال کردن Nanite و Mobile HDR).
  - [ ] خروجی گرفتن پکیج نهایی فشرده `.glb` با حجم دانلودی حدود **۳۴ مگابایت برای کل بدن مرد** و **۳۷ مگابایت برای کل بدن زن**.
* **معیار پذیرش فنی (DoD):** تایید حجم کل دارایی‌ها زیر ۷۱ مگابایت و ثبت نرخ فریم پایدار بالای ۳۰ فریم بر ثانیه در تست استرس روی گوشی میان‌رده.

---

### فاز دوم: توسعه موتور مرحله اول — کاوشگر تشریح سه‌بعدی و بومی‌سازی RTL (ماه‌های ۴ تا ۶)

#### اسپرینت ۷ (هفته ۱۳ و ۱۴): سیستم دوربین ۳۶۰ درجه، انتخابگر پرتوافکنی (BVH Raycaster) و مدیریت لایه‌ها
* **چالش فنی:** انتخاب دقیق یک عصب یا رگ ظریف از میان صدها مش هم‌پوشان با کلیک ماوس یا لمس صفحه موبایل، در پرتوافکنی معمولی Three.js کند و مستعد خطاست.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی دوربین ۳۶۰ درجه با قابلیت چرخش، زوم و فوکوس خودکار روی جعبه محاطی (`BoundingBox`) قطعه انتخاب‌شده.
  - [ ] یکپارچه‌سازی کتابخانه `three-mesh-bvh` برای تسریع درخت سلسله‌مراتب حجم‌های محاطی (BVH) در `Raycaster` جهت تشخیص برخورد پرتو با ۲,۲۳۴ مش در زمان زیر ۱ میلی‌ثانیه.
  - [ ] پیاده‌سازی سیستم مدیریت لایه‌ها (Systems as Layers): امکان روشن/خاموش کردن مستقل هر یک از ۱۵ سیستم بدن مرد و ۱۸ سیستم بدن زن، به همراه دکمه‌های پیش‌فرض سریع برای «سیستم اسکلتی» و «ارگان‌های داخلی».
* **معیار پذیرش فنی (DoD):** پاسخ‌گویی آنی به کلیک/لمس روی هر قطعه آناتومیک، ایزوله شدن عضو انتخاب‌شده و نمایش کد `FMAID` آن در کنسول.

---

#### اسپرینت ۸ (هفته ۱۵ و ۱۶): سینماتیک نمای انفجاری (Explode View) و ابزارهای تشریح مجازی
* **چالش فنی:** درک مسیر ساختارهای پیچیده (مانند عبور کلاف‌های شبکه عصبی بازویی یا Brachial Plexus از میان ترقوه و دنده اول) نیازمند باز کردن فضای بین قطعات بدون به هم ریختن نظم کالبدی آن‌هاست.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی الگوریتم ریاضی **نمای انفجاری (Explode View)**: محاسبه بردار جابه‌جایی هر قطعه نسبت به مرکز هندسی ناحیه آناتومیک و درون‌یابی نرم موقعیت قطعات بر اساس اسلایدر کاربر:
```typescript
export function applyExplodeView(
  meshes: THREE.Mesh[],
  regionCenter: THREE.Vector3,
  explodeFactor: number // بازه 0.0 (آناتومی مونتاژشده) تا 1.0 (نمای بازشده)
) {
  meshes.forEach((mesh) => {
    const originalPos = mesh.userData.originalPosition as THREE.Vector3;
    const meshCentroid = mesh.userData.centroid as THREE.Vector3;
    
    // محاسبه بردار جهت از مرکز ناحیه به سمت مرکز جرم هر قطعه
    const direction = new THREE.Vector3().subVectors(meshCentroid, regionCenter).normalize();
    const distance = meshCentroid.distanceTo(regionCenter);
    
    // انتقال نرم قطعه در امتداد بردار شعاعی
    mesh.position.copy(originalPos).addScaledVector(direction, distance * explodeFactor * 1.5);
  });
}
```
  - [ ] پیاده‌سازی ابزارهای تشریح مجازی (Virtual Dissection): قابلیت «لایه‌برداری تدریجی عضلات» (Peel Back) و «ردیابی مسیر عصب/رگ از مبدا تا انتها» (Origin-to-Endpoint Tracing).
* **معیار پذیرش فنی (DoD):** عملکرد روان اسلایدر Explode View روی کل بدن و زیرسیستم‌ها با انیمیشن ۶۰ فریم بر ثانیه و بازگشت دقیق قطعات به موقعیت اولیه در مقدار صفر.

---

#### اسپرینت ۹ (هفته ۱۷ و ۱۸): شیدرهای اختصاصی برش مقطعی سه‌محوره و ترکیب شفافیت
* **چالش فنی:** مشاهده حفرات درونی اعضا در حین حفظ دید فضایی نسبت به بافت‌های اطراف نیازمند شیدرهایی است که هم‌زمان شفافیت لایه‌ای و برش بلادرنگ را بدون افت کارایی مدیریت کنند.
* **وظایف مهندسی:**
  - [ ] نوشتن شیدرهای اختصاصی GLSL (Vertex & Fragment Shaders) با پشتیبانی هم‌زمان از **Opacity Blending** (نیمه‌شفاف‌سازی بافت‌های پوشاننده) و **Clipping Planes** (صفحات برش پویا در سه محور استاندارد ساجیتال، کرونال و آگزیال).
  - [ ] پیاده‌سازی رندرینگ سطح مقطع توپر (Cross-section Capping) با استفاده از لایه مش مقطع عرضی و بافر استنسیل (Stencil Buffer) تا محل برش خورده اعضا توخالی دیده نشود.
* **معیار پذیرش فنی (DoD):** حرکت دادن اسلایدرهای برش ساجیتال، کرونال و آگزیال روی هر عضو با نمایش دقیق ساختار داخلی و بدون افت نرخ فریم.

---

#### اسپرینت ۱۰ (هفته ۱۹ و ۲۰): ماژول‌های تخصصی نوروآناتومی (۴۵ مقطع مغز) و قلب تپنده
* **چالش فنی:** مغز و قلب نیازمند جزئیات عملکردی و مقاطع اختصاصی فراتر از مش‌های ایستا هستند.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی ماژول پیشرفته نوروآناتومی: تعبیه ۴۵ مقطع عرضی دقیق مغز در سه صفحه آناتومیک به همراه یک لایه نقشه‌برداری رنگی (Painted Mapping Layer) برای ناوبری و شناسایی شکنج‌های قشر مغز (Cerebral Gyri) و ساختارهای عمقی و سطحی.
  - [ ] پیاده‌سازی مدل سه‌بعدی **قلب تپنده قابل تشریح (Dissectible Beating Heart)** با انیمیشن چرخه سیستول و دیاستول، حرکت دریچه‌ها (مانند دریچه میترال) و قابلیت برش در حین تپش.
* **معیار پذیرش فنی (DoD):** تطابق کامل ۴۵ مقطع مغزی با تصاویر رادیولوژی مرجع و اجرای پیوسته انیمیشن ضربان قلب در حالت برش‌خورده.

---

#### اسپرینت ۱۱ (هفته ۲۱ و ۲۲): استریمینگ مبتنی بر میدان دید، پیش‌بارگذاری محلی و مدیریت حافظه
* **چالش فنی:** غلبه بر ماهیت پرمصرف مدل‌های سه‌بعدی در حافظه (Memory-Intensive Nature) و رسیدن به زمان بارگذاری استاندارد صنعتی روی موبایل و وب.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی بارگذاری پیش‌رونده مبتنی بر میدان دید دوربین (**Frustum-Priority Loading**): بارگذاری اولیه صحنه با مدل‌های کم‌تراکم در **کمتر از ۸ ثانیه** و ارتقای تدریجی به `LOD0` تنها برای قطعاتی که در کادر دید کاربر قرار دارند و زوم شده‌اند.
  - [ ] پیاده‌سازی سیستم **پیش‌بارگذاری محلی (Local Preloading)** با استفاده از IndexedDB و Service Workers جهت ذخیره کش دارایی‌های سه‌بعدی روی دستگاه کاربر؛ به طوری که میانگین زمان پردازش و بارگذاری نواحی مختلف در حالت آنلاین زیر ۱۵ ثانیه (شامل ۱۵ ثانیه اندام فوقانی و قفسه سینه، ۱۰ ثانیه اندام تحتانی، ۱۲ ثانیه سر و گردن و ۱۷ ثانیه مقطع ساجیتال مغز) و در مراجعات بعدی و حالت آفلاین نزدیک به صفر باشد.
  - [ ] پیاده‌سازی سیستم Garbage Collection صریح برای آزادسازی حافظه WebGL (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`) هنگام تغییر نما.
* **معیار پذیرش فنی (DoD):** اجرای کامل مرحله اول اپلیکیشن در حالت کاملاً آفلاین (Airplane Mode) پس از اولین بارگذاری و ثبت زمان لود اولیه زیر ۸ ثانیه روی موبایل.

---

#### اسپرینت ۱۲ (هفته ۲۳ و ۲۴): پایپ‌لاین دوزبانه Wikidata و رابط کاربری راست‌به‌چپ (RTL)
* **چالش فنی:** پلتفرم‌های جهانی مانند Complete Anatomy و BioDigital تنها از ۵ تا ۸ زبان غربی و شرق آسیا پشتیبانی می‌کنند و فاقد پشتیبانی از زبان فارسی و چیدمان راست‌به‌چپ هستند.
* **وظایف مهندسی:**
  - [ ] نوشتن اسکریپت استخراج خودکار واژگان از **Wikidata (تحت مجوز عمومی CC0)** بر اساس کدهای `FMAID` جهت دریافت نام‌های استاندارد و مترادف‌ها، و تکمیل جدول معادل‌های فارسی و انگلیسی/لاتین برای تمام ۳,۴۳۲ مفهوم مرد و ۱,۴۳۹ مفهوم زن.
  - [ ] طراحی کامل رابط کاربری راست‌به‌چپ (RTL Mirroring) در `shadcn/ui` شامل پنل‌های کنترل فشرده و پنل جزئیات عضو که در هر دو حالت عمودی (Portrait) و افقی (Landscape) موبایل بهینه‌سازی شده باشند.
  - [ ] پیاده‌سازی موتور جستجوی آنی دوطرفه (جستجو بر اساس نام فارسی، نام انگلیسی، اصطلاح لاتین یا کد شناسه `FMAID`).
* **معیار پذیرش فنی (DoD):** پایان فاز دوم و تحویل نسخه کامل و مستقل «مرحله اول اپلیکیشن» (اطلس کامل آناتومی دوزبانه مرد و زن).

---

### فاز سوم: مهندسی پل معنایی بیماری‌ها — اتصال مرحله اول به دوم (ماه‌های ۷ تا ۹)

#### اسپرینت ۱۳ (هفته ۲۵ و ۲۶): ساخت پایپ‌لاین ETL آفلاین بر پایه SNOMED CT و مدل داده OMOP
* **چالش فنی:** بارگذاری مستقیم فایل‌های OWL هستی‌شناسی‌های عظیمی مانند `SNOMED CT`، `FMA` و `NCIT` در حافظه برنامه یا فراخوانی زنده وب‌سرویس `NCBO BioPortal API` در زمان اجرا غیرممکن است؛ زیرا اولاً باعث مصرف شدید رم و کندی پردازش می‌شود، ثانیاً BioPortal ویژگی‌های والدین (`parents`) و نیاکان (`ancestors`) را به صورت لینک‌های مجزا برمی‌گرداند که نیازمند صدها درخواست HTTP متوالی است، و ثالثاً جستجوی متنی واژگانی مانند `calculus` به دلیل چندمعنایی، مفاهیم نامرتبطی بین «شاخه‌ای از ریاضیات» و «رسوب و سنگ کلیه/صفرا» بازیابی می‌کند.
* **وظایف مهندسی:**
  - [ ] طراحی و اجرای پایپ‌لاین استخراج، تبدیل و بارگذاری (ETL) آفلاین در Python بر پایه ساختار استاندارد **OMOP Common Data Model** و استفاده از ابزار **OMOPHub Concept Lookup**.
  - [ ] پارس کردن جداول انتشار استاندارد `SNOMED CT` (شامل بیش از ۳۵۰,۰۰۰ مفهوم فعال، بیش از ۱,۰۰۰,۰۰۰ توصیف متنی و مترادف شامل `FSN` و `Preferred Term`، و حدود ۹۰۳,۰۰۰ رابطه معنایی در ۱۹ سلسله‌مراتب سطح بالا).
  - [ ] ایجاد جدول نگاشت قطعی میان شناسه‌های `FMAID` قطعات سه‌بعدی و مفاهیم شاخه `|Anatomical or acquired body structure|` در سلسله‌مراتب `|Body structure|` پایگاه SNOMED CT.
* **معیار پذیرش فنی (DoD):** استخراج و بارگذاری کامل زیرمجموعه آناتومی و اختلالات SNOMED CT در دیتابیس محلی بدون هیچ‌گونه وابستگی به APIهای خارجی در زمان اجرا.

---

#### اسپرینت ۱۴ (هفته ۲۷ و ۲۸): پیاده‌سازی گراف ساختار-کل-جزء (SEP) در درخت آناتومی
* **چالش فنی:** در مدل مفهومی SNOMED CT، ویژگی‌های مکانی مانند `|Finding site|` تقریباً همیشه به مفهوم «ساختار» (`Liver structure`) متصل می‌شوند نه «کل عضو» (`Entire liver`)؛ زیرا بیماری کبد لزوماً تمام حجم کبد را به صورت یکجا دربر نمی‌گیرد. همچنین اجزای درونی یک عضو (مانند `Adrenal cortex structure`) از طریق زنجیره روابط `is-a` (`Layer of adrenal gland` -> `Adrenal part` -> `Adrenal gland structure`) به ساختار اصلی متصل شده‌اند.
* **وظایف مهندسی:**
  - [ ] استخراج تمامی روابط `is-a` و زیرشاخه‌های الگوی سه‌گانه **SEP (Structure-Entire-Part)** برای ۳,۵۴۰ موجودیت آناتومیک متمایزی که در SNOMED CT دارای رابطه فعال با بیماری‌ها هستند.
  - [ ] محاسبه بستار تعدی (Transitive Closure) لینک‌های معکوس `inverse_isa` در درخت آناتومی و پر کردن جدول `anatomy_hierarchy_sep` تا با کلیک روی هر اندام، تمامی لایه‌های بافتی، غشاها و زیربخش‌های درونی آن (که در آناتومی طبیعی کاملاً درون آن ساختار قرار دارند) بلافاصله شناسایی شوند.
* **معیار پذیرش فنی (DoD):** تایید بازیابی کامل زنجیره اجزای درونی (مانند قشر و مدولای غده فوق کلیوی هنگام کلیک روی کل غده فوق کلیوی) در کمتر از ۲ میلی‌ثانیه.

---

#### اسپرینت ۱۵ (هفته ۲۹ و ۳۰): پیاده‌سازی موتور پرس‌وجوی بازگشتی ANAT برای استخراج بیماری‌های هر نقطه
* **چالش فنی:** اگر سیستم هنگام کلیک روی یک عضو، صرفاً بیماری‌های متصل به کد کلی آن عضو و زیرمجموعه‌های درخت بیماری را بازیابی کند (رویکرد `TAXO`)، ۴۰ درصد از روابط معتبر بیماری-آناتومی (۴۱۲,۰۲۱ رابطه از ۱,۰۲۵,۹۰۴ رابطه شمول) پنهان مانده و از دست می‌روند.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی الگوریتم **پیمایش اجزای آناتومیک (`ANAT`)**: ابتدا استخراج بازگشتی تمام فرزندان ساختار آناتومیک `A` از طریق لینک‌های `inverse_isa` و سپس استخراج تمامی اختلالاتی که هر یک از این اجزا به عنوان ویژگی **`|Finding site|`** آن‌ها ثبت شده است (پوشش کامل ۹۰,۷۰۲ رابطه فعال `Finding site` و ۶۳,۱۹۰ اختلال متمایز، و افزایش میانه تعداد بیماری‌های هر نقطه از ۴ به ۷ اختلال).
  - [ ] اجرای تست‌های واحد (Unit Tests) بر روی نقاط مرجع؛ برای مثال کلیک روی `Structure of peritonsillar tissue (1015003)` باید دقیقاً اختلالات `Peritonsillar abscess (15033003)`، `Peritonsillar cellulitis (102453009)` و `Peritonsillar cyst (300931007)` را برگرداند.
* **کد پیاده‌سازی سرویس بازیابی بیماری‌ها (`PathologyQueryService.py`):**
```python
def fetch_disorders_by_fma_id(fma_id: str, db_conn) -> list[dict]:
    """
    اجرای الگوریتم ANAT بر روی گراف SEP جهت بازیابی ۱۰۰٪ بیماری‌های مرتبط با نقطه انتخابی و زیربخش‌های آن
    """
    sql = """
    WITH RECURSIVE anatomical_descendants AS (
        SELECT snomed_body_structure_id AS structure_id, 0 AS depth
        FROM anatomical_structures
        WHERE fma_id = :fma_id
        
        UNION ALL
        
        SELECT sep.child_snomed_id, ad.depth + 1
        FROM anatomy_hierarchy_sep sep
        INNER JOIN anatomical_descendants ad ON sep.parent_snomed_id = ad.structure_id
        WHERE ad.depth < 12
    )
    SELECT DISTINCT
        d.snomed_disorder_id,
        d.icd10_code,
        d.icdo_topography_code,
        d.fsn_en,
        d.preferred_term_fa,
        d.clinical_department,
        d.etiology_category,
        d.associated_morphology_id,
        d.pathological_process_id,
        d.causative_agent_id,
        d.clinical_course,
        d.visual_preset_type
    FROM disorders_pathology d
    INNER JOIN anatomical_descendants ad ON d.finding_site_snomed_id = ad.structure_id
    ORDER BY d.clinical_department ASC, d.preferred_term_fa ASC;
    """
    cursor = db_conn.execute(sql, {"fma_id": fma_id})
    return [dict(row) for row in cursor.fetchall()]
```
* **معیار پذیرش فنی (DoD):** دستیابی به پوشش کامل ۱,۰۲۵,۹۰۴ رابطه شمول در تست بنچمارک دیتابیس و زمان پاسخ‌گویی کوئری زیر ۱۰ میلی‌ثانیه.

---

#### اسپرینت ۱۶ (هفته ۳۱ و ۳۲): استخراج ماشینی ویژگی‌های «تاثیر بیماری بر بافت» (Morphology & Process)
* **چالش فنی:** برای نمایش گرافیکی تاثیر بیماری روی نقطه هدف در مرحله دوم، موتور سه‌بعدی باید ماهیت دقیق تغییر بافتی و فرآیند پاتولوژیک هر بیماری را به صورت پارامتریک بداند.
* **وظایف مهندسی:**
  - [ ] استخراج و پارس کردن عبارات ترکیبی (Expressions) و ویژگی‌های تعریف‌کننده هر اختلال در SNOMED CT:
    * **`|Associated morphology|` (کد `116676008`):** استخراج تغییرات سطح بافت یا سلول از زیرشاخه `|Morphologically abnormal structure|` (مانند عبارت استاندارد `64572001 |Disease| : 116676008 |Associated morphology| = 56246009 |Inflammation|`، یا `Degenerative abnormality` در دیابت نوع ۲ با کد `44054006`، و `Malignant neoplasm, primary` در سرطان پستان).
    * **`|Pathological process|`:** استخراج فرآیند پاتوفیزیولوژیک زیربنایی که منجر به تغییر ساختاری عضو شده است.
    * **سلسله‌مراتب ویژگی‌های `|Associated with|`:** استخراج `|Causative agent|` (عامل مستقیم بیماری شامل ارگانیسم، ماده شیمیایی یا نیروی فیزیکی، مانند ویروس در ذات‌الریه ویروسی)، `|Due to|` (ارتباط علیتی مستقیم با بیماری یا اقدام دیگر) و `|After|` (توالی زمانی وقوع).
    * **ویژگی‌های بالینی تکمیلی:** استخراج `|Severity|` (شدت نسبی برای اسلایدر گرافیکی)، `|Clinical course|` (نحوه شروع و سیر بیماری)، `|Occurrence|` (دوره سنی بروز) و `|Finding method|` (روش تشخیص).
* **معیار پذیرش فنی (DoD):** ثبت کامل پروفایل مورفولوژیک و علیتی برای تمامی اختلالات در جدول `disorders_pathology`.

---

#### اسپرینت ۱۷ (هفته ۳۳ و ۳۴): یکپارچه‌سازی استانداردهای ICD-10، ICD-O، Orphanet و FHIR
* **چالش فنی:** دانشجویان پزشکی و پزشکان برای مستندسازی بالینی، آنکولوژی و بیماری‌های نادر نیازمند تطبیق کدهای آناتومیک با سیستم‌های طبقه‌بندی بین‌المللی هستند.
* **وظایف مهندسی:**
  - [ ] اتصال خودکار مفاهیم SNOMED CT به کدهای **ICD-10** جهت برچسب‌گذاری علائم (Symptoms) بر روی مدل سه‌بعدی.
  - [ ] اتصال بیماری‌های نئوپلاستیک و تومورها به کدهای توپوگرافی ویرایش سوم **ICD-O (International Classification of Diseases for Oncology)** در فرمت استاندارد `C[site].[subsite]`.
  - [ ] افزودن نگاشت **SNOMED CT to Inserm Orphanet Map** برای پوشش بیماری‌های نادر و ژنتیکی.
  - [ ] اعمال آخرین اصلاحات مدل‌سازی SNOMED CT (مانند اتصال `Otitis media | 65363002` به ساختار مخاط صماخی `Tympanic mucosa structure | 14242009`، اتصال اختلالات فتق روده‌ای `Enterocele` به `Intestinal structure | 113276009`، و یافته‌های تصویربرداری سر و ساب‌دورال به `Head structure | 69536005`).
  - [ ] آماده‌سازی ساختار داده برای اتصال به راهنماهای درمانی مبتنی بر استاندارد **FHIR** و کدهای آزمایشگاهی **LOINC** (مانند پروتکل‌های پایش HbA1c در دیابت).
* **معیار پذیرش فنی (DoD):** نمایش هم‌زمان کدهای SNOMED CT، ICD-10، ICD-O و Orphanet در کارت اطلاعات هر بیماری.

---

#### اسپرینت ۱۸ (هفته ۳۵ و ۳۶): اولویت‌بندی ۱,۰۰۰ بیماری پرتکرار و نگاشت به پیش‌فرض‌های گرافیکی
* **چالش فنی:** مدیریت اولویت تولید محتوای بصری به گونه‌ای که پرتکرارترین بیماری‌های بالینی دارای بالاترین سطح جزئیات شبیه‌سازی باشند.
* **وظایف مهندسی:**
  - [ ] اولویت‌بندی **۱,۰۰۰ کد بیماری و شرایط بالینی پرتکرار (High-Frequency Codes)** بر اساس شیوع بالینی و سرفصل‌های آزمون‌های علوم پایه و بالینی پزشکی.
  - [ ] نگاشت خودکار تمامی کلاس‌های `|Associated morphology|` به ۵ موتور رندرینگ پارامتریک (`pbr_inflammation`, `pbr_ischemia`, `morph_atrophy`, `procedural_mass`, `rig_fracture`) تا هر یک از ۶۳,۱۹۰ بیماری موجود در دیتابیس دارای یک نمایش بصری معنادار روی عضو هدف باشد.
* **معیار پذیرش فنی (DoD):** پایان فاز سوم و تکمیل کامل پل ارتباطی داده میان مرحله اول (آناتومی) و مرحله دوم (بیماری‌ها).

---

### فاز چهارم: موتور شبیه‌سازی بصری پاتولوژی، تجربه کاربری آموزشی و انتشار (ماه‌های ۱۰ تا ۱۲)

#### اسپرینت ۱۹ (هفته ۳۷ و ۳۸): برنامه‌نویسی شیدرهای پارامتریک PBR برای التهاب، ایسکمی و نکروز بافتی
* **چالش فنی:** نمایش تغییرات رنگ، پرخونی، ادم و مرگ سلولی (نکروز) به صورت پیوسته و قابل کنترل با اسلایدر بر روی متریال‌های استاندارد PBR بدون نیاز به بارگذاری تکسچرهای سنگین مجزا برای هر بیماری.
* **وظایف مهندسی:**
  - [ ] توسعه شیدر پارامتریک **التهاب (`Inflammation | 56246009`)**: تغییر رنگ پایه بافت به سمت قرمزی پرخونی (Erythema)، کاهش پارامتر زبری (`Roughness`) جهت ایجاد ظاهر براق و متورم مخاطی، و تورم موضعی رئوس در امتداد بردار نرمال.
  - [ ] توسعه شیدر پارامتریک **ایسکمی و سکته قلبی (`Myocardial infarction | 22298006` و سکته تحتانی حاد `427396001` روی بافت عضله قلب `Heart muscle tissue`)**: اعمال ماسک کروی/ناحیه‌ای در قلمرو خون‌رسانی شریان مسدودشده، تغییر رنگ تدریجی میوکارد از صورتی طبیعی به کبود (ایسکمی) و خاکستری تیره/سیاه (نکروز) همراه با صفر کردن دامنه انیمیشن ضربان در ناحیه نکروزه.
* **نمونه کد GLSL Fragment Shader برای شبیه‌سازی التهاب و نکروز (`PathologyPBR.frag`):**
```glsl
uniform vec3 uBaseColor;
uniform vec3 uLesionCenter;
uniform float uLesionRadius;
uniform float uDiseaseSeverity; // بازه 0.0 (سالم) تا 1.0 (شدید)
uniform int uPathologyType;     // 1 = Inflammation (56246009), 2 = Ischemia/Necrosis (22298006)

varying vec3 vWorldPosition;

void main() {
    float dist = distance(vWorldPosition, uLesionCenter);
    float mask = smoothstep(uLesionRadius, uLesionRadius * 0.25, dist) * uDiseaseSeverity;
    
    vec3 finalColor = uBaseColor;
    
    if (uPathologyType == 1) {
        // التهاب: افزایش قرمزی پرخونی و درخشندگی سطح متورم
        vec3 inflamedColor = vec3(0.85, 0.12, 0.10);
        finalColor = mix(uBaseColor, inflamedColor, mask * 0.75);
    } else if (uPathologyType == 2) {
        // ایسکمی و نکروز میوکارد: تغییر رنگ به کبودی ایسکمیک و سیاهی بافت نکروزه
        vec3 ischemicColor = vec3(0.28, 0.22, 0.35);
        vec3 necroticColor = vec3(0.10, 0.09, 0.09);
        vec3 targetColor = mix(ischemicColor, necroticColor, uDiseaseSeverity);
        finalColor = mix(uBaseColor, targetColor, mask * 0.90);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
```
* **معیار پذیرش فنی (DoD):** تغییر بلادرنگ ظاهر بافت سالم به بافت ملتهب یا نکروزه با حرکت دادن اسلایدر شدت بیماری (`|Severity|`).

---

#### اسپرینت ۲۰ (هفته ۳۹ و ۴۰): پیاده‌سازی Blend Shapes، استاندارد ۵۲ گانه ARKit/FACS و اصلاح پایپ‌لاین تغییر شکل
* **چالش فنی:** در موتورهای بازی‌سازی و ابزارهای سه‌بعدی (مانند Unity، Blender و Maya)، به طور پیش‌فرض ابتدا `Blend Shapes` محاسبه شده و سپس تغییر شکل استخوان‌بندی (`Skinning`) اعمال می‌شود. در یک مدل تمام‌قد آناتومی، اعمال Blend Shapes پیش از Skinning باعث جابه‌جایی غیرطبیعی پوست نسبت به موقعیت مفاصل و استخوان‌ها می‌شود، در حالی که اجرای ابتدا Skinning و سپس Blend Shapes هیچ خطای بصری ایجاد نمی‌کند.
* **وظایف مهندسی:**
  - [ ] ساخت **اهداف ریخت‌شناختی (Blend Shapes / Morph Targets)** در Blender برای شبیه‌سازی تحلیل رفتگی بافت (`Degenerative abnormality` / آتروفی)، چروکیدگی سلولی (`Crenation`) و متلاشی شدن سلول (`Lysis`) در اثر تغییرات فشار اسمزی، با درون‌یابی خطی رئوس بین وزن `0.0` (مش پایه سالم) و `1.0` (مش هدف بیمار).
  - [ ] پیاده‌سازی ۵۲ شکل استاندارد **ARKit** و نگاشت مستقیم آن‌ها به واحدهای حرکتی (**Action Units - AUs**) در سیستم علمی **FACS (Facial Action Coding System)** جهت شبیه‌سازی دقیق فلج اعصاب جمجمه‌ای، عدم تقارن صورت و اختلالات حرکتی عضلات چهره.
  - [ ] پیاده‌سازی استخوان‌بندی (**Skeletal Rigging**) به همراه **Corrective Blend Shapes** (جهت رفع فرورفتگی یا افت حجم در زوایای شدید مفصلی) برای نمایش شکستگی‌های استخوانی (مانند شکستگی استخوان ران یا شکستگی ساق پا با کد `31261009`)، تحلیل الگوی حرکت طبیعی و غیرطبیعی در فیزیوتراپی، و نمایش اصول تثبیت و بی‌حرکت‌سازی (Immobilization) مفاصل بالا و پایین خط شکستگی در کنار تصاویر رادیوگرافی (X-Ray).
  - [ ] بازنویسی ترتیب ارزیابی تغییر شکل در **Compute Shader** (یا دستکاری Bind Pose از طریق `Mesh.boneWeights`) به گونه‌ای که **ابتدا ماتریس‌های Skinning استخوان‌ها روی رئوس اعمال شوند و سپس آفست‌های Blend Shapes پاتولوژی اضافه گردند**:
```glsl
// منطق محاسبه در Compute Shader / Custom Vertex Deformation: Skinning FIRST, BlendShapes SECOND
vec4 skinnedPosition = (boneMatrixX * aWeight.x + boneMatrixY * aWeight.y + 
                        boneMatrixZ * aWeight.z + boneMatrixW * aWeight.w) * vec4(aPosition, 1.0);

// اعمال آفست Blend Shape پاتولوژی پس از تغییر شکل اسکلتی
vec3 finalVertexPosition = skinnedPosition.xyz + (uMorphWeight * aPathologyMorphOffset);
```
* **معیار پذیرش فنی (DoD):** اجرای هم‌زمان حرکت مفصل (خم شدن اندام یا چرخش سر) و تغییر شکل پاتولوژیک (تورم، آتروفی یا فلج صورت) بدون هیچ‌گونه انحراف یا جدایش پوست از روی اسکلت.

---

#### اسپرینت ۲۱ (هفته ۴۱ و ۴۲): نمونه‌سازی رویه‌ای توده‌ها (تومور، کیست، آبسه) و کالیبراسیون اطمینان
* **چالش فنی:** نمایش ضایعات فضاگیر (نئوپلاسم‌ها، کیست‌ها و آبسه‌ها) در مختصات دقیق درونی اعضا و نمایش مرزهای نفوذ تومور به بافت‌های اطراف بر اساس داده‌های قطعه‌بندی هوش مصنوعی.
* **وظایف مهندسی:**
  - [ ] توسعه ماژول **نمونه‌سازی رویه‌ای (Procedural Instantiation)** برای تولید و جای‌گذاری مش‌های سه‌بعدی تومور (`Neoplasm`)، کیست (`Cyst | 300931007`) و آبسه (`Abscess | 15033003`) در مختصات فضایی دقیق ساختار هدف (مبتنی بر سیستم مختصات BodyParts3D) همراه با اعمال تغییر شکل فشاری به بافت‌های سالم مجاور.
  - [ ] پیاده‌سازی شیدر **فیلترینگ آستانه‌ای کالیبره‌شده (Calibrated Threshold Filtering)**: با الگوبرداری از خروجی مدل‌های قطعه‌بندی تصاویر MRI مبتنی بر شبکه‌های عصبی عمیق (`3D U-Net`، `nnU-Net` و معماری‌های Transformer)، اعمال تکنیک **مقیاس‌دهی دمایی (Temperature Scaling)** بر روی نقشه احتمالات پیش از نمایش به کاربر، تا دانشجو یا پزشک بتواند با تغییر اسلایدر آستانه اطمینان (Confidence Threshold)، مرزهای احتمالی گسترش تومور را با قابلیت اطمینان کالیبره‌شده بررسی کند.
* **معیار پذیرش فنی (DoD):** جانمایی دقیق تومور در زیربخش‌های آناتومیک بر اساس کد توپوگرافی `ICD-O` و عملکرد صحیح اسلایدر فیلترینگ مرز تومور در نمای برش مقطعی.

---

#### اسپرینت ۲۲ (هفته ۴۳ و ۴۴): مهندسی شناختی رابط کاربری، آزمایشگاه‌های بافت‌شناسی و خط زمانی POMR
* **چالش فنی:** پژوهش‌های آموزشی نشان می‌دهند که ابزارهای سه‌بعدی پیچیده (مانند Antepulsio) در صورتی که محتوا را یکجا ارائه دهند، تنها برای دانشجویان دارای «حافظه کاری دیداری-فضایی بالا» مفید بوده و سایر فراگیران را دچار اضافه‌بار شناختی (Cognitive Load) می‌کنند.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی معماری اطلاعات خردشده (Chunking): دسته‌بندی بیماری‌های هر نقطه بر اساس **دپارتمان‌های بالینی** که مشاهده مستقیم آن‌ها با چشم غیرمسلح دشوار است (مانند کاردیولوژی، گوارش و ارتوپدی) و فیلتر بر اساس **عوامل ایجادکننده** (ژنتیک، محیط، تروما و سبک زندگی).
  - [ ] پیاده‌سازی نمای پرونده بیمار در سه فرمت استاندارد: مدل پرونده پزشکی مبتنی بر مشکل (**POMR**)، خط زمانی سیر بیماری (**Timeline**) و حلقه سلسله‌مراتبی **5W1H** (Who, When, What, Where, Why, How).
  - [ ] ساخت فلوچارت‌های تعاملی همئوستاز برای نمایش وابستگی متقابل **۱۱ سیستم اصلی بدن** (شامل شبیه‌سازی تنظیم قند خون و آب در ورزش سنگین، اثرات هایپوترمی شدید و گرمازدگی، و نمودار هیستوگرام تغییرات ۲۴ ساعته pH بزاق).
  - [ ] یکپارچه‌سازی **۳۰ مدل آناتومی میکروسکوپی** و ماژول آزمایشگاه مجازی بافت‌شناسی (شامل شناسایی بافت‌های همبند سست آرئولار، بافت چربی، رتیکولار، متراکم منظم و نامنظم، غضروف هیالن و الاستیک، انیمیشن‌های میتوز و میوز سلولی، و شبیه‌ساز عملی غربالگری نمونه‌های پوستی از نظر سرطان و پاسخ به سوالات بیماران).
* **معیار پذیرش فنی (DoD):** تکمیل جریان کاربری از کلیک روی عضو در مرحله اول تا مشاهده دسته‌بندی دپارتمانی بیماری‌ها، خط زمانی POMR و نمای میکروسکوپی در مرحله دوم با حداکثر ۳ کلیک.

---

#### اسپرینت ۲۳ (هفته ۴۵ و ۴۶): موتور تعامل هم‌زمان کلاس درس (Yjs CRDT) و اعتبارسنجی کمی (Jaccard/Dice & SUS)
* **چالش فنی:** همگام‌سازی صحنه سه‌بعدی میان استاد و ده‌ها دانشجو در کلاس‌های مجازی بدون تاخیر شبکه، و سنجش علمی دقت هندسی و قابلیت استفاده سیستم.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی زیرساخت همکاری بلادرنگ با استفاده از پروتکل **Yjs CRDT** روی WebSockets: همگام‌سازی موقعیت نشانگر سه‌بعدی (Cursors)، زاویه دید دوربین (Viewports)، موقعیت صفحات برش و قطعات انتخاب‌شده بین تمامی شرکت‌کنندگان با **تاخیر زیر یک میلی‌ثانیه (Sub-millisecond latency)**، به همراه سیستم قفل اشیا (Object Locking) برای جلوگیری از تداخل و تاریخچه Undo/Redo مشترک.
  - [ ] اجرای بنچمارک کمی دقت قطعه‌بندی مدل‌های رندرشده در برابر استاندارد مرجع (Ground Truth) جهت ثبت **ضریب شباهت Jaccard حداقل 0.93** و **ضریب Dice حداقل 0.94**.
  - [ ] برگزاری تست کاربری با مشارکت پزشکان و دانشجویان پزشکی بر اساس **پرسشنامه استاندارد ۱۰ سوالی مقیاس قابلیت استفاده سیستم (SUS)** (مقیاس ۵ درجه‌ای از کاملاً مخالفم تا کاملاً موافقم).
* **معیار پذیرش فنی (DoD):** کسب امتیاز بالای ۸۰ در ارزیابی استاندارد SUS و تایید همگام‌سازی بدون پرش در اتاق مجازی ۱۰ نفره.

---

#### اسپرینت ۲۴ (هفته ۴۷ و ۴۸): سیستم مدیریت اشتراک Freemium، اتصال به LMS دانشگاهی و استقرار نهایی
* **چالش فنی:** پیاده‌سازی محدودیت‌های دسترسی نسخه رایگان و ابزارهای سازمانی دانشگاهی به گونه‌ای که هم جذب کاربر ارگانیک به حداکثر برسد و هم درآمدزایی B2C و B2B تضمین شود.
* **وظایف مهندسی:**
  - [ ] پیاده‌سازی موتور مدیریت مجوزها و سطوح دسترسی (Entitlement Engine):
    * **سطح رایگان (Personal Free Tier):** دسترسی کامل و رایگان به سیستم اسکلتی در مرحله اول، محدودیت مشاهده ۱۰ مدل پاتولوژی در ماه در مرحله دوم و امکان ذخیره حداکثر ۵ مدل سفارشی در کتابخانه شخصی.
    * **سطح دانشجویی و حرفه‌ای (Student & Pro Tier):** دسترسی نامحدود به تمام ۱۵ تا ۱۸ سیستم بدن، تمام ۶۳,۱۹۰ بیماری و شبیه‌سازی‌های پاتولوژی، حالت واقعیت افزوده (AR) و دانلود آفلاین.
    * **سطح سازمانی و دانشگاهی (Institutional Tier):** ارائه API/SDK، اتصال مستقیم به سیستم‌های مدیریت یادگیری دانشگاه‌ها (**LMS Integration**)، اشتراک‌گذاری نماهای سه‌بعدی سفارشی از طریق گروه‌های خصوصی و لینک‌های عمیق (**Deep Links**)، و داشبورد پایش عملکرد دانشجویان در آزمون‌های تشریح مجازی.
  - [ ] پیکربندی سرورهای توزیع محتوا (CDN) با هدرهای کش طولانی‌مدت و فشرده‌سازی Brotli برای فایل‌های `.glb` و `.ktx2` و انتشار نهایی روی وب و استورها.
* **معیار پذیرش فنی (DoD):** انتشار نسخه ۱.۰ محصول در محیط عملیاتی (Production) با عبور موفق از تمامی تست‌های امنیتی، عملکردی و رگولاتوری.

---

## ۴. جدول جامع معیارهای کنترل کیفیت فنی (Master Technical KPIs)

| شاخص فنی مهندسی | مقدار هدف استاندارد (Benchmark) | اسپرینت مسئول | روش تست و ابزار سنجش |
| :--- | :--- | :--- | :--- |
| **حجم پکیج دانلودی مدل‌های پایه** | ۳۴ مگابایت (مرد) و ۳۷ مگابایت (زن)؛ کل زیر ۷۱ مگابایت | اسپرینت ۶ | بررسی حجم خروجی GLB پس از فشرده‌سازی Draco |
| **کاهش مصرف VRAM تکسچرها** | کاهش ۶ تا ۸ برابری نسبت به PNG/JPG | اسپرینت ۱ و ۶ | بارگذاری با `KTX2Loader` و کدک Basis Universal |
| **بودجه مثلث‌های صحنه فعال موبایل** | ۳۰,۰۰۰ تا ۸۰,۰۰۰ مثلث در کل صحنه فعال | اسپرینت ۶ | پایش زنده در Chrome DevTools / WebGL Inspector |
| **سقف فراخوانی رسم (Draw Calls)** | حداکثر ۳۰ فراخوانی رسم در موبایل | اسپرینت ۶ و ۱۱ | بررسی `renderer.info.render.calls` در Three.js |
| **نرخ فریم هدف (Frame Rate)** | بالای ۳۰ فریم بر ثانیه در موبایل / ۹۰ فریم (زیر ۱۱ میلی‌ثانیه) در VR | اسپرینت ۱۱ | تست روی گوشی میان‌رده و Oculus Profiler / Unreal Insights |
| **زمان بارگذاری اولیه (Cold Load)** | زیر ۸ ثانیه (مدل کم‌تراکم) و میانگین ۱۰ تا ۱۷ ثانیه بارگذاری کامل | اسپرینت ۱۱ | تست سرعت لود نواحی مختلف با Frustum-Priority LOD |
| **دقت هندسی قطعه‌بندی آناتومیک** | ضریب Jaccard حداقل 0.93 و ضریب Dice حداقل 0.94 | اسپرینت ۲۳ | مقایسه هم‌پوشانی مش‌های نهایی با مقاطع مرجع MRI |
| **پوشش بازیابی بیماری‌ها در هر نقطه** | ۱,۰۲۵,۹۰۴ رابطه شمول (میانه ۷ اختلال به ازای هر ساختار) | اسپرینت ۱۵ | اجرای کوئری بازگشتی `ANAT` روی ۳,۵۴۰ ساختار در SNOMED CT |
| **تاخیر همگام‌سازی کلاس درس مجازی** | زیر ۱ میلی‌ثانیه (Sub-millisecond sync latency) | اسپرینت ۲۳ | تست همگام‌سازی زاویه دید و نشانگر با پروتکل `Yjs CRDT` |