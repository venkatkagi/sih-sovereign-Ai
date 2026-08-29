import chromadb
from pathlib import Path
from typing import Any, Optional

from app.config import CHROMA_DIR


class ChromaVectorStore:
    """Chroma-backed persistent vector store for backward compatibility & local testing."""

    def __init__(self, path=None, collection_name="sovereign_rag") -> None:
        db_path = path if path is not None else CHROMA_DIR
        self.client = chromadb.PersistentClient(path=str(db_path))

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self,
        ids: list[str],
        texts: list[str],
        embeddings,
        metadatas: list[dict],
    ) -> None:
        if hasattr(embeddings, "tolist"):
            emb_list = embeddings.tolist()
        else:
            emb_list = [list(e) for e in embeddings]

        self.collection.upsert(
            ids=ids,
            documents=texts,
            embeddings=emb_list,
            metadatas=metadatas,
        )

    def search(
        self,
        embedding,
        n_results: int = 5,
        source: str | None = None,
    ):
        if hasattr(embedding, "tolist"):
            emb = embedding.tolist()
        else:
            emb = list(embedding)

        kwargs = {
            "query_embeddings": [emb],
            "n_results": n_results,
        }

        if source:
            kwargs["where"] = {
                "source": source,
            }

        return self.collection.query(**kwargs)

    def get_by_metadata(
        self,
        field: str,
        values: list[str],
    ):
        results = []

        for value in values:
            matches = self.collection.get(
                where={field: value},
                include=[
                    "documents",
                    "metadatas",
                ],
            )

            documents = matches.get("documents", [])
            metadatas = matches.get("metadatas", [])

            for document, metadata in zip(
                documents,
                metadatas,
            ):
                results.append(
                    {
                        "document": document,
                        "metadata": metadata,
                        "distance": 0.0,
                    }
                )

        return results

    def get_by_source(self, source: str):
        """Return all indexed chunks belonging to one source."""
        matches = self.collection.get(
            where={"source": source},
            include=[
                "documents",
                "metadatas",
            ],
        )

        documents = matches.get("documents", [])
        metadatas = matches.get("metadatas", [])

        results = []

        for document, metadata in zip(
            documents,
            metadatas,
        ):
            results.append(
                {
                    "text": document,
                    "metadata": metadata,
                    "distance": 0.0,
                }
            )

        return results

    def count(self) -> int:
        return self.collection.count()
