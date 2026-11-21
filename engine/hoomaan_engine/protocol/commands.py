"""Viewport actions and 3D scene command models dispatched to the client."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from hoomaan_engine.protocol.types import (
    AnatomicalSystem,
    HeartRhythmId,
    ScannerPlane,
    SectionPlane,
    Strict,
)


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
