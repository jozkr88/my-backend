from typing import Any, Literal

from pydantic import BaseModel, Field


QueryType = Literal["association", "intervention", "counterfactual", "decision", "unknown"]


class GraphNode(BaseModel):
    id: str = Field(min_length=1, max_length=240)
    type: str = Field(default="entity", max_length=80)
    label: str | None = Field(default=None, max_length=240)


class GraphEdge(BaseModel):
    source: str = Field(min_length=1, max_length=240)
    target: str = Field(min_length=1, max_length=240)
    type: str = Field(default="RELATED_TO", max_length=100)
    status: str | None = Field(default=None, max_length=80)


class GraphValidateRequest(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list, max_length=5000)
    edges: list[GraphEdge] = Field(default_factory=list, max_length=10000)


class CausalEvidence(BaseModel):
    title: str | None = None
    summary: str | None = None
    source: str | None = None
    verification: str | None = None


class CausalAnalysisRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    query_type: QueryType = "unknown"
    graph_evidence: dict[str, Any] = Field(default_factory=dict)
    evidence: list[CausalEvidence] = Field(default_factory=list, max_length=12)


class CausalAnalysisResponse(BaseModel):
    schema_version: str = "joz.causal-analysis.v1"
    mode: str
    query_type: QueryType
    status: str
    claim_status: str
    recommendation: str
    capabilities: dict[str, bool]
    assumptions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    provenance: list[dict[str, Any]] = Field(default_factory=list)


class CausalRunRequest(BaseModel):
    nodes: list[GraphNode] = Field(min_length=2, max_length=200)
    edges: list[GraphEdge] = Field(min_length=1, max_length=1000)
    data: list[dict[str, float]] = Field(min_length=20, max_length=100000)
    interventions: dict[str, float] = Field(min_length=1, max_length=20)
    target: str = Field(min_length=1, max_length=240)
    samples: int = Field(default=1000, ge=100, le=10000)


class CausalEffectRequest(BaseModel):
    nodes: list[GraphNode] = Field(min_length=2, max_length=200)
    edges: list[GraphEdge] = Field(min_length=1, max_length=1000)
    data: list[dict[str, float]] = Field(min_length=20, max_length=100000)
    treatment: str = Field(min_length=1, max_length=240)
    outcome: str = Field(min_length=1, max_length=240)
    treatment_value: float
    control_value: float
    samples: int = Field(default=1000, ge=100, le=10000)


class CausalCounterfactualRequest(BaseModel):
    nodes: list[GraphNode] = Field(min_length=2, max_length=200)
    edges: list[GraphEdge] = Field(min_length=1, max_length=1000)
    data: list[dict[str, float]] = Field(min_length=20, max_length=100000)
    factual: dict[str, float] = Field(min_length=1, max_length=200)
    intervention_variable: str = Field(min_length=1, max_length=240)
    intervention_value: float
    target: str = Field(min_length=1, max_length=240)


class CausalRefutationRequest(BaseModel):
    nodes: list[GraphNode] = Field(min_length=2, max_length=200)
    edges: list[GraphEdge] = Field(min_length=1, max_length=1000)
    data: list[dict[str, float]] = Field(min_length=20, max_length=100000)
    significance_level: float = Field(default=0.05, gt=0.001, lt=0.5)


class DiscoveryRequest(BaseModel):
    data: list[dict[str, float]] = Field(min_length=20, max_length=100000)
    method: Literal["pc", "pcmci"] = "pc"
    alpha: float = Field(default=0.05, gt=0, lt=1)
    tau_max: int = Field(default=2, ge=0, le=30)
