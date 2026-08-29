import asyncio

from ai_llms.ollama_client import OllamaModel
from ai_llms.model_types import QWEN3_4B


async def main():
    model = OllamaModel(QWEN3_4B)

    messages = [
        {
            "role": "user",
            "content": "Say hello in 3 words."
        }
    ]

    print("Streaming output:")
    async for chunk in model.stream(messages):
        print(chunk, end="", flush=True)
    print()


if __name__ == "__main__":
    asyncio.run(main())