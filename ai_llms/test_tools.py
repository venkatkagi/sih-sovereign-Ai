import asyncio
import os
import shutil
import tempfile
import unittest
from ai_llms.tools import (
    CALCULATE_EXPRESSION_TOOL,
    GENERATE_REPORT_FILE_TOOL,
    GET_DOCUMENT_PAGE_TOOL,
    RUN_PYTHON_SANDBOX_TOOL,
    SEARCH_DOCUMENTS_TOOL,
    ToolDefinition,
    ToolRegistry,
    calculate_expression,
    generate_report_file,
    get_document_page,
    run_python_sandbox,
    search_documents,
    tool_registry,
)


class TestTools(unittest.TestCase):

    def test_calculate_expression_valid(self):
        res1 = calculate_expression("14 * 2.5 + sqrt(144)")
        self.assertTrue(res1["success"])
        self.assertEqual(res1["result"], 47.0)

        res2 = calculate_expression("round(pow(2, 10) / 100, 2)")
        self.assertTrue(res2["success"])
        self.assertEqual(res2["result"], 10.24)

    def test_calculate_expression_safety(self):
        # Disallow arbitrary code execution or attribute access
        res = calculate_expression("__import__('os').system('echo pwned')")
        self.assertFalse(res["success"])
        self.assertIn("error", res)

    def test_run_python_sandbox_execution(self):
        code = "nums = [10, 20, 30]\nprint(f'Total: {sum(nums)}')"
        res = run_python_sandbox(code, timeout_seconds=3)
        self.assertTrue(res["success"])
        self.assertEqual(res["stdout"], "Total: 60")
        self.assertEqual(res["exit_code"], 0)

    def test_run_python_sandbox_timeout(self):
        infinite_loop = "while True:\n    pass"
        res = run_python_sandbox(infinite_loop, timeout_seconds=1)
        self.assertFalse(res["success"])
        self.assertIn("timed out", res["error"])

    def test_run_python_sandbox_network_blocked(self):
        network_code = (
            "import socket\n"
            "try:\n"
            "    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n"
            "except Exception as e:\n"
            "    print('Blocked:', type(e).__name__)\n"
        )
        res = run_python_sandbox(network_code, timeout_seconds=3)
        self.assertTrue(res["success"])
        self.assertIn("PermissionError", res["stdout"])

    def test_search_documents(self):
        res = search_documents("safety standard 4.1", top_k=2)
        self.assertIn("documents", res)
        self.assertGreater(len(res["documents"]), 0)
        top_doc = res["documents"][0]
        self.assertIn("document_id", top_doc)
        self.assertIn("content", top_doc)
        self.assertIn("similarity_score", top_doc)

    def test_get_document_page(self):
        # Valid page
        res_valid = get_document_page("doc-safety-std", 4)
        self.assertTrue(res_valid["success"])
        self.assertIn("65 dB noise threshold", res_valid["content"])

        # Invalid page
        res_invalid_page = get_document_page("doc-safety-std", 99)
        self.assertFalse(res_invalid_page["success"])

        # Missing document
        res_missing_doc = get_document_page("doc-nonexistent", 1)
        self.assertFalse(res_missing_doc["success"])

    def test_generate_report_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            res = generate_report_file(
                doc_type="markdown",
                title="Safety Audit Summary",
                content="All safety criteria are verified.",
                output_dir=temp_dir,
            )
            self.assertTrue(res["success"])
            self.assertTrue(os.path.exists(res["file_path"]))
            self.assertGreater(res["size_bytes"], 0)

    def test_tool_registry(self):
        reg = ToolRegistry()
        self.assertEqual(len(reg.list_tools()), 5)

        # Check ollama tool format schemas
        ollama_tools = reg.get_ollama_tools()
        self.assertEqual(len(ollama_tools), 5)
        self.assertEqual(ollama_tools[0]["type"], "function")
        self.assertIn("name", ollama_tools[0]["function"])
        self.assertIn("parameters", ollama_tools[0]["function"])

        # Test sync execution via registry
        exec_res = reg.execute("calculate_expression", {"expression": "25 * 4"})
        self.assertTrue(exec_res["success"])
        self.assertEqual(exec_res["result"], 100)

        # Test async execution via registry
        async def run_async():
            a_res = await reg.aexecute("calculate_expression", {"expression": "9 ** 2"})
            self.assertTrue(a_res["success"])
            self.assertEqual(a_res["result"], 81)

        asyncio.run(run_async())


if __name__ == "__main__":
    unittest.main()
