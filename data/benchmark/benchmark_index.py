from pathlib import Path
import time

from backend.chunking.chunker import chunk_text
from backend.embeddings.model import EmbeddingModel
from backend.metadata.parser import extract_metadata
from backend.vectorstore.store import VectorStore


DOCUMENT_DIR = Path("data/benchmark/documents")
CHROMA_DIR = Path("data/benchmark/chroma")


def main():
    print("Loading embedding model...")

    embedder = EmbeddingModel()

    store = VectorStore(
        path=CHROMA_DIR,
        collection_name="benchmark",
    )

    documents = sorted(DOCUMENT_DIR.glob("*.txt"))

    print("Documents found:", len(documents))

    if not documents:
        print("No documents found.")
        return

    total_chunks = 0

    start_time = time.perf_counter()

    for path in documents:
        text = path.read_text(encoding="utf-8")

        chunks = chunk_text(text)

        total_chunks += len(chunks)

        texts = [chunk.text for chunk in chunks]

        if not texts:
            continue

        embeddings = embedder.encode(texts)

        document_metadata = extract_metadata(text)

        ids = [
            f"{path.stem}:{chunk.chunk_id}"
            for chunk in chunks
        ]

        metadatas = [
            {
                "source": path.name,
                "chunk_id": chunk.chunk_id,
                **document_metadata,
            }
            for chunk in chunks
        ]

        store.add_documents(
            ids=ids,
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    elapsed = time.perf_counter() - start_time

    print()
    print("=== BENCHMARK RESULTS ===")
    print("Documents processed:", len(documents))
    print("Total chunks:", total_chunks)
    print("Total time:", round(elapsed, 2), "seconds")

    if elapsed > 0:
        print(
            "Documents/second:",
            round(len(documents) / elapsed, 2),
        )

        print(
            "Chunks/second:",
            round(total_chunks / elapsed, 2),
        )

    print("Stored vectors:", store.count())


if __name__ == "__main__":
    main()
