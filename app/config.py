from pathlib import Path

# Project root
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directories
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"
CHROMA_DIR = DATA_DIR / "chroma"

# RAG settings
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120

# Embedding model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Create required directories
for directory in (UPLOAD_DIR, PROCESSED_DIR, CHROMA_DIR):
    directory.mkdir(parents=True, exist_ok=True)
