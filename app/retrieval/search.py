from app.embeddings.model import EmbeddingModel
from app.vectorstore.store import VectorStore


class Retriever:
    def __init__(self) -> None:
        self.embedder = EmbeddingModel()
        self.vector_store = VectorStore()

    def search(self, query: str, n_results: int = 5) -> list[dict]:
        """Find the most relevant document chunks for a query."""

        if not query.strip():
            return []

        query_embedding = self.embedder.encode([query])[0]

        results = self.vector_store.search(
            embedding=query_embedding,
            n_results=n_results,
        )

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        matches = []

        for document, metadata, distance in zip(
            documents,
            metadatas,
            distances,
        ):
            matches.append(
                {
                    "text": document,
                    "metadata": metadata,
                    "distance": distance,
                }
            )

        return matches
