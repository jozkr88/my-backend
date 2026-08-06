import os
from typing import Any

import numpy as np
import pandas as pd

from .graph_validation import validate_dag

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")


def _summary(values: pd.Series) -> dict[str, float | int]:
    numeric = pd.to_numeric(values, errors="coerce").dropna()
    if numeric.empty:
        return {"count": 0}
    return {
        "count": int(numeric.size),
        "mean": float(numeric.mean()),
        "std": float(numeric.std(ddof=0)),
        "p05": float(numeric.quantile(0.05)),
        "p50": float(numeric.quantile(0.50)),
        "p95": float(numeric.quantile(0.95)),
    }


def run_intervention(request: Any) -> dict[str, Any]:
    try:
        import networkx as nx
        from dowhy import gcm
    except ImportError as error:
        raise RuntimeError(f"causal_dependencies_unavailable:{error}") from error

    nodes = [node.model_dump() for node in request.nodes]
    edges = [edge.model_dump() for edge in request.edges]
    validation = validate_dag(nodes, edges)
    if not validation["valid"]:
        raise ValueError("causal_graph_invalid")

    graph = nx.DiGraph()
    graph.add_nodes_from(node["id"] for node in nodes)
    graph.add_edges_from((edge["source"], edge["target"]) for edge in edges)
    data = pd.DataFrame(request.data)
    expected_columns = {node["id"] for node in nodes}
    missing_columns = sorted(expected_columns - set(data.columns))
    if missing_columns:
        raise ValueError(f"causal_data_missing_columns:{','.join(missing_columns)}")
    if request.target not in data.columns:
        raise ValueError("causal_target_missing")
    if any(variable not in graph.nodes for variable in request.interventions):
        raise ValueError("intervention_references_unknown_node")

    model = gcm.StructuralCausalModel(graph)
    # Keep the service deterministic and compatible with restricted containers
    # that do not expose POSIX semaphore primitives for joblib workers.
    gcm.config.set_default_n_jobs(1)
    gcm.config.disable_progress_bars()
    gcm.auto.assign_causal_mechanisms(model, data)
    gcm.fit(model, data)

    intervention_functions = {
        variable: (lambda _values, value=value: np.full(np.asarray(_values).shape, value, dtype=float))
        for variable, value in request.interventions.items()
    }
    simulated = gcm.interventional_samples(
        model,
        intervention_functions,
        num_samples_to_draw=request.samples,
    )

    return {
        "schema_version": "joz.causal-run.v1",
        "status": "estimated",
        "operation": "intervention",
        "target": request.target,
        "interventions": request.interventions,
        "sample_count": int(len(simulated)),
        "target_summary": _summary(simulated[request.target]),
        "graph_validation": validation,
        "assumptions": [
            "The supplied DAG is treated as the structural causal graph.",
            "The observed data is representative of the modeled regime.",
            "The intervention values are within the model's supported domain.",
        ],
    }


def run_effect_estimation(request: Any) -> dict[str, Any]:
    try:
        import networkx as nx
        from dowhy import gcm
    except ImportError as error:
        raise RuntimeError(f"causal_dependencies_unavailable:{error}") from error

    nodes = [node.model_dump() for node in request.nodes]
    edges = [edge.model_dump() for edge in request.edges]
    validation = validate_dag(nodes, edges)
    if not validation["valid"]:
        raise ValueError("causal_graph_invalid")

    graph = nx.DiGraph()
    graph.add_nodes_from(node["id"] for node in nodes)
    graph.add_edges_from((edge["source"], edge["target"]) for edge in edges)
    data = pd.DataFrame(request.data)
    expected_columns = {node["id"] for node in nodes}
    missing_columns = sorted(expected_columns - set(data.columns))
    if missing_columns:
        raise ValueError(f"causal_data_missing_columns:{','.join(missing_columns)}")
    if request.treatment not in graph.nodes or request.outcome not in graph.nodes:
        raise ValueError("effect_references_unknown_node")
    if request.treatment not in data.columns or request.outcome not in data.columns:
        raise ValueError("effect_data_missing_columns")

    model = gcm.StructuralCausalModel(graph)
    gcm.config.set_default_n_jobs(1)
    gcm.config.disable_progress_bars()
    gcm.auto.assign_causal_mechanisms(model, data)
    gcm.fit(model, data)

    def intervention_samples(value: float) -> pd.Series:
        intervention_functions = {
            request.treatment: lambda _values, value=value: np.full(
                np.asarray(_values).shape, value, dtype=float
            )
        }
        simulated = gcm.interventional_samples(
            model,
            intervention_functions,
            num_samples_to_draw=request.samples,
        )
        return pd.to_numeric(simulated[request.outcome], errors="coerce").dropna()

    treated = intervention_samples(request.treatment_value)
    control = intervention_samples(request.control_value)
    if treated.empty or control.empty:
        raise ValueError("effect_simulation_empty")

    effect_samples = treated.to_numpy() - control.to_numpy()
    effect = float(np.mean(effect_samples))
    standard_error = float(np.std(effect_samples, ddof=0) / np.sqrt(len(effect_samples)))
    return {
        "schema_version": "joz.causal-effect.v1",
        "status": "estimated",
        "operation": "effect_estimation",
        "treatment": request.treatment,
        "outcome": request.outcome,
        "treatment_value": request.treatment_value,
        "control_value": request.control_value,
        "average_treatment_effect": effect,
        "standard_error": standard_error,
        "sample_count": int(min(len(treated), len(control))),
        "treated_summary": _summary(treated),
        "control_summary": _summary(control),
        "graph_validation": validation,
        "assumptions": [
            "The supplied DAG is treated as the structural causal graph.",
            "The observed data is representative of the modeled regime.",
            "Treatment and control values are within the model's supported domain.",
            "The reported effect is model-based and should be refuted before high-impact use.",
        ],
    }


def run_counterfactual(request: Any) -> dict[str, Any]:
    try:
        import networkx as nx
        from dowhy import gcm
    except ImportError as error:
        raise RuntimeError(f"causal_dependencies_unavailable:{error}") from error

    nodes = [node.model_dump() for node in request.nodes]
    edges = [edge.model_dump() for edge in request.edges]
    validation = validate_dag(nodes, edges)
    if not validation["valid"]:
        raise ValueError("causal_graph_invalid")

    graph = nx.DiGraph()
    graph.add_nodes_from(node["id"] for node in nodes)
    graph.add_edges_from((edge["source"], edge["target"]) for edge in edges)
    data = pd.DataFrame(request.data)
    expected_columns = {node["id"] for node in nodes}
    missing_columns = sorted(expected_columns - set(data.columns))
    if missing_columns:
        raise ValueError(f"causal_data_missing_columns:{','.join(missing_columns)}")
    if request.intervention_variable not in graph.nodes or request.target not in graph.nodes:
        raise ValueError("counterfactual_references_unknown_node")
    if request.intervention_variable not in data.columns or request.target not in data.columns:
        raise ValueError("counterfactual_data_missing_columns")
    missing_factual = sorted(expected_columns - set(request.factual.keys()))
    if missing_factual:
        raise ValueError(f"counterfactual_factual_data_missing_columns:{','.join(missing_factual)}")

    model = gcm.InvertibleStructuralCausalModel(graph)
    gcm.config.set_default_n_jobs(1)
    gcm.config.disable_progress_bars()
    gcm.auto.assign_causal_mechanisms(model, data)
    gcm.fit(model, data)

    factual = pd.DataFrame([request.factual], columns=sorted(expected_columns))
    interventions = {
        request.intervention_variable: lambda _values, value=request.intervention_value: np.full(
            np.asarray(_values).shape, value, dtype=float
        )
    }
    simulated = gcm.counterfactual_samples(model, interventions, observed_data=factual)
    factual_value = float(factual[request.target].iloc[0])
    counterfactual_value = float(simulated[request.target].iloc[0])
    return {
        "schema_version": "joz.counterfactual.v1",
        "status": "estimated",
        "operation": "counterfactual",
        "target": request.target,
        "intervention": {
            "variable": request.intervention_variable,
            "value": request.intervention_value,
        },
        "factual_value": factual_value,
        "counterfactual_value": counterfactual_value,
        "delta": counterfactual_value - factual_value,
        "sample_count": 1,
        "uncertainty": {
            "status": "not_estimated_for_single_unit",
            "note": "This is an individual-level counterfactual under the fitted model; population uncertainty requires a separate uncertainty analysis.",
        },
        "graph_validation": validation,
        "assumptions": [
            "The supplied DAG is treated as the structural causal graph.",
            "The factual row is a valid observation from the modeled regime.",
            "The structural mechanisms are invertible enough for abduction from the factual row.",
            "The intervention is well-defined and within the model's supported domain.",
        ],
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return float(value)
    return value


def run_refutation(request: Any) -> dict[str, Any]:
    try:
        import networkx as nx
        from dowhy import gcm
    except ImportError as error:
        raise RuntimeError(f"causal_dependencies_unavailable:{error}") from error

    nodes = [node.model_dump() for node in request.nodes]
    edges = [edge.model_dump() for edge in request.edges]
    validation = validate_dag(nodes, edges)
    if not validation["valid"]:
        raise ValueError("causal_graph_invalid")

    graph = nx.DiGraph()
    graph.add_nodes_from(node["id"] for node in nodes)
    graph.add_edges_from((edge["source"], edge["target"]) for edge in edges)
    data = pd.DataFrame(request.data)
    expected_columns = {node["id"] for node in nodes}
    missing_columns = sorted(expected_columns - set(data.columns))
    if missing_columns:
        raise ValueError(f"refutation_data_missing_columns:{','.join(missing_columns)}")

    result, summary = gcm.refute_causal_structure(
        graph,
        data[list(expected_columns)],
        significance_level=request.significance_level,
        fdr_control_method="fdr_bh",
    )
    rejected = result.name == "REJECTED"
    return {
        "schema_version": "joz.causal-refutation.v1",
        "status": "refuted" if rejected else "not_refuted",
        "operation": "refutation",
        "rejection_result": result.name,
        "significance_level": request.significance_level,
        "tests": _json_safe(summary),
        "graph_validation": validation,
        "warnings": [
            "Not rejected does not prove the graph is causal; it means these tests did not reject the tested assumptions.",
            "Refutation quality depends on data coverage, measurement quality, and the selected independence tests.",
        ],
    }
