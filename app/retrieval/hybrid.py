import re


class HybridRetriever:
    def __init__(self, store, embedder):
        self.store = store
        self.embedder = embedder

    def search(
        self,
        question: str,
        n_results: int = 5,
        source: str | None = None,
    ):
        query_embedding = self.embedder.encode([question])[0]

        # When a source is explicitly selected, retrieve all of its
        # chunks so semantic search cannot discard the relevant section.
        if source:
            source_results = self.store.get_by_source(source)

            documents = [
                item["text"]
                for item in source_results
            ]

            metadatas = [
                item["metadata"]
                for item in source_results
            ]

            # get_by_source does not calculate distances, so calculate
            # cosine distance against every chunk here.
            if documents:
                chunk_embeddings = self.embedder.encode(documents)

                distances = [
                    1.0 - float(
                        query_embedding @ chunk_embedding
                    )
                    for chunk_embedding in chunk_embeddings
                ]
            else:
                distances = []

        else:
            # Normal semantic retrieval across the whole corpus.
            candidate_count = max(n_results * 4, 20)

            semantic_results = self.store.search(
                query_embedding,
                candidate_count,
            )

            documents = semantic_results["documents"][0]
            metadatas = semantic_results["metadatas"][0]
            distances = semantic_results["distances"][0]

        # Extract exact identifiers from the question.
        question_upper = question.upper()

        equipment_tags = re.findall(
            r"\b[A-Z]{2}-\d{6}\b",
            question_upper,
        )

        document_ids = re.findall(
            r"\bDOC-\d{6}\b",
            question_upper,
        )

        reference_codes = re.findall(
            r"\bREF-\d{4,6}-\d{4,6}\b",
            question_upper,
        )

        # Detect an explicitly mentioned document filename.
        source_matches = re.findall(
            r"\b[\w.-]+\.(?:pdf|docx|odt|txt|md)\b",
            question,
            flags=re.IGNORECASE,
        )

        requested_source = (
            source_matches[0]
            if source_matches
            else None
        )

        candidates = {}

        for index, (document, metadata, distance) in enumerate(
            zip(
                documents,
                metadatas,
                distances,
            )
        ):
            document_source = metadata.get("source", "")
            chunk_id = metadata.get("chunk_id", index)

            candidate_key = (
                document_source,
                metadata.get("page"),
                chunk_id,
            )

            score = float(distance)

            # Strongly prioritize an explicitly mentioned source.
            if (
                requested_source
                and document_source.lower()
                == requested_source.lower()
            ):
                score -= 1.0

            # Match filename stems in question (e.g. "sharuk" in query matches "sharuk.pdf")
            stem = document_source.split(".")[0].lower()
            if stem and len(stem) >= 3 and stem in question.lower():
                score -= 1.5

            candidates[candidate_key] = {
                "document": document,
                "metadata": metadata,
                "distance": float(distance),
                "score": score,
            }

        # Exact metadata lookup.
        exact_matches = []

        if equipment_tags:
            exact_matches.extend(
                self.store.get_by_metadata(
                    "equipment_tag",
                    equipment_tags,
                )
            )

        if document_ids:
            exact_matches.extend(
                self.store.get_by_metadata(
                    "document_id",
                    document_ids,
                )
            )

        if reference_codes:
            exact_matches.extend(
                self.store.get_by_metadata(
                    "reference_code",
                    reference_codes,
                )
            )

        # Add exact matches with a very strong score.
        for item in exact_matches:
            metadata = item["metadata"]
            document_source = metadata.get("source", "")
            chunk_id = metadata.get("chunk_id")

            candidate_key = (
                document_source,
                metadata.get("page"),
                chunk_id,
            )

            candidates[candidate_key] = {
                "document": item["document"],
                "metadata": metadata,
                "distance": item.get("distance", 0.0),
                "score": -1.0,
            }

        # Additional identifier scoring.
        for candidate in candidates.values():
            metadata = candidate["metadata"]

            equipment_tag = str(
                metadata.get("equipment_tag", "")
            ).upper()

            document_id = str(
                metadata.get("document_id", "")
            ).upper()

            reference_code = str(
                metadata.get("reference_code", "")
            ).upper()

            if equipment_tag in equipment_tags:
                candidate["score"] -= 0.50

            if document_id in document_ids:
                candidate["score"] -= 0.50

            if reference_code in reference_codes:
                candidate["score"] -= 0.50

        ranked = sorted(
            candidates.values(),
            key=lambda item: item["score"],
        )[:n_results]

        return {
            "documents": [
                [item["document"] for item in ranked]
            ],
            "metadatas": [
                [item["metadata"] for item in ranked]
            ],
            "distances": [
                [item["distance"] for item in ranked]
            ],
        }
