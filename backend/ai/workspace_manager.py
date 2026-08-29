import logging
import os
import shutil
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Base workspace directory in repository root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_WORKSPACE_ROOT = PROJECT_ROOT / "workspace"

ALLOWED_SUBDIRS = ["documents", "input", "projects", "output", "sandbox"]


class WorkspaceSecurityError(Exception):
    """Raised when a path traversal attempt is detected."""
    pass


class WorkspaceManager:
    """
    Manages the controlled local filesystem workspace for Sovereign AI Workbench.
    All operations are strictly bounded within the workspace root.
    """

    def __init__(self, workspace_root: Optional[Path] = None):
        self.root = (workspace_root or DEFAULT_WORKSPACE_ROOT).resolve()
        self._ensure_structure()
        self._seed_sample_documents()

    def _ensure_structure(self) -> None:
        """Create standard workspace directories if they do not exist."""
        self.root.mkdir(parents=True, exist_ok=True)
        for subdir in ALLOWED_SUBDIRS:
            (self.root / subdir).mkdir(parents=True, exist_ok=True)

    def _seed_sample_documents(self) -> None:
        """Seed verified sample documents for immediate SIH demonstration."""
        sample_source = PROJECT_ROOT / "data" / "test_documents" / "ocr_scanned.pdf"
        target_doc = self.root / "documents" / "inspection_report.pdf"
        
        if sample_source.exists() and not target_doc.exists():
            try:
                shutil.copy2(sample_source, target_doc)
                logger.info(f"Seeded sample inspection report to {target_doc}")
            except Exception as e:
                logger.warning(f"Could not seed sample document: {e}")

        # Seed sample project file
        sample_project = self.root / "projects" / "darcy_weisbach_spec.md"
        if not sample_project.exists():
            try:
                sample_project.write_text(
                    "# Darcy-Weisbach Pressure Drop Specification\n\n"
                    "Calculate pressure drop in a 0.2m pipe over 100m with velocity 2.5 m/s, "
                    "friction factor f = 0.02, and fluid density rho = 1000 kg/m^3.\n"
                    "Equation: delta_P = f * (L / D) * (rho * v^2 / 2)\n",
                    encoding="utf-8"
                )
            except Exception as e:
                logger.warning(f"Could not seed sample project: {e}")

    def resolve_safe_path(self, relative_path: str) -> Path:
        """
        Safely resolve a path relative to the workspace root.
        Prevents directory traversal attacks (e.g., '../../etc/passwd').
        """
        if not relative_path or not relative_path.strip():
            return self.root

        # Clean string
        clean_rel = relative_path.strip().lstrip("/\\")
        resolved = (self.root / clean_rel).resolve()

        # Enforce boundary check
        try:
            resolved.relative_to(self.root)
        except ValueError:
            raise WorkspaceSecurityError(
                f"Access denied: Path '{relative_path}' resolves outside the controlled workspace root."
            )

        return resolved

    def get_tree(self) -> dict[str, Any]:
        """
        Return the complete recursive folder tree of the controlled workspace.
        """
        self._ensure_structure()
        
        def scan_dir(dir_path: Path) -> list[dict[str, Any]]:
            items = []
            try:
                for entry in sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                    rel = str(entry.relative_to(self.root))
                    if entry.is_dir():
                        items.append({
                            "name": entry.name,
                            "path": rel,
                            "is_dir": True,
                            "children": scan_dir(entry),
                        })
                    else:
                        stat = entry.stat()
                        items.append({
                            "name": entry.name,
                            "path": rel,
                            "is_dir": False,
                            "size_bytes": stat.st_size,
                            "size_formatted": f"{stat.st_size / 1024:.1f} KB" if stat.st_size >= 1024 else f"{stat.st_size} B",
                            "extension": entry.suffix.lower().lstrip("."),
                            "modified": int(stat.st_mtime),
                        })
            except Exception as exc:
                logger.error(f"Error scanning directory {dir_path}: {exc}")
            return items

        return {
            "root": str(self.root),
            "directories": scan_dir(self.root),
        }

    def save_file(self, subdir: str, filename: str, content: bytes) -> Path:
        """
        Save binary or text content safely into a specified workspace subdirectory.
        """
        if subdir not in ALLOWED_SUBDIRS and not any(subdir.startswith(s + "/") for s in ALLOWED_SUBDIRS):
            subdir = "input"

        safe_filename = "".join(c for c in filename if c.isalnum() or c in (".", "_", "-", " ")).strip()
        if not safe_filename:
            safe_filename = "uploaded_file.bin"

        target_dir = self.resolve_safe_path(subdir)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / safe_filename
        
        # Enforce check
        self.resolve_safe_path(f"{subdir}/{safe_filename}")
        
        target_file.write_bytes(content)
        return target_file

    def read_file(self, relative_path: str) -> bytes:
        """
        Read binary content of a file within the workspace.
        """
        safe_path = self.resolve_safe_path(relative_path)
        if not safe_path.exists() or not safe_path.is_file():
            raise FileNotFoundError(f"File '{relative_path}' does not exist in workspace.")
        return safe_path.read_bytes()

    def delete_file(self, relative_path: str) -> bool:
        """
        Delete a file or empty directory safely within the workspace.
        """
        safe_path = self.resolve_safe_path(relative_path)
        if safe_path == self.root:
            raise WorkspaceSecurityError("Cannot delete workspace root.")
        
        # Prevent deletion of primary top-level subdirectories
        if safe_path in [self.root / s for s in ALLOWED_SUBDIRS]:
            raise WorkspaceSecurityError(f"Cannot delete top-level directory '{safe_path.name}'.")

        if safe_path.exists():
            if safe_path.is_dir():
                shutil.rmtree(safe_path)
            else:
                safe_path.unlink()
            return True
        return False

    def create_task_sandbox_dir(self, task_id: str) -> Path:
        """
        Create an isolated task execution folder under workspace/sandbox/task_<id>/.
        """
        clean_task_id = "".join(c for c in task_id if c.isalnum() or c in ("_", "-")).strip() or "default"
        sandbox_dir = self.root / "sandbox" / f"task_{clean_task_id}"
        sandbox_dir.mkdir(parents=True, exist_ok=True)
        return sandbox_dir


# Global workspace manager singleton
workspace_manager = WorkspaceManager()
