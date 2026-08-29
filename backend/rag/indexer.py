from pathlib import Path

from backend.chunking.chunker import chunk_text
from backend.embeddings.model import EmbeddingModel
from backend.ingestion.loader import load_document_pages
from backend.interfaces.embedding import EmbeddingProvider
from backend.metadata.parser import extract_metadata
from backend.vectorstore.store import VectorStore


class RAGIndexer:
    def __init__(
        self,
        embedder: EmbeddingProvider | None = None,
        vector_store: VectorStore | None = None,
    ) -> None:
        self.embedder = embedder or EmbeddingModel()
        self.vector_store = vector_store or VectorStore()

    def index_document(self, path: Path) -> int:
        """Extract, OCR, chunk, embed, and store a document."""

        path = Path(path)

        pages = load_document_pages(path)

        if not pages:
            return 0

        total_chunks = 0

        for document_page in pages:
            text = document_page.text.strip()

            if not text:
                continue

            chunks = chunk_text(text)

            if not chunks:
                continue

            texts = [chunk.text for chunk in chunks]
            embeddings = self.embedder.encode(texts)

            document_metadata = extract_metadata(text)

            metadatas = [
                {
                    "source": path.name,
                    "file_type": path.suffix.lower().lstrip("."),
                    "page": document_page.page,
                    "ocr_used": document_page.ocr_used,
                    "chunk_id": chunk.chunk_id,
                    **document_metadata,
                }
                for chunk in chunks
            ]

            ids = [
                (
                    f"{path.name}:"
                    f"page-{document_page.page}:"
                    f"chunk-{chunk.chunk_id}"
                )
                for chunk in chunks
            ]

            self.vector_store.add_documents(
                ids=ids,
                texts=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )

            total_chunks += len(chunks)

        return total_chunks

    def index_chat_turn(
        self,
        conversation_id: str,
        user_text: str,
        assistant_text: str,
        session_title: str = "Chat Session",
    ) -> int:
        """Index completed conversation turn into pgvector for cross-session semantic RAG recall."""
        if not user_text and not assistant_text:
            return 0

        combined = f"User: {user_text.strip()}\nAssistant: {assistant_text.strip()}"
        chunks = chunk_text(combined)
        if not chunks:
            return 0

        import time
        ts = int(time.time())
        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedder.encode(texts)

        metadatas = [
            {
                "source": f"Chat Memory: {session_title or conversation_id}",
                "file_type": "chat_history",
                "page": 1,
                "conversation_id": conversation_id,
                "chunk_id": chunk.chunk_id,
            }
            for chunk in chunks
        ]

        ids = [
            f"chat:{conversation_id}:{ts}:{chunk.chunk_id}"
            for chunk in chunks
        ]

        self.vector_store.add_documents(
            ids=ids,
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        return len(chunks)

