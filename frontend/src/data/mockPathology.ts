import type { PathologyDisorder } from '../types/anatomy';

export const MOCK_PATHOLOGY_DISORDERS: Record<string, PathologyDisorder[]> = {
  // Heart (FMA7088) -> Traversing to Myocardium & Heart muscle structure
  FMA7088: [
    {
      snomedDisorderId: '22298006',
      icd10Code: 'I21.9',
      fsnEn: 'Myocardial infarction (disorder)',
      preferredTermFa: 'سکته قلبی (انفارکتوس میوکارد)',
      clinicalDepartment: 'کاردیولوژی',
      etiologyCategory: 'عروقی و تروما',
      findingSiteSnomedId: '80891009',
      associatedMorphologyId: '56246009',
      visualPresetType: 'pbr_ischemia',
      clinicalCourse: 'حمله‌ای حاد',
      descriptionFa: 'انسداد سرخرگ‌های کرونری و قطع خون‌رسانی به بخشی از عضله قلب که منجر به ایسکمی و نکروز بافت میوکارد می‌شود.'
    },
    {
      snomedDisorderId: '427396001',
      icd10Code: 'I21.1',
      fsnEn: 'Acute myocardial infarction of inferior wall',
      preferredTermFa: 'سکته قلبی حاد دیواره تحتانی',
      clinicalDepartment: 'کاردیولوژی',
      etiologyCategory: 'عروقی',
      findingSiteSnomedId: '80891009',
      visualPresetType: 'pbr_ischemia',
      clinicalCourse: 'حاد',
      descriptionFa: 'سکته میوکارد در قلمرو شریان کرونری راست که با اختلال ریتم و برادی‌کاردی همراه است.'
    },
    {
      snomedDisorderId: '89138009',
      icd10Code: 'I42.0',
      fsnEn: 'Dilated cardiomyopathy (disorder)',
      preferredTermFa: 'کاردیومیوپاتی اتساعی',
      clinicalDepartment: 'کاردیولوژی',
      etiologyCategory: 'ژنتیکی و متابولیک',
      findingSiteSnomedId: '302551006',
      visualPresetType: 'morph_atrophy',
      clinicalCourse: 'مزمن پیش‌رونده',
      descriptionFa: 'بزرگ شدن و نازک شدن دیواره بطن‌ها و کاهش قدرت انقباضی قلب.'
    }
  ],
  // Liver (FMA7199)
  FMA7199: [
    {
      snomedDisorderId: '56246009_LIVER',
      icd10Code: 'K75.9',
      fsnEn: 'Inflammatory liver disease (disorder)',
      preferredTermFa: 'بیماری التهابی کبد (هپاتیت)',
      clinicalDepartment: 'گوارش و کبد',
      etiologyCategory: 'عفونی و ایمنی',
      findingSiteSnomedId: '181277001',
      associatedMorphologyId: '56246009',
      visualPresetType: 'pbr_inflammation',
      clinicalCourse: 'حاد و مزمن',
      descriptionFa: 'پاسخ التهابی بافت هپاتوسیت‌ها ناشی از ویروس‌ها، سموم یا واکنش‌های خودایمنی.'
    },
    {
      snomedDisorderId: '197365007',
      icd10Code: 'K74.6',
      fsnEn: 'Cirrhosis of liver (disorder)',
      preferredTermFa: 'سیروز کبدی',
      clinicalDepartment: 'گوارش و کبد',
      etiologyCategory: 'مزمن و متابولیک',
      findingSiteSnomedId: '181277001',
      visualPresetType: 'morph_atrophy',
      clinicalCourse: 'مزمن مرحله نهایی',
      descriptionFa: 'جایگزینی فیبروز بافتی و ندول‌های بازسازی‌کننده به جای سلول‌های پارانشیم نرمال کبد.'
    }
  ],
  // Right Lung (FMA7195)
  FMA7195: [
    {
      snomedDisorderId: '233604007',
      icd10Code: 'J18.9',
      fsnEn: 'Pneumonia (disorder)',
      preferredTermFa: 'سینه‌پهلو (پنومونی ریه)',
      clinicalDepartment: 'ریه و عفونی',
      etiologyCategory: 'عفونی (باکتریایی/ویروسی)',
      findingSiteSnomedId: '181216001',
      associatedMorphologyId: '56246009',
      visualPresetType: 'pbr_inflammation',
      clinicalCourse: 'حاد تب‌دار',
      descriptionFa: 'التهاب کیسه‌های هوایی ریه همراه با تجمع مایع یا چرک در حبابچه‌ها.'
    },
    {
      snomedDisorderId: '363358000',
      icd10Code: 'C34.9',
      icdoTopographyCode: 'C34.9',
      fsnEn: 'Malignant neoplasm of lung (disorder)',
      preferredTermFa: 'تومور بدخیم ریه',
      clinicalDepartment: 'انکولوژی',
      etiologyCategory: 'محیطی (دخانیات) و ژنتیکی',
      findingSiteSnomedId: '181216001',
      visualPresetType: 'procedural_mass',
      clinicalCourse: 'مزمن پیش‌رونده',
      descriptionFa: 'رشد مهارنشدنی سلول‌های اپیتلیوم مجاری تنفسی با قابلیت تهاجم موضعی و متاستاز.'
    }
  ],
  // Left Lung (FMA7196)
  FMA7196: [
    {
      snomedDisorderId: '233604007_L',
      icd10Code: 'J18.9',
      fsnEn: 'Pneumonia of left lung',
      preferredTermFa: 'پنومونی ریه چپ',
      clinicalDepartment: 'ریه و عفونی',
      etiologyCategory: 'عفونی',
      findingSiteSnomedId: '181217005',
      visualPresetType: 'pbr_inflammation',
      clinicalCourse: 'حاد',
      descriptionFa: 'تراکم و التهاب بافت پارانشیم ریه چپ.'
    }
  ],
  // Femur (FMA9915)
  FMA9915: [
    {
      snomedDisorderId: '31261009',
      icd10Code: 'S72.9',
      fsnEn: 'Fracture of femur (disorder)',
      preferredTermFa: 'شکستگی استخوان ران (فمور)',
      clinicalDepartment: 'ارتوپدی',
      etiologyCategory: 'تروما فیزیکی',
      findingSiteSnomedId: '71341001',
      visualPresetType: 'rig_fracture',
      clinicalCourse: 'تروما شدید',
      descriptionFa: 'گسیختگی تمامیت استخوان ران ناشی از ضربه با انرژی بالا، نیازمند تثبیت ارتوپدی.'
    }
  ],
  // Cerebrum (FMA5018)
  FMA5018: [
    {
      snomedDisorderId: '230690007',
      icd10Code: 'I63.9',
      fsnEn: 'Cerebral infarction (stroke)',
      preferredTermFa: 'سکته مغزی ایسکمیک',
      clinicalDepartment: 'نورولوژی',
      etiologyCategory: 'عروقی',
      findingSiteSnomedId: '113105001',
      visualPresetType: 'pbr_ischemia',
      clinicalCourse: 'حاد ناگهانی',
      descriptionFa: 'کاهش شدید پرفیوژن خونی مغز و نقص نورولوژیک ماندگار در قلمرو عروقی مسدود شده.'
    }
  ],
  // Spine (FMA13478)
  FMA13478: [
    {
      snomedDisorderId: '202722002',
      icd10Code: 'M51.2',
      fsnEn: 'Herniation of intervertebral disc',
      preferredTermFa: 'فتق دیسک بین‌مهره‌ای',
      clinicalDepartment: 'جراحی اعصاب و ارتوپدی',
      etiologyCategory: 'دژنراتیو و فشار مکانیکی',
      findingSiteSnomedId: '122494005',
      visualPresetType: 'morph_atrophy',
      clinicalCourse: 'مزمن عودکننده',
      descriptionFa: 'بیرون‌زدگی هسته پالپوزوس دیسک و فشار به ریشه‌های عصبی نخاعی.'
    }
  ]
};
