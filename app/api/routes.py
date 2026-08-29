from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import UPLOAD_DIR
from app.rag.service import RAGService


router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    question: str
    n_results: int = 3
    source: str | None = None


_service = None


def get_service() -> RAGService:
    global _service

    if _service is None:
        _service = RAGService()

    return _service


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "sovereign-rag",
    }


@router.get("/stats")
def stats():
    service = get_service()

    return {
        "vectors": service.count(),
    }


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
):
    """Upload and index a supported document."""

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    filename = Path(file.filename).name
    suffix = Path(filename).suffix.lower()

    supported = {
        ".pdf",
        ".docx",
        ".odt",
        ".txt",
        ".md",
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
        ".bmp",
        ".webp",
    }

    if suffix not in supported:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    upload_path = UPLOAD_DIR / filename

    try:
        upload_path.write_bytes(contents)

        service = get_service()

        result = service.ingest(upload_path)

        return {
            "filename": filename,
            "chunks_indexed": result["chunks_indexed"],
            "vectors_stored": result["vectors_stored"],
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {exc}",
        ) from exc


@router.post("/chat")
def chat(request: ChatRequest):
    """Ask a question against indexed documents."""

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    if request.n_results < 1 or request.n_results > 20:
        raise HTTPException(
            status_code=400,
            detail="n_results must be between 1 and 20.",
        )

    try:
        service = get_service()

        result = service.ask(
            request.question,
            n_results=request.n_results,
            source=request.source,
        )

        sources = []

        for context in result.get("contexts", []):
            metadata = context.get("metadata", {})

            source = metadata.get("source")

            if not source:
                continue

            source_info = {
                "source": source,
                "page": metadata.get("page"),
                "ocr_used": metadata.get(
                    "ocr_used",
                    False,
                ),
                "document_id": metadata.get(
                    "document_id",
                ),
            }

            if source_info not in sources:
                sources.append(source_info)

        return {
            "answer": result["answer"],
            "sources": sources,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"RAG query failed: {exc}",
        ) from exc
