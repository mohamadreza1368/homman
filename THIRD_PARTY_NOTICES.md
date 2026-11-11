# Third-Party Notices & Asset Provenance

این سند فهرست دارایی‌های سه‌بعدی، کدک‌ها، کتابخانه‌های نرم‌افزاری و واژگان پزشکی استفاده‌شده یا ارجاع‌شده در پروژه **هومان 3D** را به همراه منبع، تاریخ ثبت، مجوز و محدودیت‌های بازتوزیع مستند می‌کند.

---

## ۱. مدل‌های آناتومی سه‌بعدی (3D Anatomical Assets)

### ۱.۱ BodyParts3D (نسخه 4.0)
- **تولیدکننده / منبع:** Database Center for Life Science (DBCLS), University of Tokyo — https://lifesciencedb.jp/bp3d/
- **مسیر در مخزن محلی:** `frontend/public/models/atlas.json` و `body-0..14.bin` (در گیت نادیده گرفته می‌شوند و برای محیط محلی دانلود/تبدیل شده‌اند)
- **تاریخ ثبت / آماده‌سازی محلی:** `2026-10-28`
- **مجوز:** Creative Commons Attribution-ShareAlike 2.1 Japan (`CC BY-SA 2.1 JP`)
- **محدودیت بازتوزیع:** هرگونه بازنشر یا ساخت مشتقات از فایل‌های مش نیازمند ذکر منبع DBCLS و حفظ مجوز ShareAlike است.

### ۱.۲ Z-Anatomy (Écorché GLB Fallback)
- **تولیدکننده / منبع:** Z-Anatomy Open-Source Project (Gauthier Kervyn و همکاران، برگرفته از Visible Human Project) — https://www.z-anatomy.com/
- **مسیر در مخزن:** `frontend/public/models/z-anatomy/*.glb`
- **تاریخ دریافت / ثبت در مخزن:** `2026-10-30`
- **مجوز:** Creative Commons Attribution-ShareAlike 4.0 International (`CC BY-SA 4.0`)
- **نکته حقوقی پیش از انتشار تجاری:** انتشار عمومی یا تجاری حاوی فایل‌های GLB مستلزم رعایت کامل شرایط `CC BY-SA 4.0` (انتساب دقیق + انتشار مشتقات فایل‌های سه‌بعدی تحت همین مجوز) و اطمینان از تمیز بودن مشتقات بدون تضاد مجوز با دارایی‌های اختصاصی است.

---

## ۲. کدک‌ها و دیکودرهای وب‌اسمبلی (WASM Decoders)

### ۲.۱ Google Draco Decoder (`frontend/public/wasm/draco/`)
- **منبع:** https://github.com/google/draco (از طریق توزیع Three.js)
- **مجوز:** Apache License 2.0

### ۲.۲ Binomial Basis Universal / KTX2 Transcoder (`frontend/public/wasm/basis/`)
- **منبع:** https://github.com/BinomialLLC/basis_universal (از طریق توزیع Three.js)
- **مجوز:** Apache License 2.0

---

## ۳. واژگان و استانداردهای اصطلاح‌شناسی پزشکی (Biomedical Terminologies)

> **هشدار مهم مجوزها (پیش از انتشار تجاری/عمومی):** وجود شناسه‌های متنی زیر در فایل‌های JSON آموزشی به معنای مجوز بازتوزیع خود پایگاه‌داده‌های کامل مرجع نیست.

1. **Foundational Model of Anatomy (FMA v4.6)**
   - **منبع:** Structural Informatics Group, University of Washington
   - **استفاده در پروژه:** ارجاع شناسه‌های ساختار کالبدی (مانند `FMA7088`)
   - **مجوز:** `CC BY 4.0` (ذکر منبع دانشگاه واشنگتن الزامی است).
2. **SNOMED CT International Concept Identifiers**
   - **منبع:** SNOMED International
   - **محدودیت حیاتی:** استفاده از شناسه‌ها و توصیفات کامل SNOMED CT در محصولات منتشرشده نیازمند داشتن مجوز عضویت یا **SNOMED CT Affiliate License** (بسته به کشور مبدأ و حوزه استقرار) است. پیش از انتشار عمومی/تجاری باید کدهای SNOMED یا جایگزین باز آن‌ها ممیزی حقوقی شوند.
3. **ICD-10 / ICD-O-3**
   - **منبع:** سازمان جهانی بهداشت (World Health Organization - WHO)
   - **محدودیت:** کپی‌رایت واژگان و ساختار کامل متعلق به WHO است؛ بازتوزیع عمومی گسترده منوط به مجوز رسمی انتشار از WHO است.
4. **Orphanet (Inserm)**
   - **منبع:** Orphadata (https://www.orphadata.com/)
   - **مجوز:** `CC BY 4.0` با ذکر منبع Inserm Orphanet.

---

## ۴. کتابخانه‌های نرم‌افزاری (Frontend Dependencies)

| بسته | نسخه | مجوز |
|---|---|---|
| `three` | `0.174.0` | MIT |
| `three-mesh-bvh` | `0.8.2` | MIT |
| `react` / `react-dom` | `19.0.0` | MIT |
| `vite` / `@vitejs/plugin-react` | `6.1.0` / `4.3.4` | MIT |
| `tailwindcss` / `@tailwindcss/vite` | `4.3.3` | MIT |
| `lucide-react` | `0.475.0` | ISC |
| `clsx` | `2.1.1` | MIT |
| `tailwind-merge` | `3.0.1` | MIT |
