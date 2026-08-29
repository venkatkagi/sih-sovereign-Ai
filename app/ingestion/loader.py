from dataclasses import dataclass
from pathlib import Path

from docx import Document
from odf import text as odf_text
from odf.opendocument import load as load_odt
from pypdf import PdfReader
import pymupdf

from app.ocr.tesseract import ocr_image


@dataclass
class DocumentPage:
    text: str
    page: int
    ocr_used: bool = False


def load_pdf_pages(path: Path) -> list[DocumentPage]:
    """Extract PDF text page-by-page with OCR fallback."""

    reader = PdfReader(str(path))
    pages: list[DocumentPage] = []

    # Open once and reuse for scanned pages.
    pdf_document = pymupdf.open(str(path))

    try:
        for page_number, page in enumerate(
            reader.pages,
            start=1,
        ):
            text = (page.extract_text() or "").strip()

            if text:
                pages.append(
                    DocumentPage(
                        text=text,
                        page=page_number,
                        ocr_used=False,
                    )
                )
                continue

            # OCR fallback for scanned/image-only pages.
            pdf_page = pdf_document[page_number - 1]

            pixmap = pdf_page.get_pixmap(
                matrix=pymupdf.Matrix(2, 2),
                alpha=False,
            )

            image_path = (
                Path("/tmp")
                / f"sovereign_rag_ocr_{page_number}.png"
            )

            pixmap.save(str(image_path))

            try:
                ocr_text = ocr_image(image_path)
            finally:
                image_path.unlink(
                    missing_ok=True,
                )

            if ocr_text:
                pages.append(
                    DocumentPage(
                        text=ocr_text,
                        page=page_number,
                        ocr_used=True,
                    )
                )

    finally:
        pdf_document.close()

    return pages


def load_docx_pages(path: Path) -> list[DocumentPage]:
    """Extract DOCX content."""

    document = Document(str(path))

    paragraphs = [
        paragraph.text.strip()
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]

    text = "\n".join(paragraphs)

    if not text:
        return []

    return [
        DocumentPage(
            text=text,
            page=1,
            ocr_used=False,
        )
    ]


def load_odt_pages(path: Path) -> list[DocumentPage]:
    """Extract ODT text content."""

    document = load_odt(str(path))

    paragraphs = []

    for element in document.getElementsByType(odf_text.P):
        text = "".join(
            node.data
            for node in element.childNodes
            if getattr(node, "data", None)
        ).strip()

        if text:
            paragraphs.append(text)

    text = "\n".join(paragraphs).strip()

    if not text:
        return []

    return [
        DocumentPage(
            text=text,
            page=1,
            ocr_used=False,
        )
    ]


def load_txt_pages(path: Path) -> list[DocumentPage]:
    """Read TXT/Markdown content."""

    text = path.read_text(
        encoding="utf-8",
        errors="ignore",
    ).strip()

    if not text:
        return []

    return [
        DocumentPage(
            text=text,
            page=1,
            ocr_used=False,
        )
    ]


def load_image(path: Path) -> list[DocumentPage]:
    """Extract text from an image using Tesseract."""

    text = ocr_image(path)

    if not text:
        return []

    return [
        DocumentPage(
            text=text,
            page=1,
            ocr_used=True,
        )
    ]


def load_document_pages(path: Path) -> list[DocumentPage]:
    """Load a document into page-aware text records."""

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(
            f"File not found: {path}"
        )

    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return load_pdf_pages(path)

    if suffix == ".docx":
        return load_docx_pages(path)

    if suffix == ".odt":
        return load_odt_pages(path)

    if suffix in {".txt", ".md"}:
        return load_txt_pages(path)

    if suffix in {
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
        ".bmp",
        ".webp",
    }:
        return load_image(path)

    raise ValueError(
        f"Unsupported file type: {suffix}"
    )


def load_document(path: Path) -> str:
    """Backward-compatible document loader."""

    pages = load_document_pages(path)

    return "\n\n".join(
        page.text
        for page in pages
    ).strip()
