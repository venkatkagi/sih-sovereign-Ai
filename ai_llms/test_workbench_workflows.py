import asyncio
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from ai_llms.api import app
from ai_llms.workspace_manager import WorkspaceSecurityError, workspace_manager
from ai_llms.workflows import (
    run_coding_sandbox_workflow,
    run_document_approval_workflow,
    run_multimodal_analysis_workflow,
)


class TestWorkbenchWorkflows(unittest.TestCase):
    """Integration & Unit tests for Sovereign AI Local Workbench."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Ensure sample files exist
        workspace_manager._ensure_structure()
        workspace_manager._seed_sample_documents()

    def test_workspace_traversal_protection(self):
        """Verify strict directory traversal prevention."""
        with self.assertRaises(WorkspaceSecurityError):
            workspace_manager.resolve_safe_path("../../etc/passwd")

        with self.assertRaises(WorkspaceSecurityError):
            workspace_manager.resolve_safe_path("../../../../../bin/bash")

        # Legitimate path
        safe_path = workspace_manager.resolve_safe_path("documents/inspection_report.pdf")
        self.assertTrue(str(safe_path).startswith(str(workspace_manager.root)))

    def test_workspace_tree_api(self):
        """Verify GET /api/v1/workspace/tree returns standard folder structure."""
        resp = self.client.get("/api/v1/workspace/tree")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("directories", data)
        subdirs = [d["name"] for d in data["directories"]]
        self.assertIn("documents", subdirs)
        self.assertIn("output", subdirs)
        self.assertIn("sandbox", subdirs)

    def test_workspace_upload_and_delete_api(self):
        """Verify file upload to workspace and safe deletion."""
        test_content = b"Mock telemetry and pipe inspection report."
        files = {"file": ("test_pipe_log.txt", test_content, "text/plain")}
        data = {"subdir": "input"}
        
        upload_resp = self.client.post("/api/v1/workspace/upload", files=files, data=data)
        self.assertEqual(upload_resp.status_code, 200)
        json_data = upload_resp.json()
        self.assertEqual(json_data["filename"], "test_pipe_log.txt")
        self.assertEqual(json_data["relative_path"], "input/test_pipe_log.txt")

        # Verify file download
        dl_resp = self.client.get("/api/v1/workspace/file?path=input/test_pipe_log.txt")
        self.assertEqual(dl_resp.status_code, 200)
        self.assertEqual(dl_resp.content, test_content)

        # Verify safe deletion
        del_resp = self.client.delete("/api/v1/workspace/file?path=input/test_pipe_log.txt")
        self.assertEqual(del_resp.status_code, 200)

    def test_document_approval_workflow_and_docx_generation(self):
        """Verify Demo 1: Scanned PDF -> OCR -> Findings -> Approval Note -> Real .docx."""
        sample_doc = "documents/inspection_report.pdf"
        res = asyncio.run(run_document_approval_workflow(sample_doc))
        
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["task_type"], "DOCUMENT_APPROVAL")
        self.assertIn("findings", res)
        self.assertIn("approval_note_markdown", res)
        self.assertIn("generated_artifact", res)
        
        artifact = res["generated_artifact"]
        self.assertTrue(artifact["name"].endswith(".docx"))
        self.assertTrue(os.path.exists(artifact["full_path"]))
        self.assertGreater(artifact["size_bytes"], 100)

        # Verify steps timeline
        step_names = [s["name"] for s in res["steps"]]
        self.assertIn("Document Loaded", step_names)
        self.assertIn("OCR / Vision Processed", step_names)
        self.assertIn("Findings Extracted", step_names)
        self.assertIn("Approval Note Drafted", step_names)
        self.assertIn("DOCX Generated", step_names)

    def test_coding_sandbox_workflow_execution(self):
        """Verify Demo 2: Coding problem -> Code generation -> Isolated sandbox execution -> Verified output."""
        prompt = "Write a Python program to calculate pressure drop using the Darcy-Weisbach equation."
        res = asyncio.run(run_coding_sandbox_workflow(prompt=prompt, timeout_seconds=5))
        
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["task_type"], "CODING_SANDBOX")
        self.assertIn("generated_code", res)
        self.assertIn("execution_result", res)
        
        exec_res = res["execution_result"]
        self.assertTrue(exec_res["success"])
        self.assertEqual(exec_res["exit_code"], 0)
        self.assertTrue(exec_res["verified"])
        self.assertIn("DARCY-WEISBACH", exec_res["stdout"].upper())

    def test_multimodal_workflow(self):
        """Verify Demo 3: Image / PDF -> Vision model analysis."""
        sample_img = "documents/inspection_report.pdf"
        res = asyncio.run(run_multimodal_analysis_workflow(sample_img))
        
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["task_type"], "MULTIMODAL_VISION")
        self.assertIn("visual_analysis", res)
        self.assertIn("steps", res)


if __name__ == "__main__":
    unittest.main()
