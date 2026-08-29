# TECH_STACK.md: Technical Architecture & System Specifications

This document outlines the architecture, technology stack, database schemas, model configurations, and air-gapped security protocols across all 4 modules of the application.

---

## 1. System Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      MODULE 1: FRONTEND LAYER                          │
 │             Next.js (React 19, TypeScript) + shadcn/ui                 │
 │             Tailwind CSS + Lucide Icons + React Query                  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Async REST / SSE Streams
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      MODULE 2: BACKEND LAYER                           │
 │             FastAPI (Python 3.11+) + Pydantic v2                      │
 │             SQLAlchemy 2.0 Async + asyncpg                            │
 └─────────┬─────────────────────────┬──────────────────────────┬─────────┘
           │                         │                          │
           ▼                         ▼                          ▼
 ┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
 │  POSTGRESQL +     │    │  MODULE 3: LLM &   │    │  MODULE 4: DOC      │
 │  PGVECTOR         │    │  EMBEDDING LAYER   │    │  INGESTION & FLOWS  │
 │                   │    │                    │    │                     │
 │ • documents       │    │ • Ollama Runtime   │    │ • PyMuPDF (fitz)    │
 │ • doc_chunks      │    │ • Qwen3 (4B/8B/VL) │    │ • Tesseract OCR     │
 │ • conversations   │    │ • Gemma3 (4B/8B)   │    │ • Docker Sandbox    │
 │ • messages        │    │ • SentenceTransformer│    │ • Document Exporters│
 └───────────────────┘    └────────────────────┘    └─────────────────────┘
```

---

## 2. Module Breakdown & Tech Stack Specs

### Module 1: Frontend (`/frontend`)
- **Framework**: Next.js 14+ (App Router, TypeScript)
- **UI & Styling**: Tailwind CSS, shadcn/ui (Radix UI primitives), Lucide Icons
- **State & Data Fetching**: `@tanstack/react-query`, `zustand` (active chat state)
- **Key Components**:
  - `ChatContainer`: Slack-style threaded chat UI with markdown rendering (`react-markdown`, `katex`).
  - `FileUploadDropzone`: Drag-and-drop document uploader with visual progress bar.
  - `CitationViewer`: Slide-over panel displaying retrieved page chunks, source document name, and vector similarity score.
  - `ModelSelector`: UI toggle indicating auto-routed model selection (Qwen3 4B, 8B, Qwen3-VL, Gemma3).

### Module 2: Backend & Database (`/backend`)
- **Framework**: FastAPI (Python 3.11+, Uvicorn async ASGI)
- **Database Engine**: PostgreSQL 16+ with `pgvector` extension enabled.
- **ORM / Migrations**: SQLAlchemy 2.0 (Async Engine), Alembic for schema migrations.
- **Security & Air-Gap Compliance**: Network firewall logging; zero external API requests.

#### Database Schema Design (`init.sql`)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents master table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    page_count INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'processing', -- processing, ready, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks table storing embeddings alongside text
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    page_number INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT NOT NULL,
    embedding vector(384), -- 384 dimensions for all-MiniLM-L6-v2 (or 768/1024 depending on model)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast cosine similarity vector search
CREATE INDEX idx_document_chunks_embedding 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'tool'
    content TEXT NOT NULL,
    model_used VARCHAR(50),
    citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

### Module 3: LLM & Embedding Pipeline (`/backend/app/ai`)
- **LLM Runtime Engine**: Ollama (Running disconnected / offline on `http://localhost:11434`)
- **Downloaded Models**:
  - `qwen3:4b` (4B parameters, text & tool-calling)
  - `qwen3:8b` (8B parameters, heavy reasoning & tool-calling)
  - `qwen3-vl:4b` (4B parameters, visual understanding)
  - `gemma3:4b` / `gemma3:8b` (Multimodal instruction execution)
- **Embedding Model**: `SentenceTransformers` (`all-MiniLM-L6-v2` - 384 dimensions or `bge-small-en-v1.5`)
- **Vector Retrieval SQL Pattern**:
  ```sql
  SELECT id, content, page_number, 1 - (embedding <=> :query_vector) AS similarity
  FROM document_chunks
  WHERE document_id = :doc_id OR :doc_id IS NULL
  ORDER BY embedding <=> :query_vector ASC
  LIMIT :top_k;
  ```

---

### Module 4: Document Ingestion & Sandboxed Execution (`/backend/app/ingestion`)
- **PDF & Document Reader**: `PyMuPDF` (`fitz`) - Extracts structured text, layout, and pages into Markdown format.
- **OCR Engine**: `Tesseract OCR` (`pytesseract`) - Used automatically when PyMuPDF detects image-only or scanned PDF pages.
- **Code Execution Sandbox**:
  - Docker Container Sandbox or restricted Python `subprocess` with disabled network access (`--net=none`), CPU/RAM limits, and temporary workspace binding.
- **Output Exporters**:
  - `python-docx` (Word document generation)
  - `reportlab` (PDF generation)
  - `openpyxl` (Excel sheet generation)

---

## 3. Communication Protocols & API Contracts

### A. Document Upload Endpoint
- **URL**: `POST /api/v1/documents/upload`
- **Payload**: `multipart/form-data` (`file: UploadFile`, `department: Optional[str]`)
- **Response**:
  ```json
  {
    "document_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "filename": "inspection_report.pdf",
    "status": "processing",
    "page_count": 14
  }
  ```

### B. Agent Chat Query Endpoint
- **URL**: `POST /api/v1/chat/completions`
- **Payload**:
  ```json
  {
    "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Read the inspection report and check if safety standard 4.1 was followed.",
    "media_paths": [],
    "stream": false
  }
  ```
- **Response**:
  ```json
  {
    "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
    "sender": "assistant",
    "model_used": "qwen3:8b",
    "content": "According to page 4 of inspection_report.pdf, safety standard 4.1 was met...",
    "citations": [
      {
        "document_name": "inspection_report.pdf",
        "page_number": 4,
        "similarity_score": 0.89
      }
    ]
  }
  ```

---

## 4. Air-Gap & Zero External API Verification

To satisfy on-premises security requirements:
1. **Host Binding**: Ollama binds locally (`127.0.0.1:11434`).
2. **PyTorch / HuggingFace Offline Mode**: Set `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` in system environment.
3. **Network Audit Verification Script**:
   ```bash
   # Run tcpdump or netstat during execution to demonstrate zero outbound traffic
   sudo tcpdump -i any 'dst port not 5432 and dst port not 11434 and dst port not 8000'
   ```
