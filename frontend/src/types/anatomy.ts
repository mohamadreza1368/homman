export interface AnatomicalStructure {
  fmaId: string;
  snomedBodyStructureId: string;
  nameEn: string;
  nameFa: string;
  systemCategory: 'Skeletal' | 'Muscular' | 'Circulatory' | 'Respiratory' | 'Digestive' | 'Nervous' | 'Urinary' | 'Integumentary' | 'Endocrine' | 'Lymphatic';
  genderModel: 'male' | 'female' | 'both';
  meshNodeName: string;
  descriptionEn?: string;
  descriptionFa?: string;
}

export interface PathologyDisorder {
  snomedDisorderId: string;
  icd10Code?: string;
  icdoTopographyCode?: string;
  fsnEn: string;
  preferredTermFa: string;
  clinicalDepartment: string;
  etiologyCategory: string;
  findingSiteSnomedId: string;
  associatedMorphologyId?: string;
  pathologicalProcessId?: string;
  clinicalCourse?: string;
  visualPresetType: 'pbr_inflammation' | 'pbr_ischemia' | 'morph_atrophy' | 'procedural_mass' | 'rig_fracture';
  descriptionFa?: string;
}
