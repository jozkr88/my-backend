import base64
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.diagnostic import build_diagnostic_state
from app.extraction import extract_text


class WorkerCoreTests(unittest.TestCase):
    def test_diagnostic_stays_hypothesis_until_review(self):
        state = build_diagnostic_state(input_text="Our AI outputs are too generic and users do not trust them.")
        self.assertEqual(state["activeNode"], "adoption")
        self.assertEqual(state["status"], "in_progress")
        self.assertTrue(state["diagnosis"]["notYetVerified"])


    def test_verified_evidence_can_complete_reviewed_case(self):
        records = [
            {"evidenceKey": "data.source_of_truth", "node": "data", "verificationStatus": "verified"},
            {"evidenceKey": "data.data_owner", "node": "data", "verificationStatus": "verified"},
            {"evidenceKey": "data.freshness", "node": "data", "verificationStatus": "verified"},
            {"evidenceKey": "data.verification", "node": "data", "verificationStatus": "verified"},
        ]
        state = build_diagnostic_state(
            current_mesh="data",
            evidence_records=records,
            review_approved=True,
        )
        self.assertEqual(state["status"], "verified")
        self.assertTrue(state["completed"])

    def test_conversation_confirmation_can_verify_claimed_conversational_evidence(self):
        state = build_diagnostic_state(
            messages=[
                {"role": "user", "content": "The source of truth is our finance warehouse."},
                {"role": "user", "content": "Finance owns it, data is fresh daily, and the result is reconciled."},
            ],
            current_mesh="data",
            input_text="The diagnosis is right; confirmed.",
        )
        self.assertEqual(state["status"], "verified")


    def test_text_file_extraction_is_bounded_and_typed(self):
        content, document_format, byte_count = extract_text(
            "notes.txt",
            "text/plain",
            base64.b64encode(b"Finance owns the source of truth.").decode(),
        )
        self.assertEqual(document_format, "text")
        self.assertIn("source of truth", content)
        self.assertGreater(byte_count, 0)
