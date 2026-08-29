from pathlib import Path
import time

from backend.chunking.chunker import chunk_text
from backend.metadata.parser import extract_metadata
from backend.embeddings.model import EmbeddingModel
from backend.vectorstore.store import VectorStore


DOCUMENT_DIR = Path("data/scaling/documents")
CHROMA_DIR = Path("data/scaling/chroma")
COLLECTION_NAME = "scaling"


def main():
    print("Loading embedding model...")
    embedder = EmbeddingModel()

    print("Opening ChromaDB...")
    store = VectorStore(
        path=CHROMA_DIR,
        collection_name=COLLECTION_NAME,
    )

    documents = sorted(DOCUMENT_DIR.glob("*.txt"))

    print("Documents found:", len(documents))

    if not documents:
        print("No documents found.")
        return

    total_chunks = 0

    start_time = time.perf_counter()

    for index, path in enumerate(documents, start=1):

        text = path.read_text(encoding="utf-8")

        chunks = chunk_text(text)

        total_chunks += len(chunks)

        texts = [chunk.text for chunk in chunks]

        if not texts:
            continue

        embeddings = embedder.encode(texts)

        ids = [
            f"{path.stem}:{chunk.chunk_id}"
            for chunk in chunks
        ]

        document_metadata = extract_metadata(text)

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

        if index % 100 == 0:
            print(f"Processed {index}/{len(documents)} documents")

    elapsed = time.perf_counter() - start_time

    print()
    print("================================")
    print("      SCALING INDEX RESULTS")
    print("================================")
    print("Documents processed:", len(documents))
    print("Total chunks:", total_chunks)
    print("Stored vectors:", store.count())
    print("Total indexing time:", round(elapsed, 2), "seconds")

    if elapsed > 0:
        print(
            "Documents/second:",
            round(len(documents) / elapsed, 2),
        )

        print(
            "Chunks/second:",
            round(total_chunks / elapsed, 2),
        )


if __name__ == "__main__":
    main()
