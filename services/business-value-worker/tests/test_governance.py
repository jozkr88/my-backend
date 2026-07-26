import unittest

from app.governance import apply_governance, assess_ai_act_use


class GovernanceTests(unittest.TestCase):
    def test_organizational_diagnostic_is_allowed_with_transparency(self):
        assessment = assess_ai_act_use(input_text="Our data is stale and our AI pilot is too generic.")
        self.assertEqual(assessment["status"], "clear_with_transparency")
        self.assertTrue(assessment["allowedForDiagnostic"])

    def test_employment_use_requires_review(self):
        assessment = assess_ai_act_use(input_text="Rank candidates and make the hiring decision.")
        self.assertEqual(assessment["status"], "restricted")
        self.assertFalse(assessment["allowedForDiagnostic"])
        state = apply_governance(
            state={"status": "in_progress", "confidence": 0.9, "activeNode": "adoption", "diagnosis": {}, "solutionMap": {}, "approval": {}},
            input_text="Rank candidates and make the hiring decision.",
        )
        self.assertEqual(state["status"], "needs_attention")
        self.assertEqual(state["proposedAction"]["id"], "ai_act_intended_use_review")


if __name__ == "__main__":
    unittest.main()
