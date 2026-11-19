"""Automated packaging script for bundling the HOOMAAN AI engine via PyInstaller.

Constructs an isolated, self-contained directory (`--onedir`) distribution at
`engine/dist/hoomaan-engine/` containing the executable runtime and shared libraries.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import shutil
import subprocess
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent
APP_NAME = "hoomaan-engine"

COLLECT_ALL = [
    "pydantic",
    "pydantic_ai",
    "anthropic",
    "openai",
    "google.genai",
]

HIDDEN_IMPORTS = [
    "anyio._backends._asyncio",
]

COPY_METADATA = [
    "pydantic-ai-slim",
    "genai-prices",
    "anthropic",
    "openai",
    "google-genai",
    "httpx",
]


def venv_root() -> Path:
    """Returns the expected repository-level virtual environment path."""
    return ENGINE_DIR.parent / ".venv"


def _venv_python() -> Path | None:
    """Discovers the Python interpreter within the root virtual environment."""
    for binary in (
        venv_root() / "Scripts" / "python.exe",
        venv_root() / "bin" / "python",
    ):
        if binary.is_file():
            return binary
    return None


def running_in_repo_venv(prefix: str = sys.prefix) -> bool:
    """Determines if the active execution environment matches the repository virtualenv."""
    try:
        return Path(prefix).resolve() == venv_root().resolve()
    except OSError:
        return True


def missing_requirements() -> list[str]:
    """Identifies prerequisite packages or metadata distributions missing from the environment."""
    missing: list[str] = [] if _module_available("PyInstaller") else ["PyInstaller"]
    for dist_name in COPY_METADATA:
        try:
            importlib.metadata.distribution(dist_name)
        except importlib.metadata.PackageNotFoundError:
            missing.append(dist_name)
    return missing


def build(clean: bool) -> int:
    unmet = missing_requirements()
    if unmet:
        alt_python = _venv_python()
        if alt_python is not None and not running_in_repo_venv():
            print(f"{sys.executable} missing dependencies ({', '.join(unmet)}); re-running with {alt_python}")
            return subprocess.run([str(alt_python), __file__, *sys.argv[1:]], check=False).returncode
        print(
            f"Environment missing required build distributions: {', '.join(unmet)}\n"
            "  python -m venv .venv\n"
            "  .venv/Scripts/python -m pip install -e 'engine[dev]'   # Windows\n"
            "  .venv/bin/python -m pip install -e 'engine[dev]'       # POSIX",
            file=sys.stderr,
        )
        return 1

    dist_dir = ENGINE_DIR / "dist"
    work_dir = ENGINE_DIR / "build"
    if clean:
        shutil.rmtree(dist_dir, ignore_errors=True)
        shutil.rmtree(work_dir, ignore_errors=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--console",
        f"--name={APP_NAME}",
        f"--distpath={dist_dir}",
        f"--workpath={work_dir}",
        f"--specpath={ENGINE_DIR}",
        f"--paths={ENGINE_DIR}",
    ]
    for pkg in COLLECT_ALL:
        cmd.append(f"--collect-all={pkg}")
    for mod in HIDDEN_IMPORTS:
        cmd.append(f"--hidden-import={mod}")
    for meta in COPY_METADATA:
        cmd.append(f"--copy-metadata={meta}")
    cmd.append(str(ENGINE_DIR / "entrypoint.py"))

    print("Executing:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=ENGINE_DIR, check=False)
    if res.returncode != 0:
        return res.returncode

    built_exe = dist_dir / APP_NAME / (f"{APP_NAME}.exe" if sys.platform == "win32" else APP_NAME)
    if not built_exe.is_file():
        print(f"Build completed but binary not found at: {built_exe}", file=sys.stderr)
        return 1

    print(f"\nSidecar compiled successfully: {built_exe}")
    return 0


def _module_available(module_name: str) -> bool:
    import importlib.util

    return importlib.util.find_spec(module_name) is not None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--clean",
        action="store_true",
        help="clear previous build artifacts before packaging",
    )
    args = parser.parse_args()
    return build(clean=args.clean)


if __name__ == "__main__":
    sys.exit(main())
