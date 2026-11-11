export type ContentStatus = 'reference' | 'educational_visualization' | 'draft';

export type AnatomySystem =
  | 'skeletal'
  | 'muscular'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'lymphatic'
  | 'integumentary'
  | 'endocrine'
  | 'reproductive';

export type VisualPresetType =
  | 'pbr_inflammation'
  | 'pbr_ischemia'
  | 'morph_atrophy'
  | 'procedural_mass'
  | 'rig_fracture';

export interface AnatomyRecord {
  id: string;
  fmaId: string | null;
  snomedBodyStructureId: string | null;
  meshNames: string[];
  zAnatomyNames?: string[];
  nameEn: string;
  nameFa: string;
  system: AnatomySystem;
  bbox?: number[];
  descriptionEn?: string;
  descriptionFa?: string;
  source: string;
  sourceVersion?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  contentStatus: ContentStatus;
}

export interface AnatomyCatalogBundle {
  schemaVersion: string;
  generatedAt: string;
  terminologyNotice: string;
  reviewedBy: string;
  reviewedAt: string;
  records: AnatomyRecord[];
}

export interface AnatomicalStructure {
  recordId: string;
  fmaId: string;
  snomedBodyStructureId: string;
  nameEn: string;
  nameFa: string;
  systemCategory:
    | 'Skeletal'
    | 'Muscular'
    | 'Circulatory'
    | 'Respiratory'
    | 'Digestive'
    | 'Nervous'
    | 'Urinary'
    | 'Integumentary'
    | 'Endocrine'
    | 'Lymphatic';
  genderModel: 'male' | 'female' | 'both';
  meshNodeName: string;
  descriptionEn?: string;
  descriptionFa?: string;
  isMappedToCatalog: boolean;
  contentStatus: ContentStatus;
  source?: string;
  sourceVersion?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PathologyDisorder {
  snomedDisorderId: string;
  icd10Code?: string | null;
  icdoTopographyCode?: string | null;
  orphanCode?: string | null;
  fsnEn: string;
  preferredTermFa: string;
  clinicalDepartment: string;
  etiologyCategory: string;
  findingSiteSnomedId?: string;
  associatedMorphologyId?: string | null;
  pathologicalProcessId?: string | null;
  clinicalCourse?: string | null;
  visualPresetType: VisualPresetType;
  descriptionEn?: string;
  descriptionFa?: string;
  source: string;
  sourceVersion: string;
  reviewedBy: string;
  reviewedAt: string;
  contentStatus: ContentStatus;
  licenseRestriction?: string;
}

export interface KnowledgeGraphOrgan {
  recordId: string;
  fmaId: string;
  nameEn: string;
  nameFa: string;
  snomedRootId: string;
  source: string;
  sourceVersion: string;
  reviewedBy: string;
  reviewedAt: string;
  contentStatus: ContentStatus;
  licenseRestriction?: string;
  disorders: PathologyDisorder[];
}

export interface KnowledgeGraphBundle {
  schemaVersion: string;
  generatedAt: string;
  terminologyNotice: string;
  organs: Record<string, KnowledgeGraphOrgan>;
}

export type AnatomyViewMode = 'standard' | 'beating_heart' | 'neuroanatomy';

export interface ClippingState {
  axial: boolean;
  axialOffset: number;
  sagittal: boolean;
  sagittalOffset: number;
  coronal: boolean;
  coronalOffset: number;
}

export interface HeartAnimationConfig {
  isBeating: boolean;
  bpm: number;
}

export interface NeuroConfig {
  showCorticalLobes: boolean;
  activeLobe?: 'frontal' | 'parietal' | 'temporal' | 'occipital';
}

export interface RenderPerformanceSnapshot {
  backend: 'BodyParts3D' | 'Z-Anatomy';
  chunksLoaded: number;
  totalBytes: number;
  downloadMs: number;
  parseMs: number;
  meshCount: number;
  drawCalls: number;
  triangles: number;
  liteMode: boolean;
}
