import type {
  AnatomicalSystem,
  AnatomyManifest,
  GenderModel,
  ManifestOrgan,
  SceneCommand,
  SectionPlane,
} from "@/lib/schemas";
import type { BackgroundMode } from "@/features/viewer/background";
import type { LightingPresetId } from "@/features/viewer/lighting";
import type { AnatomicalView } from "@/features/viewer/cameraViews";
import type { BodyTone } from "@/features/viewer/scan";
import type { SupplyKind } from "@/features/viewer/supply";
import type { ViewPreferences } from "./viewPreferences";

export interface PathologyOverlay {
  pathology: string;
  severity: number;
}

export interface CrossSection {
  plane: SectionPlane;
  position: number;
}

export const GHOST_STOPS = [1, 0.28, 0.12] as const;
export const XRAY_OPACITY = 0.16;
export const GLASS_OPACITY = 0.1;
export const GHOST_CLICK_THROUGH = 0.5;

export interface FocusRequest {
  organId: string;
  seq: number;
}

export interface ScanRequest {
  organId: string;
  seq: number;
  plane?: "axial" | "coronal";
}

export type ViewpointRequest =
  | { kind: "fit"; seq: number }
  | { kind: "orient"; view: AnatomicalView; seq: number }
  | { kind: "dolly"; factor: number; seq: number }
  | { kind: "scan"; seq: number };

export interface PathwayRequest {
  label: string;
  organIds: string[];
  stepSeconds: number;
  loop: boolean;
  seq: number;
}

export interface SceneViewState {
  selectedOrganIds: string[];
  hiddenOrganIds: string[];
  hiddenSystems: AnatomicalSystem[];
  systemOpacity: Partial<Record<AnatomicalSystem, number>>;
  isolatedOrganIds: string[] | null;
  pathologyOverlays: Record<string, PathologyOverlay>;
  caseMarks: Record<string, PathologyOverlay>;
  crossSection: CrossSection | null;
  focusRequest: FocusRequest | null;
  scanRequest: ScanRequest | null;
  viewpoint: ViewpointRequest | null;
  pathway: PathwayRequest | null;
  illuminated: string[];
  supplyRequest: { kind: SupplyKind; seq: number } | null;
  supplyResult: { kind: SupplyKind; added: number } | null;
  explode: number;
  bodyTone: BodyTone;
  halfDissection: "off" | "left" | "right";
  dissectionDepth: number;
  conductionSystemVisible: boolean;
  ecgLeadsVisible: boolean;
  clinicalProceduresVisible: boolean;
  liverSegmentsMode: boolean;
}

export const initialViewState: SceneViewState = {
  selectedOrganIds: [],
  hiddenOrganIds: [],
  hiddenSystems: [],
  systemOpacity: {},
  isolatedOrganIds: null,
  pathologyOverlays: {},
  caseMarks: {},
  crossSection: null,
  focusRequest: null,
  scanRequest: null,
  viewpoint: null,
  pathway: null,
  explode: 0,
  bodyTone: "solid",
  halfDissection: "off",
  dissectionDepth: 0,
  conductionSystemVisible: false,
  ecgLeadsVisible: false,
  clinicalProceduresVisible: false,
  liverSegmentsMode: false,
  supplyRequest: null,
  supplyResult: null,
  illuminated: [],
};

export type VisibilityState = Pick<
  SceneViewState,
  "hiddenSystems" | "isolatedOrganIds" | "hiddenOrganIds"
> & {
  hideConnective: boolean;
  connectiveIds: Set<string>;
  halfDissection?: "off" | "left" | "right";
  dissectionDepth?: number;
  liverSegmentsMode?: boolean;
};

export interface SceneStore extends SceneViewState {
  genderModel: GenderModel;
  manifest: AnatomyManifest | null;
  organs: Record<string, ManifestOrgan>;
  hoveredOrganId: string | null;
  eyeTracking: boolean;
  labelsVisible: boolean;
  hideConnective: boolean;
  connectiveIds: Set<string>;
  background: BackgroundMode;
  lightingPreset: LightingPresetId;
  depthProbeVisible: boolean;
  depthStack: string[];
  pinnedStack: string[] | null;
  focusBadge: { organId: string; index: number } | null;
  selectionHitPoints?: Record<string, { x: number; y: number; z: number }>;

  setManifest: (manifest: AnatomyManifest) => void;
  setGenderModel: (gender: GenderModel) => void;
  setHovered: (organId: string | null) => void;
  setDepthStack: (organIds: string[]) => void;
  clearDepthStack: () => void;
  pinDepthStack: () => void;
  unpinDepthStack: () => void;
  selectFromViewport: (
    organId: string | null,
    additive?: boolean,
    hitPoint?: { x: number; y: number; z: number },
  ) => void;
  dismissDepthStack: () => void;
  setEyeTracking: (enabled: boolean) => void;
  setDepthProbeVisible: (visible: boolean) => void;
  setLabelsVisible: (visible: boolean) => void;
  setHideConnective: (hidden: boolean) => void;
  cycleBodyTone: () => void;
  setBackground: (mode: BackgroundMode) => void;
  setLightingPreset: (preset: LightingPresetId) => void;
  restoreView: (preferences: Partial<ViewPreferences>) => void;
  selectOrgan: (
    organId: string | null,
    additive?: boolean,
    hitPoint?: { x: number; y: number; z: number },
  ) => void;
  selectMany: (organIds: string[]) => void;
  addToSelection: (organIds: string[]) => void;
  clearSelection: () => void;
  setCaseMarks: (marks: Record<string, PathologyOverlay>) => void;
  isolateSelection: () => void;
  hideSelection: () => void;
  unhideAll: () => void;
  applyCommand: (command: SceneCommand) => void;
  focusReference: (organId: string, index: number) => void;
  toggleSystem: (system: AnatomicalSystem) => void;
  soloSystem: (system: AnatomicalSystem) => void;
  cycleSystemOpacity: (system: AnatomicalSystem) => void;
  xraySystem: (system: AnatomicalSystem) => void;
  clearGhosting: () => void;
  glassBody: () => void;
  fitView: () => void;
  orientView: (view: AnatomicalView) => void;
  scanView: () => void;
  dollyView: (factor: number) => void;
  setExplode: (factor: number) => void;
  cycleExplode: () => void;
  setHalfDissection: (mode: "off" | "left" | "right") => void;
  cycleHalfDissection: () => void;
  setDissectionDepth: (depth: number) => void;
  cycleDissectionDepth: () => void;
  isolatePedicle: (organId: string) => void;
  isolateSurgicalSpace: (spaceId: string) => void;
  toggleConductionSystem: () => void;
  toggleEcgLeads: () => void;
  toggleClinicalProcedures: () => void;
  toggleLiverSegmentsMode: () => void;
  showAllSystems: () => void;
  clearPathway: () => void;
  clearIsolation: () => void;
  dropFromIsolation: (organId: string) => void;
  requestSupply: (kind: SupplyKind) => void;
  resolveSupply: (organIds: string[]) => void;
  cancelSupply: () => void;
  studyOrgan: (organId: string, additive?: boolean) => void;
  studyRegion: (organId: string) => void;
  studyGroup: (node: string) => void;
  resetView: () => void;
}
