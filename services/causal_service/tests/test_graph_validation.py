import unittest

from services.causal_service.graph_validation import validate_dag


class GraphValidationTests(unittest.TestCase):
    def test_accepts_acyclic_graph(self):
        result = validate_dag(
            [{"id": "price"}, {"id": "demand"}],
            [{"source": "price", "target": "demand"}],
        )
        self.assertTrue(result["valid"])

    def test_rejects_cycle(self):
        result = validate_dag(
            [{"id": "a"}, {"id": "b"}],
            [
                {"source": "a", "target": "b"},
                {"source": "b", "target": "a"},
            ],
        )
        self.assertFalse(result["valid"])

    def test_runs_intervention_with_dowhy_gcm(self):
        from services.causal_service.gcm_runner import run_intervention
        from services.causal_service.schemas import CausalRunRequest

        data = [{"price": float(index), "demand": 100 - (2 * index)} for index in range(30)]
        request = CausalRunRequest(
            nodes=[{"id": "price"}, {"id": "demand"}],
            edges=[{"source": "price", "target": "demand", "type": "CAUSES"}],
            data=data,
            interventions={"price": 10.0},
            target="demand",
            samples=100,
        )
        result = run_intervention(request)
        self.assertEqual(result["status"], "estimated")
        self.assertEqual(result["target"], "demand")
        self.assertEqual(result["sample_count"], 100)

    def test_estimates_effect_with_dowhy_gcm(self):
        from services.causal_service.gcm_runner import run_effect_estimation
        from services.causal_service.schemas import CausalEffectRequest

        data = [{"treatment": float(index % 2), "outcome": float((index % 2) * 3 + index * 0.01)} for index in range(40)]
        request = CausalEffectRequest(
            nodes=[{"id": "treatment"}, {"id": "outcome"}],
            edges=[{"source": "treatment", "target": "outcome", "type": "CAUSES"}],
            data=data,
            treatment="treatment",
            outcome="outcome",
            treatment_value=1.0,
            control_value=0.0,
            samples=100,
        )
        result = run_effect_estimation(request)
        self.assertEqual(result["status"], "estimated")
        self.assertEqual(result["operation"], "effect_estimation")
        self.assertGreater(result["average_treatment_effect"], 2.0)

    def test_runs_counterfactual_with_factual_row(self):
        from services.causal_service.gcm_runner import run_counterfactual
        from services.causal_service.schemas import CausalCounterfactualRequest

        data = [{"price": float(index), "demand": 100 - (2 * index)} for index in range(30)]
        request = CausalCounterfactualRequest(
            nodes=[{"id": "price"}, {"id": "demand"}],
            edges=[{"source": "price", "target": "demand", "type": "CAUSES"}],
            data=data,
            factual={"price": 10.0, "demand": 80.0},
            intervention_variable="price",
            intervention_value=5.0,
            target="demand",
        )
        result = run_counterfactual(request)
        self.assertEqual(result["status"], "estimated")
        self.assertEqual(result["operation"], "counterfactual")
        self.assertGreater(result["counterfactual_value"], result["factual_value"])

    def test_refutes_or_does_not_refute_graph_with_explicit_test_status(self):
        from services.causal_service.gcm_runner import run_refutation
        from services.causal_service.schemas import CausalRefutationRequest

        request = CausalRefutationRequest(
            nodes=[{"id": "price"}, {"id": "demand"}],
            edges=[{"source": "price", "target": "demand", "type": "CAUSES"}],
            data=[{"price": float(index), "demand": 100 - (2 * index)} for index in range(30)],
            significance_level=0.05,
        )
        result = run_refutation(request)
        self.assertIn(result["status"], {"refuted", "not_refuted"})
        self.assertIn(result["rejection_result"], {"REJECTED", "NOT_REJECTED"})
        self.assertTrue(result["warnings"])

    def test_runs_temporal_candidate_discovery(self):
        from services.causal_service.discovery import discover_candidates
        from services.causal_service.schemas import DiscoveryRequest

        request = DiscoveryRequest(
            method="pcmci",
            tau_max=1,
            data=[
                {"price": float(index), "demand": float(100 - (2 * index))}
                for index in range(30)
            ],
        )
        result = discover_candidates(request)
        self.assertEqual(result["method"], "tigramite.pcmci")
        self.assertTrue(all(candidate["status"] == "DISCOVERED_ASSOCIATION" for candidate in result["candidates"]))

    def test_runs_tabular_candidate_discovery(self):
        from services.causal_service.discovery import discover_candidates
        from services.causal_service.schemas import DiscoveryRequest

        request = DiscoveryRequest(
            method="pc",
            data=[
                {
                    "signal": float(index),
                    "outcome": float((3 * index) + (index % 5)),
                    "noise": float((index * 7) % 11),
                }
                for index in range(40)
            ],
        )
        result = discover_candidates(request)
        self.assertEqual(result["method"], "causal-learn.pc")
        self.assertTrue(all(candidate["status"] == "DISCOVERED_ASSOCIATION" for candidate in result["candidates"]))


if __name__ == "__main__":
    unittest.main()
