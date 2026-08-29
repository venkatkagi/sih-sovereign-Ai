import asyncio
import logging
import math
import os
from abc import ABC, abstractmethod
from typing import Optional, Union

logger = logging.getLogger(__name__)

# Default standard model per TECH_STACK.md (384 dimensions)
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
DEFAULT_EMBEDDING_DIMENSION = 384


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if len(vec1) != len(vec2):
        raise ValueError(f"Vector dimensions mismatch: {len(vec1)} vs {len(vec2)}")
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


class BaseEmbeddingModel(ABC):
    """Abstract base class for all embedding models."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the vector dimensionality (e.g. 384)."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the name or identifier of the embedding model."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> list[float]:
        """Generate embedding vector for a single text string."""
        pass

    @abstractmethod
    def embed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Generate embedding vectors for a list of document chunks."""
        pass

    def embed_query(self, query: str) -> list[float]:
        """Generate embedding vector for a search query (can be overridden for asymmetric models)."""
        return self.embed_text(query)

    async def aembed_text(self, text: str) -> list[float]:
        """Asynchronously generate embedding vector for a single text string."""
        return await asyncio.to_thread(self.embed_text, text)

    async def aembed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Asynchronously generate embedding vectors for multiple texts."""
        return await asyncio.to_thread(self.embed_documents, texts, batch_size)

    async def aembed_query(self, query: str) -> list[float]:
        """Asynchronously generate embedding vector for a search query."""
        return await asyncio.to_thread(self.embed_query, query)


class SentenceTransformerEmbedder(BaseEmbeddingModel):
    """
    SentenceTransformers integration producing normalized 384-d vectors.
    Optimized for air-gapped / local inference.
    """

    def __init__(
        self,
        model_name_or_path: str = DEFAULT_EMBEDDING_MODEL,
        device: Optional[str] = None,
        normalize_embeddings: bool = True,
        dimension: int = DEFAULT_EMBEDDING_DIMENSION,
    ):
        self._model_name = model_name_or_path
        self._device = device
        self._normalize_embeddings = normalize_embeddings
        self._dimension = dimension
        self._model = None
        self._lock = asyncio.Lock()

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _load_model(self):
        """Lazy-load SentenceTransformer model to minimize startup overhead."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(
                    self._model_name,
                    device=self._device,
                )
                # Read dynamic dimension if available
                if hasattr(self._model, "get_embedding_dimension"):
                    dim = self._model.get_embedding_dimension()
                elif hasattr(self._model, "get_sentence_embedding_dimension"):
                    dim = self._model.get_sentence_embedding_dimension()
                else:
                    dim = self._dimension

                if dim:
                    self._dimension = dim

            except Exception as e:
                logger.warning(
                    f"Failed to load SentenceTransformer '{self._model_name}': {e}. "
                    "Make sure sentence-transformers is installed or offline model path is correct."
                )
                raise e
        return self._model

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding vector for a single text."""
        model = self._load_model()
        embedding = model.encode(
            text,
            normalize_embeddings=self._normalize_embeddings,
            show_progress_bar=False,
        )
        return embedding.tolist()

    def embed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Generate embedding vectors in batches."""
        if not texts:
            return []
        model = self._load_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=self._normalize_embeddings,
            show_progress_bar=False,
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """Generate embedding for search query."""
        # For BGE or instruction-tuned models, prefixing can be added here if configured
        return self.embed_text(query)


class MockEmbeddingPipeline(BaseEmbeddingModel):
    """
    Deterministic mock embedding pipeline for lightweight testing
    or offline fallback without torch/weights.
    """

    def __init__(
        self,
        dimension: int = DEFAULT_EMBEDDING_DIMENSION,
        model_name: str = "mock-384d-embedder",
    ):
        self._dimension = dimension
        self._model_name = model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_text(self, text: str) -> list[float]:
        import hashlib
        # Deterministically hash text into a normalized float vector
        hasher = hashlib.sha256(text.encode("utf-8"))
        seed = hasher.digest()
        vec = []
        for i in range(self._dimension):
            byte_val = seed[i % len(seed)]
            val = ((byte_val + i * 31) % 256) / 128.0 - 1.0
            vec.append(val)
        
        # Normalize
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def embed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]


class EmbeddingPipeline:
    """
    High-level facade for embedding operations across the application.
    Defaults to SentenceTransformers with fallback capabilities.
    """

    def __init__(
        self,
        model_name_or_path: str = DEFAULT_EMBEDDING_MODEL,
        device: Optional[str] = None,
        dimension: int = DEFAULT_EMBEDDING_DIMENSION,
        fallback_to_mock: bool = True,
    ):
        self.model_name = model_name_or_path
        self.dimension = dimension
        self.fallback_to_mock = fallback_to_mock
        self._embedder: Optional[BaseEmbeddingModel] = None
        self._device = device

    def _get_embedder(self) -> BaseEmbeddingModel:
        if self._embedder is None:
            try:
                self._embedder = SentenceTransformerEmbedder(
                    model_name_or_path=self.model_name,
                    device=self._device,
                    dimension=self.dimension,
                )
                # Trigger lazy load test
                self._embedder._load_model()
            except Exception as e:
                if self.fallback_to_mock:
                    logger.warning(
                        f"SentenceTransformers unavailable ({e}). Using MockEmbeddingPipeline fallback."
                    )
                    self._embedder = MockEmbeddingPipeline(
                        dimension=self.dimension,
                        model_name=f"mock-{self.model_name}",
                    )
                else:
                    raise e
        return self._embedder

    def embed_text(self, text: str) -> list[float]:
        return self._get_embedder().embed_text(text)

    def embed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        return self._get_embedder().embed_documents(texts, batch_size=batch_size)

    def embed_query(self, query: str) -> list[float]:
        return self._get_embedder().embed_query(query)

    async def aembed_text(self, text: str) -> list[float]:
        return await self._get_embedder().aembed_text(text)

    async def aembed_documents(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        return await self._get_embedder().aembed_documents(texts, batch_size=batch_size)

    async def aembed_query(self, query: str) -> list[float]:
        return await self._get_embedder().aembed_query(query)


# Global default embedding pipeline instance
default_embedder = EmbeddingPipeline()
