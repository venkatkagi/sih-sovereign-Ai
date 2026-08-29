from sentence_transformers import SentenceTransformer

from backend.config import EMBEDDING_MODEL


class EmbeddingModel:
    def __init__(self) -> None:
        self.model = SentenceTransformer(EMBEDDING_MODEL)

    def encode(self, texts: list[str]):
        return self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
