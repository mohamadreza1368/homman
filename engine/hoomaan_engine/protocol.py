"""Pydantic model definitions for Hoomaan inter-process communication protocol.

Bidirectional specification mirroring `src/lib/schemas.ts`. Validated dynamically
via `tests/protocol-contract.test.ts` to prevent structural schema drift.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

PROTOCOL_VERSION = 2
ENGINE_VERSION = "0.1.0"

Language = Literal["auto", "fa", "en", "bg", "es"]
UserProfile = Literal["layperson", "student", "clinician"]
GenderModel = Literal["male", "female"]
AiProvider = Literal["anthropic", "openai", "google"]
SectionPlane = Literal["axial", "coronal", "sagittal"]
ScannerPlane = Literal["axial", "coronal"]

HeartRhythmId = Literal[
    "normal",
    "sinus_tachycardia",
    "sinus_bradycardia",
    "av_block_1",
    "mobitz_1",
    "mobitz_2",
    "av_block_3",
    "atrial_fibrillation",
    "atrial_flutter",
    "premature_ventricular",
    "ventricular_tachycardia",
    "ventricular_fibrillation",
    "asystole",
    "aortic_stenosis",
    "mitral_regurgitation",
    "aortic_regurgitation",
    "mitral_stenosis",
    "third_heart_sound",
    "fourth_heart_sound",
]

SessionMode = Literal["tutor", "case", "review"]

AnatomicalSystem = Literal[
    "cardiovascular",
    "respiratory",
    "renal",
    "digestive",
    "nervous",
    "endocrine",
    "lymphatic",
    "skeletal",
    "muscular",
    "articular",
    "reproductive",
    "integumentary",
    "regional",
]

EngineErrorCode = Literal[
    "missing_api_key",
    "invalid_api_key",
    "provider_error",
    "rate_limited",
    "service_unavailable",
    "guardrail_triggered",
    "invalid_request",
    "internal_error",
]


class Strict(BaseModel):
    """Base model enforcing strict schema boundaries by forbidding unknown properties."""

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Anatomical Metadata Schemas
# ---------------------------------------------------------------------------


class OrganMeta(Strict):
    """Full metadata for a single structure loaded from the atlas manifest."""

    organ_id: str = Field(min_length=1)
    ta2_latin: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    system: AnatomicalSystem

    def describe(self) -> str:
        return f"{self.organ_id} — {self.ta2_latin} ({self.name_en})"


class OrganContext(Strict):
    """Abbreviated anatomical descriptor passed in prompt contexts."""

    organ_id: str = Field(min_length=1)
    ta2_latin: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    system: AnatomicalSystem

    def describe(self) -> str:
        return f"{self.ta2_latin} ({self.name_en})"


class ScannerContext(Strict):
    """Contextual plane location when active without an explicit user selection."""

    level: str | None = Field(default=None, min_length=1, max_length=40)
    crossing: list[OrganContext] = Field(default_factory=list, max_length=12)
    total: int = Field(default=0, ge=0)


class HeartContext(Strict):
    """Active cardiovascular kinematics and acoustic state during tutor sessions."""

    rhythm: str = Field(min_length=1, max_length=60)
    rate: str = Field(min_length=1, max_length=40)
    pattern: str = Field(min_length=1, max_length=400)
    sound: bool = False


class BreathContext(Strict):
    """Active respiratory cycle and chest dynamics during tutor sessions."""

    pattern: str = Field(min_length=1, max_length=60)
    rate: str = Field(min_length=1, max_length=40)
    what: str = Field(min_length=1, max_length=400)
    heart: str | None = Field(default=None, min_length=1, max_length=400)


class CaseComplaint(Strict):
    """User-annotated clinical symptom localized on a structure."""

    organ_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    symptom: str = Field(min_length=1, max_length=200)
    severity: int | None = Field(default=None, ge=0, le=10)


class CaseVisitSummary(Strict):
    """Evaluation record summary of a previous patient visit."""

    visit_no: int = Field(ge=1)
    score: int | None = Field(default=None, ge=0, le=100)
    verdict: str | None = Field(default=None, max_length=4000)


class CaseRecordUpdate(Strict):
    """Interval clinical update added to the longitudinal patient record."""

    visit_no: int = Field(ge=1)
    body: str = Field(min_length=1, max_length=20_000)


class VirtualPatient(Strict):
    """Synthetic clinical patient profile for simulated diagnostics."""

    title: str = Field(min_length=1, max_length=200)
    sex: Literal["male", "female"]
    age_years: int | None = Field(default=None, ge=0, le=130)
    height_cm: int | None = Field(default=None, ge=30, le=260)
    weight_kg: float | None = Field(default=None, gt=0, le=400)
    findings: str = Field(default="", max_length=20_000)
    record_updates: list[CaseRecordUpdate] = Field(default_factory=list, max_length=200)
    ground_truth: str = Field(default="", max_length=20_000)
    visit_no: int = Field(ge=1)
    complaints: list[CaseComplaint] = Field(default_factory=list, max_length=200)
    earlier_visits: list[CaseVisitSummary] = Field(default_factory=list, max_length=20)


# ---------------------------------------------------------------------------
# Viewport Actions / Scene Commands
# ---------------------------------------------------------------------------


class FocusOrgan(Strict):
    action: Literal["focus_organ"] = "focus_organ"
    organ_id: str = Field(min_length=1)


class SetLayerVisibility(Strict):
    action: Literal["set_layer_visibility"] = "set_layer_visibility"
    system: AnatomicalSystem
    visible: bool


class SetLayerOpacity(Strict):
    action: Literal["set_layer_opacity"] = "set_layer_opacity"
    system: AnatomicalSystem
    opacity: float = Field(ge=0.0, le=1.0)


class IsolateStructures(Strict):
    action: Literal["isolate_structures"] = "isolate_structures"
    organ_ids: list[str] = Field(min_length=1, max_length=64)


class ApplyPathologyOverlay(Strict):
    action: Literal["apply_pathology_overlay"] = "apply_pathology_overlay"
    organ_id: str = Field(min_length=1)
    pathology: str = Field(min_length=1, max_length=120)
    severity: float = Field(ge=0.0, le=1.0)


class IsolateRegion(Strict):
    action: Literal["isolate_region"] = "isolate_region"
    organ_id: str = Field(min_length=1)


class IsolateGroup(Strict):
    action: Literal["isolate_group"] = "isolate_group"
    group: str = Field(min_length=1)


class AddSupply(Strict):
    action: Literal["add_supply"] = "add_supply"
    kind: Literal["vascular", "neural"]


class ClearPathologyOverlays(Strict):
    action: Literal["clear_pathology_overlays"] = "clear_pathology_overlays"


class HighlightPathway(Strict):
    action: Literal["highlight_pathway"] = "highlight_pathway"
    label: str = Field(min_length=1, max_length=120)
    organ_ids: list[str] = Field(min_length=2, max_length=24)
    step_seconds: float = Field(ge=0.2, le=10.0)
    loop: bool


class ClearPathway(Strict):
    action: Literal["clear_pathway"] = "clear_pathway"


class IlluminateStructures(Strict):
    action: Literal["illuminate_structures"] = "illuminate_structures"
    organ_ids: list[str] = Field(max_length=24)


class SetCrossSection(Strict):
    action: Literal["set_cross_section"] = "set_cross_section"
    plane: SectionPlane
    position: float = Field(ge=-1.0, le=1.0)


class ScanAtStructure(Strict):
    action: Literal["scan_at_structure"] = "scan_at_structure"
    organ_id: str = Field(min_length=1)
    plane: ScannerPlane | None = None


class SetHeartRhythm(Strict):
    action: Literal["set_heart_rhythm"] = "set_heart_rhythm"
    rhythm: HeartRhythmId
    sound: bool | None = None


class ResetView(Strict):
    action: Literal["reset_view"] = "reset_view"


BridgeText = Annotated[str, Field(max_length=4000)]


class Say(Strict):
    action: Literal["say"] = "say"
    text: BridgeText


SceneCommand = Annotated[
    FocusOrgan
    | SetLayerVisibility
    | SetLayerOpacity
    | IsolateStructures
    | IsolateRegion
    | IsolateGroup
    | AddSupply
    | ApplyPathologyOverlay
    | ClearPathologyOverlays
    | HighlightPathway
    | ClearPathway
    | IlluminateStructures
    | SetCrossSection
    | ScanAtStructure
    | SetHeartRhythm
    | ResetView
    | Say,
    Field(discriminator="action"),
]


# ---------------------------------------------------------------------------
# Inbound Requests: Rust -> Sidecar Engine (stdin)
# ---------------------------------------------------------------------------


class TranscriptTurn(Strict):
    role: Literal["user", "assistant"]
    content: str


class AgentRequest(Strict):
    kind: Literal["agent_request"] = "agent_request"
    request_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=8000)
    history: list[TranscriptTurn] = Field(max_length=100)
    provider: AiProvider
    model: str | None = None
    profile: UserProfile
    language: Language
    gender_model: GenderModel
    mode: SessionMode
    selection: list[OrganContext] = Field(max_length=64)
    available_organs: list[OrganMeta]
    available_groups: list[str] = Field(default_factory=list, max_length=400)
    case: VirtualPatient | None = None
    scanner: ScannerContext | None = None
    heart: HeartContext | None = None
    breathing: BreathContext | None = None
    api_key: str = Field(min_length=1, repr=False)


class ListModelsRequest(Strict):
    kind: Literal["list_models"] = "list_models"
    request_id: str = Field(min_length=1)
    provider: AiProvider
    api_key: str = Field(min_length=1, repr=False)


LOCAL_MODEL_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,199}$"


def _validate_local_tag(val: str) -> str:
    if "://" in val or ".." in val:
        raise ValueError("Invalid Ollama model name")
    return val


LocalModelName = Annotated[
    str, Field(pattern=LOCAL_MODEL_PATTERN), AfterValidator(_validate_local_tag)
]


class LocalChatRequest(Strict):
    kind: Literal["local_chat_request"] = "local_chat_request"
    request_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=8000)
    history: list[TranscriptTurn] = Field(default_factory=list, max_length=100)
    model: LocalModelName
    profile: UserProfile
    gender_model: GenderModel = "male"
    selection: list[OrganContext] = Field(default_factory=list, max_length=64)


class LocalModelsRequest(Strict):
    kind: Literal["local_models_request"] = "local_models_request"
    request_id: str = Field(min_length=1)


class CancelRequest(Strict):
    kind: Literal["cancel"] = "cancel"
    request_id: str = Field(min_length=1)


class ShutdownRequest(Strict):
    kind: Literal["shutdown"] = "shutdown"


EngineRequest = Annotated[
    AgentRequest
    | ListModelsRequest
    | LocalChatRequest
    | LocalModelsRequest
    | CancelRequest
    | ShutdownRequest,
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# Outbound Events: Sidecar Engine -> Rust (stdout)
# ---------------------------------------------------------------------------


class TokenUsage(Strict):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cache_read_tokens: int = Field(default=0, ge=0)


class ReadyEvent(Strict):
    type: Literal["ready"] = "ready"
    protocol_version: int
    engine_version: str

    @staticmethod
    def current() -> ReadyEvent:
        return ReadyEvent(
            protocol_version=PROTOCOL_VERSION, engine_version=ENGINE_VERSION
        )


class TextDeltaEvent(Strict):
    type: Literal["text_delta"] = "text_delta"
    request_id: str
    text: str


class ToolStartedEvent(Strict):
    type: Literal["tool_started"] = "tool_started"
    request_id: str
    tool: str


class SceneCommandEvent(Strict):
    type: Literal["scene_command"] = "scene_command"
    request_id: str
    command: SceneCommand


class ModelInfo(Strict):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str | None = None
    recommended: bool = False


class ModelsEvent(Strict):
    type: Literal["models"] = "models"
    request_id: str
    provider: AiProvider
    models: list[ModelInfo]


class LocalModelInfo(Strict):
    name: LocalModelName
    parameter_size: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class LocalModelsEvent(Strict):
    type: Literal["local_models"] = "local_models"
    request_id: str
    running: bool
    models: list[LocalModelInfo]


class CaseVerdictEvent(Strict):
    type: Literal["case_verdict"] = "case_verdict"
    request_id: str
    score: int = Field(ge=0, le=100)
    verdict: str = Field(min_length=1, max_length=4000)


class DoneEvent(Strict):
    type: Literal["done"] = "done"
    request_id: str
    usage: TokenUsage | None
    model: str | None = None


class ErrorEvent(Strict):
    type: Literal["error"] = "error"
    request_id: str | None
    code: EngineErrorCode
    message: str


EngineEvent = Annotated[
    ReadyEvent
    | TextDeltaEvent
    | ToolStartedEvent
    | SceneCommandEvent
    | ModelsEvent
    | LocalModelsEvent
    | CaseVerdictEvent
    | DoneEvent
    | ErrorEvent,
    Field(discriminator="type"),
]
