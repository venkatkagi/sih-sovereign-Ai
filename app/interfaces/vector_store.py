from typing import Protocol


class VectorStore(Protocol):
    """Interface for persistent vector storage."""

    def add_documents(
        self,
        ids: list[str],
        texts: list[str],
        embeddings,
        metadatas: list[dict],
    ) -> None:
        """Insert or update document chunks."""
        ...

    def search(
        self,
        embedding,
        n_results: int = 5,
    ):
        """Search for semantically similar chunks."""
        ...

    def get_by_metadata(
        self,
        field: str,
        values: list[str],
    ):
        """Retrieve chunks matching exact metadata values."""
        ...

    def count(self) -> int:
        """Return the number of stored vectors."""
        ...
