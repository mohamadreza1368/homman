# چک‌لیست آمادگی انتشار آزمایشی (Release Readiness Checklist)

پیش از هرگونه انتشار عمومی یا استقرار نسخه آزمایشی روی دامنه، تمامی بندهای زیر باید تأیید و علامت زده شوند:

## ۱. انطباق دامنه، رگولاتوری و صداقت علمی
- [x] متن رابط کاربری، عنوان صفحه و مستندات کاربرد محصول را صراحتاً «ابزار آموزشی و مرجع تصویری» معرفی می‌کنند.
- [x] مودال سلب مسئولیت پزشکی پیش از ورود اولیه نمایش داده می‌شود و پذیرش آن به صورت نسخه‌دار در `localStorage` ثبت می‌گردد.
- [x] هر نمایش بیماری یا ریتم فیزیولوژیک دارای برچسب شفاف «نمایش آموزشی/مفهومی» است و کنترل‌های بدون اثر (مانند اسلایدر بی‌اثر شدت بالینی) حذف شده‌اند.
- [x] وضعیت محتوا (`reference` / `educational_visualization` / `draft`) تفکیک شده و رکوردهای `draft` در UI عمومی نمایش داده نمی‌شوند.
- [ ] تأییدیه نهایی محتوای آموزشی برای نسخه انتشار توسط بازبین علمی واجد صلاحیت پزشکی (`MD / PhD آناتومی`) ثبت شده است (نسخه فعلی دارای بازبینی اولیه است).

## ۲. یکپارچگی داده، مدل و خط لوله بازتولید
- [x] `AnatomyRecord` (`id` داخلی پایدار، `fmaId`، `meshNames` بدون تکرار) بین انتخاب ۳بعدی، جست‌وجو، ایزوله‌سازی و پنل مفاهیم یکپارچه شده است.
- [x] ساختارهای بدون نگاشت تاییدشده به طور ایمن شناسایی می‌شوند و اطلاعات بالینی نامعتبر نمایش نمی‌دهند.
- [x] خروجی `pathologyKnowledgeGraph.json` و `anatomyCatalog.json` با یک دستور (`npm run pipeline:export`) بازتولید و با `npm run validate:data` اعتبارسنجی می‌شوند.
- [x] هیچ داده نمونه (`mockPathology`) در باندل نهایی فرانت‌اند وجود ندارد.

## ۳. عملکرد، پایداری رندر و تست‌های خودکار
- [x] پیشرفت دانلود بر پایه بایت واقعی (`loadedBytes / totalBytes`) و با محافظت در برابر تداخل مدیریت دانلود ویندوز (`IDM .bin`)، تایم‌اوت و بافر معیوب پیاده‌سازی شده است.
- [x] `DRACOLoader` و `KTX2Loader` به لودر GLB (پشتیبان Z-Anatomy) متصل هستند.
- [x] حالت سبک (`Lite Mode`) با کاهش نسبت پیکسل، توقف رندر در پس‌زمینه (`visibilitychange` و `IntersectionObserver`) و پیام خطای فارسی + دکمه «تلاش مجدد» فعال است.
- [ ] آزمایش میدانی روی سخت‌افزارهای موبایل میان‌رده واقعی پیش از انتشار تجاری.

## ۴. حریم خصوصی، امنیت استقرار و مجوزها
- [x] بدون نیاز به حساب کاربری؛ بدون telemetry پیش‌فرض و بدون جمع‌آوری داده‌های سلامت یا هویتی کاربر.
- [x] مجوز کد (`LICENSE`)، سند منابع دارایی‌ها (`THIRD_PARTY_NOTICES.md`) و محدودیت مجوز SNOMED CT / ICD-10 / Z-Anatomy مستند شده است.
- [ ] بررسی و امضای قراردادهای حقوقی واژگان پزشکی (در صورت نشر تجاری حاوی کدهای SNOMED/ICD).

### هدرهای امنیتی پیشنهادی برای سرور Deploy (Nginx / CDN / Vercel)
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';" always;
```
