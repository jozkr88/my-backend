import importlib.util
from typing import Any


DEPENDENCY_MODULES = {
    "networkx": "networkx",
    "dowhy_gcm": "dowhy",
    "causal_learn": "causallearn",
    "tigramite": "tigramite",
}


def dependency_capabilities() -> dict[str, bool]:
    return {
        name: importlib.util.find_spec(module) is not None
        for name, module in DEPENDENCY_MODULES.items()
    }


def infer_query_type(query: str, requested: str = "unknown") -> str:
    if requested and requested != "unknown":
        return requested
    text = query.lower()
    if any(term in text for term in ("would have", "if we had", "counterfactual", "instead")):
        return "counterfactual"
    if any(term in text for term in ("what if", "intervene", "change", "increase", "decrease")):
        return "intervention"
    if any(term in text for term in ("should we", "which action", "recommend", "decision")):
        return "decision"
    if any(term in text for term in ("cause", "related", "pattern", "correlat", "associated")):
        return "association"
    return "unknown"


def build_analysis(request: Any) -> dict[str, Any]:
    capabilities = dependency_capabilities()
    query_type = infer_query_type(request.query, request.query_type)
    provenance = [
        {
            "title": item.title,
            "source": item.source,
            "verification": item.verification,
        }
        for item in request.evidence
        if item.title or item.source
    ]

    limitations = [
        "No causal effect was estimated because no versioned dataset, treatment, outcome, and assumptions were supplied.",
        "Graph relationships remain associative or hypothetical until validated by causal identification and refutation.",
    ]
    if query_type in {"intervention", "counterfactual", "decision"}:
        recommendation = "Collect or select a versioned causal model and explicit assumptions before making this claim."
        claim_status = "causal_analysis_required"
    else:
        recommendation = "Use retrieved evidence as association-level context and avoid causal language."
        claim_status = "association_only"

    return {
        "mode": "shadow_advisory",
        "query_type": query_type,
        "status": "not_executed",
        "claim_status": claim_status,
        "recommendation": recommendation,
        "capabilities": capabilities,
        "assumptions": [],
        "limitations": limitations,
        "provenance": provenance[:12],
    }
