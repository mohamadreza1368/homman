"""Anatomical structures, manifests, and kinematic context descriptors."""

from __future__ import annotations

from pydantic import Field

from hoomaan_engine.protocol.types import AnatomicalSystem, Strict


class OrganMeta(Strict):
    """Full descriptor for an anatomical mesh from the manifest index."""

    organ_id: str = Field(min_length=1)
    ta2_latin: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    system: AnatomicalSystem

    def describe(self) -> str:
        return f"{self.organ_id} — {self.ta2_latin} ({self.name_en})"


class OrganContext(Strict):
    """Lightweight anatomical descriptor passed in chat context."""

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
