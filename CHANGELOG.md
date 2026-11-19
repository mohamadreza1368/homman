# Changelog

All notable changes to the HOOMAAN project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] — 2026-11-19

### Added
- **Modern Floating Studio HUD & Workspace:** Full-bleed 3D viewport with glassmorphic drawers and collapsible sidebars.
- **Unified Action Dock (`StudioActionDock`):** Grouped tools for anatomical navigation (Views), structure dissection (Dissect), dynamic physiology (Physio), and rendering environment (Studio).
- **Advanced Tomography & Radiology Suite:** Windowing presets in `AxialView` (Natural, Soft Tissue, Bone, Lung, Invert) with crosshairs and depth navigation.
- **Clinical Vitals HUD & Interactive Chat Markers:** Real-time physiological monitor with pulsing heart rate LED, and interactive chat pills (`RhythmPin` and `SlicePin`) for direct model interaction from assistant responses.
- **PBR Tissue Shading & Studio Lighting Presets:** Histologically tuned roughness/metalness parameters across all organ systems and 3 selectable lighting presets (Studio Anatomy, Surgical Theater, High Contrast Radiology).
- **Direct Custom API Integration:** Support for OpenAI-compatible LLM endpoints, local models (Ollama, LM Studio), and cloud inference without external lock-in.
- **Bilingual Interface & Guide:** Full Persian and English localization across UI, controls, and help overlays.
- **Clinical Pathology & Disease Library:** MONDO disease search, disease definition view, and anatomical site mapping.

## [0.6.0] — 2026-10-15

### Added
- Heart animation and physiological rhythms (resting, bradycardia, tachycardia).
- Respiratory cycle animation with thoracic cage expansion.
- Cross-sectional axial slicing with interactive plane controls.
- Local journal and study note management with SQLite backend.
