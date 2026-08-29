# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: Financial analysts, compliance auditors, risk officers, and quantitative researchers in banking and regulated financial institutions.
- **User Situation & Job**: Working inside air-gapped, zero-trust enterprise networks to analyze private regulatory filings, balance sheets, quarterly reports, compliance guidelines, code scripts, and financial transaction logs without exposing sensitive corporate or client data to public cloud APIs.

## Product Purpose

VaultMind Sovereign AI is an on-premise, 100% air-gapped cognitive intelligence workspace. It combines local multimodal LLMs (Qwen3, Gemma3, Qwen3-VL via local Ollama), high-precision hybrid dense + BM25 RAG (PostgreSQL + pgvector with HNSW indexing), sandboxed Python/math execution, and real-time SSE streaming to enable secure document analysis, multi-turn reasoning, and artifact synthesis.

## Positioning

Unlike cloud-dependent enterprise AI solutions (OpenAI, Anthropic, AWS Bedrock) or simple desktop LLM wrappers:
- Operates with strict **zero external network requests**, zero telemetry, and verifiable on-prem compliance.
- Uses **PostgreSQL 16 + pgvector** as the canonical vector store (strict zero-cloud / zero-fallback architecture).
- Employs a **Dynamic Model Router** that inspects query complexity and modality (text, scanned PDF tables, visual charts) to route between local Ollama models with optimal VRAM utilization.
- Executes safe, multi-turn **ReAct agent reasoning loops** with local tools (vector search, page-level OCR/reading, AST math evaluator, sandboxed Python runtime).

## Operating Context

- **Environment**: Air-gapped on-premise servers and local workstations; dual-screen or desktop widescreen viewports.
- **Artifacts & Workflows**: Ingesting SEC filings, KYC/AML regulatory documents, balance sheets, tabular spreadsheets, scanned audit receipts, and local Python evaluation scripts.
- **Interactions**: Multi-turn agent chat with real-time SSE token streaming, live tool activation feeds, interactive document viewer with page-level citations, and specialized workspaces (Document Agent, Coding Agent, Multimodal View, Sheets/Sandbox Workspace).

## Capabilities and Constraints

- **Capabilities**:
  - Offline multimodal OCR and text extraction (PyMuPDF, Tesseract/ONNX).
  - Dense 384-d embeddings via local SentenceTransformers (`all-MiniLM-L6-v2`) combined with BM25 hybrid search.
  - Multi-turn ReAct reasoning with local tool evaluation and live execution feedback.
  - Interactive workspace file explorer, document previewer, and token/cost-free local inference.
- **Constraints**:
  - Absolute air-gap: no external CDN, Google Fonts, or cloud API calls allowed.
  - Resource awareness: strictly manage local VRAM and CPU constraints across 4B and 8B local models.
  - Deterministic auditability: citations must trace back directly to exact source document pages and chunk indices.

## Brand Commitments

- **Name**: VaultMind Sovereign AI
- **Identity & Voice**: Sovereign, precision-engineered, authoritative, high-density, dark-mode terminal & cockpit aesthetic with crystalline accents.
- **Design Tokens**: Deep obsidian/charcoal surfaces, crisp emerald/amber status indicators, high-legibility monospace and sans typography, and subtle micro-interactions.

## Evidence on Hand

- Verified backend FastAPI routes at `/chat/agent`, `/documents/upload`, `/stats`, `/health`.
- Working local models configured for Ollama (`qwen3:4b`, `qwen3:8b`, `qwen3-vl:4b`, `gemma3:4b`, `gemma3:8b`).
- Canonical PostgreSQL pgvector schema with `document_chunks` table and HNSW index.
- Comprehensive test suites in `ai_llms/` and `app/`.

## Product Principles

1. **Sovereignty First**: Never make an external network request or leak data outside the local perimeter.
2. **Auditable Grounding**: Every answer synthesized from documents must provide precise citations and verifiable source pages.
3. **Cognitive Transparency**: Expose the model's reasoning steps, tool selections, and execution status in real time.
4. **Dense, High-Throughput UX**: Optimize for speed, clarity, and deep focus without unnecessary fluff or decorative clutter.

## Accessibility & Inclusion

- High-contrast text readability (WCAG AA compliant against dark backgrounds).
- Keyboard navigable controls and screen-reader accessible status indicators.
- Responsive layout adapting from compact laptop screens to multi-monitor analyst dashboards.
