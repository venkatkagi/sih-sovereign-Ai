import logging
from pathlib import Path
from typing import Any, Optional

from backend.embeddings.model import EmbeddingModel
from backend.generation.ollama_gen import OllamaGenerator
from backend.interfaces.embedding import EmbeddingProvider
from backend.interfaces.generator import Generator
from backend.rag.indexer import RAGIndexer
from backend.rag.pipeline import RAGPipeline
from backend.retrieval.hybrid import HybridRetriever
from backend.vectorstore.store import VectorStore

logger = logging.getLogger(__name__)


class RAGService:
    """Public service interface for the Sovereign RAG system."""

    def __init__(
        self,
        vector_store_path: Optional[str] = None,
        collection_name: str = "sovereign_rag",
        embedder: Optional[EmbeddingProvider] = None,
        generator: Optional[Generator] = None,
        vector_store: Optional[VectorStore] = None,
        backend: Optional[str] = None,
    ) -> None:
        self.embedder = embedder or EmbeddingModel()

        self.vector_store = vector_store or VectorStore(
            path=vector_store_path,
            collection_name=collection_name,
            backend=backend,
        )

        self.indexer = RAGIndexer(
            embedder=self.embedder,
            vector_store=self.vector_store,
        )

        self.retriever = HybridRetriever(
            self.vector_store,
            self.embedder,
        )

        self.generator = generator or OllamaGenerator()

        self.pipeline = RAGPipeline(
            self.retriever,
            self.generator,
        )

    def ingest(self, path: Path) -> dict:
        """Ingest a document and return ingestion information."""
        path = Path(path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        chunks = self.indexer.index_document(path)

        return {
            "filename": path.name,
            "chunks_indexed": chunks,
            "vectors_stored": self.vector_store.count(),
        }

    def ask(
        self,
        question: str,
        n_results: int = 3,
        source: Optional[str] = None,
    ) -> dict:
        """Ask a question against the indexed documents."""
        return self.pipeline.ask(
            question,
            n_results=n_results,
            source=source,
        )

    def index_chat_turn(
        self,
        conversation_id: str,
        user_text: str,
        assistant_text: str,
        session_title: str = "Chat Session",
    ) -> int:
        """Index a completed conversation turn into pgvector."""
        return self.indexer.index_chat_turn(
            conversation_id=conversation_id,
            user_text=user_text,
            assistant_text=assistant_text,
            session_title=session_title,
        )

    def count(self) -> int:
        """Return the number of stored vectors."""
        return self.vector_store.count()


_rag_service_instance: Optional[RAGService] = None


def get_rag_service(
    vector_store_path: Optional[str] = None,
    collection_name: str = "sovereign_rag",
    backend: Optional[str] = None,
    force_new: bool = False,
) -> RAGService:
    """Retrieve or initialize the canonical RAGService instance."""
    global _rag_service_instance
    if _rag_service_instance is None or force_new:
        _rag_service_instance = RAGService(
            vector_store_path=vector_store_path,
            collection_name=collection_name,
            backend=backend,
        )
    return _rag_service_instance


class _LazyRAGServiceProxy:
    """Proxy providing backward-compatible access to default_rag_service."""

    def __getattr__(self, name: str) -> Any:
        return getattr(get_rag_service(), name)


default_rag_service = _LazyRAGServiceProxy()
