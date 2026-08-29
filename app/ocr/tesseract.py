from pathlib import Path
import subprocess
import logging

logger = logging.getLogger(__name__)

_rapidocr_engine = None


def ocr_image(
    path: Path,
    language: str = "eng",
) -> str:
    """Extract text from an image using Tesseract or onnx OCR fallback."""

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")

    # Try tesseract binary if installed on system
    try:
        result = subprocess.run(
            [
                "tesseract",
                str(path),
                "stdout",
                "-l",
                language,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    # Pure offline fallback via rapidocr-onnxruntime
    try:
        global _rapidocr_engine
        if _rapidocr_engine is None:
            from rapidocr_onnxruntime import RapidOCR
            _rapidocr_engine = RapidOCR()

        result, _ = _rapidocr_engine(str(path))
        if result:
            return "\n".join([line[1] for line in result]).strip()
    except Exception as exc:
        logger.warning(f"Fallback OCR failed: {exc}")

    return ""

