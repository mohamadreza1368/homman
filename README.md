# هومان ۳D — اطلس آموزشی سه‌بعدی آناتومی و مرور مفاهیم پاتوفیزیولوژی

**هومان 3D** یک ابزار آموزشی و مرجع تصویری سه‌بعدی (فارسی/انگلیسی) مبتنی بر React، TypeScript و Three.js برای مشاهده ساختارهای تشریحی بدن، جست‌وجوی دو‌زبانه، برش مقطعی سه‌محوره، ایزوله‌سازی اندام‌ها و نمایش آموزشی/مفهومی تغییرات مرتبط است.

---

## ⚠️ محدودیت‌های پزشکی و علمی (Medical & Scientific Disclaimers)

> **«هومان 3D یک ابزار آموزشی و مرجع تصویری است. محتوای آن جایگزین نظر پزشک، تشخیص، درمان یا تصمیم‌گیری بالینی نیست.»**

- این محصول برای **تشخیص بیماری برای بیمار واقعی، تحلیل تصاویر پزشکی/داده آزمایشگاهی، توصیه درمان یا دارو، تریاژ، پشتیبانی از تصمیم بالینی، یا شبیه‌سازی بالینی معتبر** طراحی **نشده** و خارج از دامنه کاربرد مجاز است.
- نمایش‌های بیماری و تپش قلب در این برنامه دارای برچسب **`educational_visualization` (نمایش آموزشی و مفهومی)** هستند و به هیچ وجه نشان‌دهنده شدت واقعی، پیش‌آگهی یا مدل فیزیولوژیک کالیبره‌شده بالینی نیستند.
- مطالعه مستند کامل دامنه و رگولاتوری: [docs/REGULATORY_INTENDED_USE.md](docs/REGULATORY_INTENDED_USE.md)
- مطالعه چک‌لیست پیش از انتشار: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- مجوزها و حقوق مالکیت دارایی‌ها و واژگان پزشکی: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

## 🏗️ ساختار پروژه

- [frontend/](frontend/) — رابط کاربری RTL و موتور WebGL/Three.js (`AtlasModelLoader`, `ZAnatomyLoader` + `DRACOLoader`/`KTX2Loader`, `AnatomyViewer`)
- [pipeline/](pipeline/) — پایگاه‌داده آفلاین SQLite و اسکریپت بازتولید کاتالوگ `AnatomyRecord` و گراف مفاهیم
- [scripts/](scripts/) — اسکریپت‌های اعتبارسنجی اسکیما، نگاشت و خط‌مشی متن آموزشی (`validate-data.mjs`, `lint-check.mjs`)
- [docs/](docs/) — مستندات مرزبندی کاربرد و چک‌لیست انتشار
- [ROADMAP.md](ROADMAP.md) و [TECHNICAL_ROADMAP.md](TECHNICAL_ROADMAP.md) — اسناد طراحی کلان و فنی

---

## 💻 پیش‌نیازها (نسخه‌های آزموده‌شده)

- **Node.js:** `v22+` (آزموده‌شده با `Node v26.7.0` با اجرای مستقیم فایل‌های تست TypeScript)
- **Python:** `3.12+` (آزموده‌شده با `Python 3.14.5` به همراه `sqlite3` استاندارد)

---

## 🚀 راهنمای اجرا و بررسی

### ۱. نصب وابستگی‌ها و اجرای محیط توسعه فرانت‌اند

```bash
npm --prefix frontend ci
npm run dev
```

**خروجی مورد انتظار:** سرور محلی Vite روی `http://localhost:5173` آماده می‌شود.

### ۲. بازتولید خروجی داده‌های پزشکی از پایپ‌لاین

```bash
npm run pipeline:export
npm run pipeline:check
```

**خروجی مورد انتظار:**
```text
[OK] Exported 54 AnatomyRecords (410 mapped atlas meshes, 1824 unmapped in dev report) and 20 organs / 41 educational disorders.
[OK] Pipeline check passed cleanly.
```

### ۳. اعتبارسنجی داده‌ها، بررسی کد، تست واحد و بیلد تولید

```bash
npm run lint
npm run validate:data
npm run typecheck
npm test
npm run build
```

**خروجی مورد انتظار:**
- `lint`: عبور بدون عبارت‌های ممنوعه تشخیصی یا داده‌ی نمونه در کد محصول
- `validate:data`: تأیید یکتایی تمام `meshNames` و صحت شناسه‌ها و متادیتای منبع/بازبین
- `test`: موفقیت تمام تست‌های واحد (9/9)
- `build`: تولید خروجی بدون خطا در `frontend/dist/`

### ۴. تست End-to-End مرورگر واقعی (در صورت نصب Chrome/Edge و فعال بودن سرور)

```bash
npm run test:e2e
```
