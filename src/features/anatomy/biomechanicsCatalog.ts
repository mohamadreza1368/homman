/**
 * Biomechanical, Kinematic & Soft-Tissue Physics Catalog
 *
 * Bridges static anatomical meshes with MuscleMimic (MyoFullBody: 123 joints,
 * 416 muscles, 72 DoFs, Hill-type muscle dynamics) kinematics, Range of Motion (ROM),
 * agonist/antagonist pairs, and constitutive material constants (Young's modulus,
 * Poisson's ratio, density) for simulation readiness.
 */

import type { AnatomicalSystem } from "@/lib/schemas";

export interface JointKinematicsProfile {
  id: string;
  pattern: RegExp;
  nameFa: string;
  nameEn: string;
  myoFullBodyId: string;
  dofCount: number;
  axes: {
    motionFa: string;
    motionEn: string;
    romDegrees: string;
    agonistFa: string;
    agonistEn: string;
    antagonistFa: string;
    antagonistEn: string;
  }[];
  relatedMusclePatterns: RegExp[];
}

export interface TissuePhysicsProfile {
  familyFa: string;
  familyEn: string;
  youngsModulus: string;
  poissonsRatio: string;
  density: string;
  constitutiveModel: string;
}

export const JOINT_KINEMATICS_CATALOG: JointKinematicsProfile[] = [
  {
    id: "shoulder_glenohumeral",
    pattern: /glenohumeral|shoulder|humer.*head|scapula.*glenoid|deltoid/i,
    nameFa: "مفصل شانه (گلنوهومرال — ۳ درجه آزادی)",
    nameEn: "Glenohumeral Joint (3 DoFs)",
    myoFullBodyId: "shoulder_r / shoulder_l (Ball-and-Socket)",
    dofCount: 3,
    axes: [
      {
        motionFa: "ابداکشن / اداکشن",
        motionEn: "Abduction / Adduction",
        romDegrees: "0° – 180° / 0° – 50°",
        agonistFa: "دلتوئید، سوپرااسپیناتوس",
        agonistEn: "Deltoid, Supraspinatus",
        antagonistFa: "پکتورالیس ماژور، لاتیسیموس دورسی",
        antagonistEn: "Pectoralis major, Latissimus dorsi",
      },
      {
        motionFa: "فلکشن / اکستنشن",
        motionEn: "Flexion / Extension",
        romDegrees: "0° – 180° / 0° – 60°",
        agonistFa: "دلتوئید قدامی، کوراکوبراکیالیس",
        agonistEn: "Anterior deltoid, Coracobrachialis",
        antagonistFa: "دلتوئید خلفی، ترس ماژور",
        antagonistEn: "Posterior deltoid, Teres major",
      },
    ],
    relatedMusclePatterns: [/deltoid/i, /supraspinatus/i, /infraspinatus/i, /subscapularis/i, /pectoralis_major/i, /latissimus_dorsi/i],
  },
  {
    id: "elbow_humeroulnar",
    pattern: /elbow|humeroulnar|humeroradial|biceps_brachii|triceps_brachii|brachialis/i,
    nameFa: "مفصل آرنج (لولایی — ۲ درجه آزادی با ساعد)",
    nameEn: "Elbow & Radioulnar Complex (2 DoFs)",
    myoFullBodyId: "elbow_flexion + pro_sup",
    dofCount: 2,
    axes: [
      {
        motionFa: "فلکشن / اکستنشن آرنج",
        motionEn: "Elbow Flexion / Extension",
        romDegrees: "0° – 145°",
        agonistFa: "براکیالیس، بایسپس براکیال، براکیورادیالیس",
        agonistEn: "Brachialis, Biceps brachii, Brachioradialis",
        antagonistFa: "ترایسپس براکیال، آنکونئوس",
        antagonistEn: "Triceps brachii, Anconeus",
      },
      {
        motionFa: "سوپینیشن / پرونیشن ساعد",
        motionEn: "Forearm Supination / Pronation",
        romDegrees: "85° Sup / 80° Pro",
        agonistFa: "سوپیناتور، بایسپس براکیال",
        agonistEn: "Supinator, Biceps brachii",
        antagonistFa: "پروناتور ترس، پروناتور کوادراتوس",
        antagonistEn: "Pronator teres, Pronator quadratus",
      },
    ],
    relatedMusclePatterns: [/biceps_brachii/i, /triceps_brachii/i, /brachialis/i, /brachioradialis/i, /pronator_teres/i],
  },
  {
    id: "hip_coxofemoral",
    pattern: /hip_joint|acetabul|femoral_head|gluteus_maximus|gluteus_medius|iliopsoas/i,
    nameFa: "مفصل ران (کوکسوفمورال — ۳ درجه آزادی)",
    nameEn: "Hip (Coxofemoral) Joint (3 DoFs)",
    myoFullBodyId: "hip_flexion / hip_adduction / hip_rotation",
    dofCount: 3,
    axes: [
      {
        motionFa: "فلکشن / اکستنشن ران",
        motionEn: "Hip Flexion / Extension",
        romDegrees: "0° – 120° / 0° – 30°",
        agonistFa: "ایلیوپسواس، رکتوس فموریس، سارتوریوس",
        agonistEn: "Iliopsoas, Rectus femoris, Sartorius",
        antagonistFa: "گلوتئوس ماگزیموس، همسترینگ",
        antagonistEn: "Gluteus maximus, Hamstrings",
      },
      {
        motionFa: "ابداکشن / اداکشن",
        motionEn: "Abduction / Adduction",
        romDegrees: "0° – 45° / 0° – 30°",
        agonistFa: "گلوتئوس مدیوس و مینیموس",
        agonistEn: "Gluteus medius & minimus",
        antagonistFa: "ادکتور لونگوس، مگنوس و برویس",
        antagonistEn: "Adductor longus, magnus & brevis",
      },
    ],
    relatedMusclePatterns: [/gluteus_maximus/i, /gluteus_medius/i, /psoas/i, /iliacus/i, /adductor_longus/i, /sartorius/i],
  },
  {
    id: "knee_tibiofemoral",
    pattern: /knee|patell|menisc|cruciate|quadriceps|rectus_femoris|vastus|biceps_femoris/i,
    nameFa: "مفصل زانو (تیبیوفمورال — ۱ درجه آزادی اصلی + چرخش قفلی)",
    nameEn: "Knee (Tibiofemoral) Joint (1+1 DoFs)",
    myoFullBodyId: "knee_angle_r / knee_angle_l",
    dofCount: 2,
    axes: [
      {
        motionFa: "فلکشن / اکستنشن زانو",
        motionEn: "Knee Flexion / Extension",
        romDegrees: "0° – 135° (Screw-home 10°)",
        agonistFa: "چهارسر رانی (کوادریسپس)",
        agonistEn: "Quadriceps femoris (Rectus femoris, Vasti)",
        antagonistFa: "همسترینگ، گاستروکنمیوس",
        antagonistEn: "Hamstrings, Gastrocnemius",
      },
    ],
    relatedMusclePatterns: [/rectus_femoris/i, /vastus_/i, /biceps_femoris/i, /semitendinosus/i, /semimembranosus/i, /gastrocnemius/i],
  },
  {
    id: "ankle_talocrural",
    pattern: /ankle|talocrural|achilles|calcaneal_tendon|gastrocnemius|soleus|tibialis_anterior/i,
    nameFa: "مفصل مچ پا (تالوکرورال — ۲ درجه آزادی)",
    nameEn: "Ankle & Subtalar Complex (2 DoFs)",
    myoFullBodyId: "ankle_angle + subtalar_angle",
    dofCount: 2,
    axes: [
      {
        motionFa: "دورسی‌فلکشن / پلانتارفلکشن",
        motionEn: "Dorsiflexion / Plantarflexion",
        romDegrees: "0° – 20° DF / 0° – 50° PF",
        agonistFa: "تیبیالیس قدامی (دورسی‌فلکشن)",
        agonistEn: "Tibialis anterior (DF)",
        antagonistFa: "گاستروکنمیوس، سولئوس (پلانتارفلکشن)",
        antagonistEn: "Gastrocnemius, Soleus (PF)",
      },
    ],
    relatedMusclePatterns: [/gastrocnemius/i, /soleus/i, /tibialis_anterior/i, /fibularis/i],
  },
];

const TISSUE_PHYSICS_BY_SYSTEM: Record<AnatomicalSystem, TissuePhysicsProfile> = {
  skeletal: {
    familyFa: "بافت استخوانی متراکم/اسفنجی",
    familyEn: "Cortical / Trabecular Bone",
    youngsModulus: "14 – 18 GPa (Cortical)",
    poissonsRatio: "0.30",
    density: "1,850 kg/m³",
    constitutiveModel: "Orthotropic Linear Elastic",
  },
  articular: {
    familyFa: "غضروف مفصلی و رباط کلاژنی",
    familyEn: "Hyaline Cartilage & Ligament",
    youngsModulus: "0.5 – 1.5 MPa (Cartilage) / 200 MPa (Ligament)",
    poissonsRatio: "0.45 – 0.49",
    density: "1,100 kg/m³",
    constitutiveModel: "Biphasic Poroelastic / Ogden",
  },
  muscular: {
    familyFa: "عضلهٔ اسکلتی فعال",
    familyEn: "Active Skeletal Muscle",
    youngsModulus: "10 – 50 kPa (Passive) / Active Hill Tension",
    poissonsRatio: "0.49 (Nearly Incompressible)",
    density: "1,060 kg/m³",
    constitutiveModel: "Hill-type Contraction + Mooney-Rivlin",
  },
  cardiovascular: {
    familyFa: "میوکارد و دیوارهٔ الاستیک عروقی",
    familyEn: "Myocardium & Elastic Arterial Wall",
    youngsModulus: "0.2 – 1.2 MPa (Aorta)",
    poissonsRatio: "0.49",
    density: "1,055 kg/m³",
    constitutiveModel: "Holzapfel-Gasser-Ogden (Anisotropic Hyperelastic)",
  },
  nervous: {
    familyFa: "پارانشیم عصبی / مننژ",
    familyEn: "Neural Parenchyma / Meninges",
    youngsModulus: "1.5 – 4.0 kPa (Brain) / 30 MPa (Dura)",
    poissonsRatio: "0.495",
    density: "1,040 kg/m³",
    constitutiveModel: "Viscoelastic Ogden",
  },
  respiratory: {
    familyFa: "پارانشیم اسفنجی ریه و تراشه",
    familyEn: "Pulmonary Parenchyma & Cartilaginous Airway",
    youngsModulus: "2 – 10 kPa (Lung)",
    poissonsRatio: "0.35 – 0.42",
    density: "300 – 450 kg/m³ (Inflated)",
    constitutiveModel: "Hyperelastic Compressible Foam",
  },
  digestive: {
    familyFa: "احشای توخالی و پارانشیم کبدی",
    familyEn: "GI Smooth Muscle & Hepatic Parenchyma",
    youngsModulus: "5 – 15 kPa (Liver)",
    poissonsRatio: "0.49",
    density: "1,050 kg/m³",
    constitutiveModel: "Neo-Hookean Viscoelastic",
  },
  renal: {
    familyFa: "پارانشیم کلیوی و کپسول",
    familyEn: "Renal Cortex & Fibrous Capsule",
    youngsModulus: "15 – 35 kPa",
    poissonsRatio: "0.49",
    density: "1,050 kg/m³",
    constitutiveModel: "Ogden Hyperelastic",
  },
  endocrine: {
    familyFa: "بافت غدی درون‌ریز",
    familyEn: "Endocrine Parenchyma",
    youngsModulus: "8 – 20 kPa",
    poissonsRatio: "0.49",
    density: "1,050 kg/m³",
    constitutiveModel: "Neo-Hookean",
  },
  reproductive: {
    familyFa: "بافت نرم تناسلی",
    familyEn: "Reproductive Soft Tissue",
    youngsModulus: "10 – 40 kPa",
    poissonsRatio: "0.49",
    density: "1,050 kg/m³",
    constitutiveModel: "Hyperelastic Soft Tissue",
  },
  lymphatic: {
    familyFa: "گره و مجرای لنفاوی",
    familyEn: "Lymphoid Node & Vessel",
    youngsModulus: "5 – 15 kPa",
    poissonsRatio: "0.49",
    density: "1,030 kg/m³",
    constitutiveModel: "Viscoelastic Soft Tissue",
  },
  integumentary: {
    familyFa: "پوست و بافت پوششی",
    familyEn: "Integumentary / Cutaneous Tissue",
    youngsModulus: "0.1 – 2.0 MPa (Anisotropic Langer Lines)",
    poissonsRatio: "0.48",
    density: "1,100 kg/m³",
    constitutiveModel: "Holzapfel Hyperelastic",
  },
  regional: {
    familyFa: "پوست و فاشیای سطحی",
    familyEn: "Dermis & Superficial Fascia",
    youngsModulus: "0.1 – 2.0 MPa (Anisotropic Langer Lines)",
    poissonsRatio: "0.48",
    density: "1,100 kg/m³",
    constitutiveModel: "Holzapfel Hyperelastic",
  },
};

export function getJointKinematicsProfile(organId: string): JointKinematicsProfile | undefined {
  return JOINT_KINEMATICS_CATALOG.find((j) => j.pattern.test(organId));
}

export function getTissuePhysicsProfile(system: AnatomicalSystem): TissuePhysicsProfile {
  return TISSUE_PHYSICS_BY_SYSTEM[system] ?? TISSUE_PHYSICS_BY_SYSTEM.regional;
}
