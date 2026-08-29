import asyncio
import os
import shutil
import tempfile
import unittest
from backend.ai.tools import (
    CALCULATE_EXPRESSION_TOOL,
    GENERATE_REPORT_FILE_TOOL,
    GET_DOCUMENT_PAGE_TOOL,
    RUN_PYTHON_SANDBOX_TOOL,
    SEARCH_DOCUMENTS_TOOL,
    ToolDefinition,
    ToolRegistry,
    calculate_expression,
    create_excel_spreadsheet,
    create_pdf_document,
    edit_excel_spreadsheet,
    edit_pdf_document,
    generate_report_file,
    get_document_page,
    read_workspace_document,
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
        self.assertGreaterEqual(len(reg.list_tools()), 5)

        # Check ollama tool format schemas
        ollama_tools = reg.get_ollama_tools()
        self.assertGreaterEqual(len(ollama_tools), 5)
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


    def test_pdf_creation_and_editing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            # 1. Create PDF
            pdf_res = create_pdf_document(
                title="Safety Inspection Report",
                content="# Section 1: Findings\n- Valve inspected\n- All safety criteria met.",
                output_filename="test_report.pdf",
                output_dir=temp_dir,
            )
            self.assertTrue(pdf_res["success"])
            self.assertTrue(os.path.exists(pdf_res["file_path"]))

            # 2. Edit PDF (Watermark & Append Page)
            edit_res = edit_pdf_document(
                file_path=pdf_res["file_path"],
                output_filename="test_report_annotated.pdf",
                watermark_text="AUDITED & APPROVED",
                header_text="VaultMind Official Review",
                footer_text="Page 1 | Verified",
                append_text="# Appendix A\nAdditional verified compliance metrics.",
                output_dir=temp_dir,
            )
            self.assertTrue(edit_res["success"])
            self.assertTrue(os.path.exists(edit_res["file_path"]))
            self.assertGreater(edit_res["size_bytes"], 100)

            # 3. Read edited PDF via read_workspace_document
            read_res = read_workspace_document(edit_res["file_path"])
            self.assertTrue(read_res["success"])
            self.assertIn("Safety Inspection", read_res["content"])

    def test_excel_creation_and_editing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            # 1. Create Excel spreadsheet
            xls_res = create_excel_spreadsheet(
                title="Equipment Inventory",
                headers=["ID", "Name", "Cost", "Status"],
                rows=[
                    ["EQ-01", "Centrifugal Pump", 4500.0, "Operational"],
                    ["EQ-02", "Pressure Relief Valve", 850.0, "Pending Inspection"],
                ],
                output_filename="inventory.xlsx",
                output_dir=temp_dir,
            )
            self.assertTrue(xls_res["success"])
            self.assertTrue(os.path.exists(xls_res["file_path"]))

            # 2. Edit Excel spreadsheet (Update cells & Append rows)
            edit_res = edit_excel_spreadsheet(
                file_path=xls_res["file_path"],
                cell_updates={"D3": "Approved & Certified"},
                append_rows=[["EQ-03", "Heat Exchanger", 12000.0, "Operational"]],
            )
            self.assertTrue(edit_res["success"])
            self.assertEqual(edit_res["updated_cells_count"], 1)
            self.assertEqual(edit_res["appended_rows_count"], 1)

            # 3. Read spreadsheet via read_workspace_document
            read_res = read_workspace_document(xls_res["file_path"])
            self.assertTrue(read_res["success"])
            self.assertIn("Centrifugal Pump", read_res["content"])
            self.assertIn("Heat Exchanger", read_res["content"])


if __name__ == "__main__":
    unittest.main()
