import unittest
from pathlib import Path

from backend.chunking.chunker import chunk_text
from backend.ingestion.loader import load_document_pages
from backend.metadata.parser import extract_metadata


TEST_DOCUMENT = Path("data/test_documents/ocr_scanned.pdf")


class CorePipelineTests(unittest.TestCase):

    def test_chunking(self):
        text = "word " * 1000

        chunks = chunk_text(text)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.text for chunk in chunks))

    def test_metadata_extraction(self):
        text = """
        Document ID: OCR-000001
        Equipment Tag: PU-000001
        Equipment: Centrifugal Pump
        Plant: Chennai Refinery
        Inspection Finding: seal leakage detected during inspection
        """

        metadata = extract_metadata(text)

        self.assertEqual(metadata["document_id"], "OCR-000001")
        self.assertEqual(metadata["equipment_tag"], "PU-000001")
        self.assertEqual(metadata["equipment"], "Centrifugal Pump")
        self.assertEqual(metadata["plant"], "Chennai Refinery")
        self.assertEqual(
            metadata["finding"],
            "seal leakage detected during inspection",
        )

    def test_scanned_pdf_ocr(self):
        pages = load_document_pages(TEST_DOCUMENT)

        self.assertEqual(len(pages), 1)
        self.assertTrue(pages[0].ocr_used)
        self.assertIn("PU-000001", pages[0].text)
        self.assertIn(
            "seal leakage detected during inspection",
            pages[0].text,
        )


if __name__ == "__main__":
    unittest.main()
