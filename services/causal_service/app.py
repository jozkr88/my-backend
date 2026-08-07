import os

from fastapi import Depends, FastAPI, Header, HTTPException

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


def require_service_auth(authorization: str | None = Header(default=None)) -> None:
    expected_token = os.getenv("CAUSAL_SERVICE_TOKEN", "").strip()
    if expected_token and authorization != f"Bearer {expected_token}":
        raise HTTPException(status_code=401, detail="causal_service_unauthorized")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "joz-causal-service",
        "capabilities": dependency_capabilities(),
    }


@app.get("/v1/capabilities", dependencies=[Depends(require_service_auth)])
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


@app.post("/v1/graph/validate", dependencies=[Depends(require_service_auth)])
def graph_validate(request: GraphValidateRequest) -> dict:
    return validate_dag(
        [node.model_dump() for node in request.nodes],
        [edge.model_dump() for edge in request.edges],
    )


@app.post("/v1/analyze", response_model=CausalAnalysisResponse, dependencies=[Depends(require_service_auth)])
def analyze(request: CausalAnalysisRequest) -> CausalAnalysisResponse:
    return CausalAnalysisResponse(**build_analysis(request))


@app.post("/v1/causal/intervene", dependencies=[Depends(require_service_auth)])
def intervene(request: CausalRunRequest) -> dict:
    return run_intervention(request)


@app.post("/v1/causal/effect", dependencies=[Depends(require_service_auth)])
def effect(request: CausalEffectRequest) -> dict:
    return run_effect_estimation(request)


@app.post("/v1/causal/counterfactual", dependencies=[Depends(require_service_auth)])
def counterfactual(request: CausalCounterfactualRequest) -> dict:
    return run_counterfactual(request)


@app.post("/v1/causal/refute", dependencies=[Depends(require_service_auth)])
def refute(request: CausalRefutationRequest) -> dict:
    return run_refutation(request)


@app.post("/v1/causal/discover", dependencies=[Depends(require_service_auth)])
def discover(request: DiscoveryRequest) -> dict:
    return discover_candidates(request)
