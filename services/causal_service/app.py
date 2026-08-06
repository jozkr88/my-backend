from fastapi import FastAPI

from .adapters import build_analysis, dependency_capabilities
from .graph_validation import validate_dag
from .gcm_runner import run_counterfactual, run_effect_estimation, run_intervention, run_refutation
from .discovery import discover_candidates
from .schemas import (
    CausalAnalysisRequest,
    CausalAnalysisResponse,
    CausalEffectRequest,
    CausalCounterfactualRequest,
    CausalRefutationRequest,
    CausalRunRequest,
    DiscoveryRequest,
    GraphValidateRequest,
)


app = FastAPI(
    title="Joz Causal Decision Service",
    version="0.1.0",
    description="Validation and causal-analysis boundary for Joz LLM.",
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "joz-causal-service",
        "capabilities": dependency_capabilities(),
    }


@app.get("/v1/capabilities")
def capabilities() -> dict:
    return {
        "schema_version": "joz.causal-capabilities.v1",
        "capabilities": dependency_capabilities(),
        "supported_operations": [
            "graph_validate",
            "causal_discovery",
            "effect_estimation",
            "refutation",
            "counterfactuals",
        ],
    }


@app.post("/v1/graph/validate")
def graph_validate(request: GraphValidateRequest) -> dict:
    return validate_dag(
        [node.model_dump() for node in request.nodes],
        [edge.model_dump() for edge in request.edges],
    )


@app.post("/v1/analyze", response_model=CausalAnalysisResponse)
def analyze(request: CausalAnalysisRequest) -> CausalAnalysisResponse:
    return CausalAnalysisResponse(**build_analysis(request))


@app.post("/v1/causal/intervene")
def intervene(request: CausalRunRequest) -> dict:
    return run_intervention(request)


@app.post("/v1/causal/effect")
def effect(request: CausalEffectRequest) -> dict:
    return run_effect_estimation(request)


@app.post("/v1/causal/counterfactual")
def counterfactual(request: CausalCounterfactualRequest) -> dict:
    return run_counterfactual(request)


@app.post("/v1/causal/refute")
def refute(request: CausalRefutationRequest) -> dict:
    return run_refutation(request)


@app.post("/v1/causal/discover")
def discover(request: DiscoveryRequest) -> dict:
    return discover_candidates(request)
