# Releasing HOOMAAN

This document outlines the standard verification and release workflow for HOOMAAN builds.

## 1. Quality Gates & Verification
Before cutting any release tag, run all automated checks:

```bash
# TypeScript compilation & verification
pnpm typecheck

# Full Vitest suite
pnpm test

# Python engine tests & linting
cd engine && python -m pytest -q && python -m ruff check .

# Desktop Tauri verification
cd src-tauri && cargo test
```

Ensure the working tree is clean:
```bash
git status --short
```

## 2. Version Tagging
HOOMAAN follows Semantic Versioning (`MAJOR.MINOR.PATCH`).
Update the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `engine/pyproject.toml`.

Tag the commit:
```bash
git tag v0.7.0
git push origin v0.7.0
```

## 3. GitHub Actions Build
The automated release pipeline triggers on tag pushes (`v*`), compiles multi-platform bundles (Windows MSI/NSIS, Linux DEB/AppImage, macOS DMG), and publishes the release assets.
