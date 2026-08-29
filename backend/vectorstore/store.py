import logging
import os
from typing import Any, Optional

from backend.vectorstore.chroma import ChromaVectorStore
from backend.vectorstore.pgvector_store import PgVectorStore

logger = logging.getLogger(__name__)


def get_default_vector_store(
    path: Optional[str] = None,
    collection_name: str = "sovereign_rag",
    backend: Optional[str] = None,
):
    """
    Factory creating the canonical VectorStore.

    Canonical Production:
      - Defaults to PostgreSQL + pgvector.
      - If PostgreSQL connection fails, it raises an exception immediately.
      - Silent fallback to Chroma is strictly prohibited.

    Chroma Override:
      - Used only when explicitly requested (backend="chroma", VECTOR_STORE_BACKEND="chroma",
        or when a specific test path is provided).
    """
    return VectorStore(path=path, collection_name=collection_name, backend=backend)


class VectorStore:
    """
    Unified VectorStore interface.
    PostgreSQL + pgvector is the canonical production vector store.
    Chroma is strictly opt-in for isolated unit testing and explicit dev configuration.
    """

    def __init__(
        self,
        path: Optional[str] = None,
        collection_name: str = "sovereign_rag",
        backend: Optional[str] = None,
    ) -> None:
        # Determine configured backend
        env_backend = os.getenv("VECTOR_STORE_BACKEND", "").lower().strip()
        
        # Explicit override priority:
        # 1. explicit parameter backend (e.g. backend="chroma" or backend="postgres")
        # 2. explicit env variable VECTOR_STORE_BACKEND
        # 3. explicit path given without backend parameter -> Chroma (for unit test isolation)
        # 4. default -> PostgreSQL (canonical production)
        if backend:
            target_backend = backend.lower().strip()
        elif env_backend:
            target_backend = env_backend
        elif path is not None:
            target_backend = "chroma"
        else:
            target_backend = "postgres"

        if target_backend in ("postgres", "postgresql", "pgvector"):
            # CANONICAL PRODUCTION: PostgreSQL + pgvector
            db_url = os.getenv("DATABASE_URL")
            try:
                self._impl = PgVectorStore(connection_string=db_url, table_name=collection_name)
                self.backend_type = "postgresql"
                self.is_pgvector = True
                logger.info("VectorStore successfully connected to PostgreSQL + pgvector.")
            except Exception as exc:
                logger.error(
                    f"CRITICAL: Failed to initialize production PostgreSQL + pgvector ({exc}). "
                    f"Automatic fallback to Chroma is prohibited."
                )
                raise RuntimeError(
                    f"PostgreSQL + pgvector connection failed: {exc}. "
                    f"Production must not fall back to Chroma. "
                    f"Ensure PostgreSQL is accessible or set VECTOR_STORE_BACKEND=chroma for isolated test mode."
                ) from exc

        elif target_backend == "chroma":
            # EXPLICIT TEST / DEV OVERRIDE
            self._impl = ChromaVectorStore(path=path, collection_name=collection_name)
            self.backend_type = "chroma"
            self.is_pgvector = False
            logger.info("VectorStore initialized with Chroma (explicit test/dev override).")

        else:
            raise ValueError(
                f"Invalid vector store backend '{target_backend}'. "
                f"Supported backends are 'postgres' (production) and 'chroma' (test override)."
            )

    @property
    def collection(self):
        """Access underlying collection (for backward compatibility in Chroma tests)."""
        if hasattr(self._impl, "collection"):
            return self._impl.collection
        raise AttributeError("Underlying store does not expose a raw collection attribute.")

    def add_documents(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: Any,
        metadatas: list[dict],
    ) -> None:
        return self._impl.add_documents(ids=ids, texts=texts, embeddings=embeddings, metadatas=metadatas)

    def search(
        self,
        embedding: Any,
        n_results: int = 5,
        source: Optional[str] = None,
    ):
        return self._impl.search(embedding=embedding, n_results=n_results, source=source)

    def get_by_metadata(
        self,
        field: str,
        values: list[str],
    ):
        return self._impl.get_by_metadata(field=field, values=values)

    def get_by_source(self, source: str):
        return self._impl.get_by_source(source=source)

    def count(self) -> int:
        return self._impl.count()
