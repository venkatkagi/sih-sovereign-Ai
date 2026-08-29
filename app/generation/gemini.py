import os

from dotenv import load_dotenv
from google import genai


load_dotenv(override=True)


class GeminiGenerator:
    """Generate grounded answers from retrieved RAG contexts."""

    def __init__(
        self,
        model: str = "gemini-3.6-flash",
    ) -> None:
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set."
            )

        self.client = genai.Client(api_key=api_key)
        self.model = model

    def generate(
        self,
        question: str,
        contexts: list[dict],
    ) -> str:
        """Generate a concise answer using only retrieved context."""

        if not contexts:
            return (
                "I don't have enough information "
                "in the provided documents."
            )

        context_blocks = []

        for index, context in enumerate(contexts, start=1):
            metadata = context.get("metadata", {})

            source = metadata.get(
                "source",
                "Unknown source",
            )

            text = context.get("text", "").strip()

            if not text:
                continue

            context_blocks.append(
                f"[Context {index}]\n"
                f"Source: {source}\n"
                f"{text}"
            )

        if not context_blocks:
            return (
                "I don't have enough information "
                "in the provided documents."
            )

        context_text = "\n\n".join(context_blocks)

        prompt = (
            "Answer the user's question using ONLY the "
            "supplied document context.\n\n"
            "Rules:\n"
            "1. Do not use outside knowledge.\n"
            "2. Do not invent facts.\n"
            "3. If the answer is not supported by the "
            "context, say: "
            "\"I don't have enough information in the "
            "provided documents.\"\n"
            "4. Keep the answer short and precise.\n"
            "5. Answer the question directly.\n\n"
            f"Question:\n{question}\n\n"
            f"Document context:\n{context_text}\n\n"
            "Answer:"
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
        )

        answer = (response.text or "").strip()

        if not answer:
            return (
                "I could not generate an answer from "
                "the provided documents."
            )

        return answer
