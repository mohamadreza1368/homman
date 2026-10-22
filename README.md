# پلتفرم هوشمند سه‌بعدی آناتومی و شبیه‌ساز پاتوفیزیولوژی (هومان ۳D)
### Interactive 3D Anatomy Atlas & Smart Pathophysiology Simulation Platform

این پروژه بر اساس نقشه راه جامع ۲۴ اسپرینت (۱۲ ماهه) مندرج در [ROADMAP.md](file:///D:/my_projects/homman/ROADMAP.md) و [TECHNICAL_ROADMAP.md](file:///D:/my_projects/homman/TECHNICAL_ROADMAP.md) در حال توسعه است.

---

## 🏗️ ساختار پروژه

```
homman/
├── ROADMAP.md                  # نقشه راه کلان محصول و برنامه‌ریزی تیمی/تجاری
├── TECHNICAL_ROADMAP.md        # نقشه راه فنی عمیق اسپرینت‌به‌اسپرینت و نمونه کدها
├── docs/                       # مستندات رگولاتوری (FDA/EU MDR) و معماری
│   └── REGULATORY_INTENDED_USE.md
├── frontend/                   # اپلیکیشن وب و موبایل (Three.js + React + Vite + Tailwind + RTL)
│   ├── public/
│   │   └── wasm/               # فایل‌های دیکودر Draco و ترنسکودر Basis/KTX2
│   │       ├── draco/          # DRACOLoader WebAssembly
│   │       └── basis/          # KTX2Loader Basis Universal Transcoder
│   ├── src/
│   │   ├── engine/             # موتور رندرینگ سه‌بعدی (Three.js، شیدرها، لودر KTX2/Draco)
│   │   │   ├── AssetLoader.ts
│   │   │   └── AnatomyViewer.ts
│   │   ├── components/         # رابط کاربری راست‌به‌چپ (Navbar, Sidebar, PathologyDrawer)
│   │   └── data/               # نگاشت‌های پایه FMA و اختلالات بالینی
└── pipeline/                   # پایپ‌لاین آفلاین داده‌های پزشکی و اسکریپت‌های Blender
    ├── data/
    │   └── medical_knowledge.db # دیتابیس محلی رابطه FMA <-> SNOMED CT <-> ICD-10
    └── scripts/
        ├── schema.sql          # اسکیمای کامل جداول ساختارها، سلسله‌مراتب SEP و پاتولوژی
        ├── init_database.py    # اسکریپت راه‌اندازی و سید دیتابیس
        ├── query_anat.py       # پیاده‌سازی و تست الگوریتم بازگشتی ANAT
        └── cure_meshes.py      # اسکریپت پایتون بلندر برای پاکسازی هندسه مش‌ها (Watertight)
```

---

## 🚀 راهنمای اجرای سریع

### ۱. اجرای فرانت‌اند (رابط کاربری و موتور سه‌بعدی)
```bash
cd frontend
npm install
npm run dev
```
سپس مرورگر را در آدرس `http://localhost:5173` باز کنید.

### ۲. اجرای پایپ‌لاین داده‌های پزشکی (پایتون)
```bash
python pipeline/scripts/init_database.py
python pipeline/scripts/query_anat.py FMA7088
```

---

## ✅ وضعیت پیشرفت فاز صفر (اسپرینت ۱ و ۲)
- [x] راه‌اندازی پروژه فرانت‌اند با React، Three.js، Vite، Tailwind CSS و رابط راست‌به‌چپ (RTL).
- [x] پیکربندی `DRACOLoader` و `KTX2Loader` به همراه ترنسکودر Basis Universal در مسیر `/wasm/`.
- [x] پیاده‌سازی موتور سه‌بعدی `AnatomyViewer` مجهز به OrbitControls، سیستم لایه‌ها، نمای انفجاری (Explode View) و برش مقطعی (Clipping Planes).
- [x] طراحی و اجرای اسکیمای دیتابیس استاندارد بر پایه مدل OMOP و سلسله‌مراتب SEP.
- [x] پیاده‌سازی موفق الگوریتم پیمایش بازگشتی `ANAT` در پایتون با کشف روابط ساختار به بیماری.
- [x] تدوین سند رسمی رگولاتوری معافیت تجهیزات پزشکی (**FDA/EU MDR Category 1: Non-Device**).
