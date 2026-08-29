from dataclasses import dataclass


@dataclass
class TextChunk:
    text: str
    chunk_id: int


def chunk_text(
    text: str,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[TextChunk]:
    """Split text into overlapping character-based chunks."""

    if not text or not text.strip():
        return []

    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    text = text.strip()
    chunks = []
    start = 0
    chunk_id = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(
                TextChunk(
                    text=chunk,
                    chunk_id=chunk_id,
                )
            )
            chunk_id += 1

        if end >= len(text):
            break

        start = end - chunk_overlap

    return chunks
