import json
import logging
import os
from typing import Any, Optional

import psycopg2
from psycopg2.extras import Json, execute_values
from pgvector.psycopg2 import register_vector

logger = logging.getLogger(__name__)

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'local_rag_db')}"
)


class PgVectorStore:
    """Canonical PostgreSQL + pgvector vector store implementation."""

    def __init__(
        self,
        connection_string: Optional[str] = None,
        table_name: str = "document_chunks",
        embedding_dim: int = 384,
    ) -> None:
        self.connection_string = connection_string or DEFAULT_DATABASE_URL
        self.table_name = table_name
        self.embedding_dim = embedding_dim
        self._init_db()

    def _get_connection(self):
        conn = psycopg2.connect(self.connection_string)
        register_vector(conn)
        return conn

    def _init_db(self) -> None:
        """Ensure pgvector extension and document schema exist."""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Enable vector extension
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

                    # Canonical documents table
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS documents (
                            id VARCHAR(255) PRIMARY KEY,
                            filename VARCHAR(512) NOT NULL,
                            file_path TEXT,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            metadata JSONB DEFAULT '{}'::jsonb
                        );
                    """)

                    # Canonical document_chunks table with pgvector(384)
                    cur.execute(f"""
                        CREATE TABLE IF NOT EXISTS {self.table_name} (
                            id VARCHAR(512) PRIMARY KEY,
                            document_id VARCHAR(255),
                            chunk_index INT,
                            content TEXT NOT NULL,
                            page INT DEFAULT 1,
                            ocr_used BOOLEAN DEFAULT FALSE,
                            embedding vector({self.embedding_dim}),
                            metadata JSONB DEFAULT '{{}}'::jsonb,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                    """)

                    # HNSW index for cosine distance vector search
                    cur.execute(f"""
                        CREATE INDEX IF NOT EXISTS {self.table_name}_embedding_hnsw_idx
                        ON {self.table_name} USING hnsw (embedding vector_cosine_ops);
                    """)

                    # Indexes for exact metadata lookups & source isolation
                    cur.execute(f"""
                        CREATE INDEX IF NOT EXISTS {self.table_name}_source_idx
                        ON {self.table_name} ((metadata->>'source'));
                    """)
                    cur.execute(f"""
                        CREATE INDEX IF NOT EXISTS {self.table_name}_equipment_tag_idx
                        ON {self.table_name} ((metadata->>'equipment_tag'));
                    """)
                    cur.execute(f"""
                        CREATE INDEX IF NOT EXISTS {self.table_name}_document_id_idx
                        ON {self.table_name} ((metadata->>'document_id'));
                    """)
                    cur.execute(f"""
                        CREATE INDEX IF NOT EXISTS {self.table_name}_ref_code_idx
                        ON {self.table_name} ((metadata->>'reference_code'));
                    """)
                conn.commit()
            logger.info("PostgreSQL + pgvector schema successfully verified/created.")
        except Exception as exc:
            logger.warning(f"PostgreSQL connection/init failed ({exc}).")
            raise exc

    def add_documents(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: Any,
        metadatas: list[dict],
    ) -> None:
        """Insert or update document chunks and embeddings."""
        if not ids:
            return

        # Convert embeddings if numpy array or list
        if hasattr(embeddings, "tolist"):
            emb_list = embeddings.tolist()
        else:
            emb_list = [list(e) for e in embeddings]

        records = []
        doc_records = {}

        for doc_id, text, emb, meta in zip(ids, texts, emb_list, metadatas):
            meta_copy = dict(meta) if meta else {}
            source = meta_copy.get("source", "unknown")
            page = meta_copy.get("page", 1)
            chunk_id = meta_copy.get("chunk_id", 0)
            ocr_used = bool(meta_copy.get("ocr_used", False))

            # Track unique parent documents
            if source not in doc_records:
                doc_records[source] = (source, source, meta_copy)

            records.append((
                doc_id,
                source,
                chunk_id,
                text,
                page,
                ocr_used,
                emb,
                Json(meta_copy),
            ))

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                # Upsert parent documents
                for doc_id, filename, dmeta in doc_records.values():
                    cur.execute("""
                        INSERT INTO documents (id, filename, metadata)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (id) DO UPDATE
                        SET metadata = EXCLUDED.metadata;
                    """, (doc_id, filename, Json(dmeta)))

                # Upsert chunks
                upsert_query = f"""
                    INSERT INTO {self.table_name} (
                        id, document_id, chunk_index, content, page, ocr_used, embedding, metadata
                    ) VALUES %s
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        page = EXCLUDED.page,
                        ocr_used = EXCLUDED.ocr_used,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata;
                """
                execute_values(cur, upsert_query, records, template="(%s, %s, %s, %s, %s, %s, %s, %s)")
            conn.commit()

    def search(
        self,
        embedding: Any,
        n_results: int = 5,
        source: Optional[str] = None,
    ) -> dict[str, list]:
        """
        Search semantically similar chunks using cosine distance (<=>).
        Matches VectorStore return schema:
        {'documents': [[...]], 'metadatas': [[...]], 'distances': [[...]]}
        """
        if hasattr(embedding, "tolist"):
            emb = embedding.tolist()
        else:
            emb = list(embedding)

        query = f"""
            SELECT content, metadata, (embedding <=> %s::vector) AS distance
            FROM {self.table_name}
            WHERE (%s IS NULL OR metadata->>'source' = %s)
            ORDER BY distance ASC
            LIMIT %s;
        """

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (emb, source, source, n_results))
                rows = cur.fetchall()

        documents = []
        metadatas = []
        distances = []

        for content, meta, dist in rows:
            documents.append(content)
            metadatas.append(meta if isinstance(meta, dict) else (json.loads(meta) if meta else {}))
            distances.append(float(dist))

        return {
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    def get_by_metadata(
        self,
        field: str,
        values: list[str],
    ) -> list[dict[str, Any]]:
        """Retrieve chunks matching exact metadata values."""
        if not values:
            return []

        # JSONB containment / exact lookup on key
        query = f"""
            SELECT content, metadata
            FROM {self.table_name}
            WHERE metadata->>%s = ANY(%s);
        """

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (field, list(values)))
                rows = cur.fetchall()

        results = []
        for content, meta in rows:
            meta_dict = meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
            results.append({
                "document": content,
                "metadata": meta_dict,
                "distance": 0.0,
            })

        return results

    def get_by_source(self, source: str) -> list[dict[str, Any]]:
        """Return all indexed chunks belonging to one source file."""
        query = f"""
            SELECT content, metadata
            FROM {self.table_name}
            WHERE metadata->>'source' = %s
            ORDER BY (metadata->>'chunk_id')::int ASC;
        """

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (source,))
                rows = cur.fetchall()

        results = []
        for content, meta in rows:
            meta_dict = meta if isinstance(meta, dict) else (json.loads(meta) if meta else {})
            results.append({
                "text": content,
                "metadata": meta_dict,
                "distance": 0.0,
            })

        return results

    def count(self) -> int:
        """Return total number of stored chunk vectors."""
        query = f"SELECT COUNT(*) FROM {self.table_name};"
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                row = cur.fetchone()
                return row[0] if row else 0
