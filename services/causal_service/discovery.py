from typing import Any

import pandas as pd


def _numeric_frame(rows: list[dict[str, float]]) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    frame = frame.select_dtypes(include=["number"]).dropna(axis="columns", how="all").dropna()
    if frame.shape[1] < 2:
        raise ValueError("discovery_requires_two_numeric_columns")
    if frame.shape[0] < 20:
        raise ValueError("discovery_requires_at_least_20_complete_rows")
    return frame


def discover_candidates(request: Any) -> dict[str, Any]:
    frame = _numeric_frame(request.data)
    if request.method == "pc":
        return _run_pc(frame, request.alpha)
    return _run_pcmci(frame, request.alpha, request.tau_max)


def _run_pc(frame: pd.DataFrame, alpha: float) -> dict[str, Any]:
    try:
        from causallearn.search.ConstraintBased.PC import pc
    except ImportError as error:
        raise RuntimeError(f"causal_learn_unavailable:{error}") from error

    result = pc(frame.to_numpy(), alpha=alpha, verbose=False, show_progress=False)
    candidates = []
    for edge in result.G.get_graph_edges():
        source = edge.get_node1().get_name()
        target = edge.get_node2().get_name()
        source_index = int(source.removeprefix("X")) - 1 if source.startswith("X") else None
        target_index = int(target.removeprefix("X")) - 1 if target.startswith("X") else None
        candidates.append({
            "source": frame.columns[source_index] if source_index is not None else source,
            "target": frame.columns[target_index] if target_index is not None else target,
            "source_endpoint": str(edge.get_endpoint1()),
            "target_endpoint": str(edge.get_endpoint2()),
            "lag": 0,
            "status": "DISCOVERED_ASSOCIATION",
        })
    return {
        "schema_version": "joz.causal-discovery.v1",
        "method": "causal-learn.pc",
        "status": "candidate_structure",
        "variables": list(frame.columns),
        "candidates": candidates,
        "warning": "Candidate associations require domain assumptions and causal validation.",
    }


def _run_pcmci(frame: pd.DataFrame, alpha: float, tau_max: int) -> dict[str, Any]:
    try:
        from tigramite import data_processing as pp
        from tigramite.independence_tests.parcorr import ParCorr
        from tigramite.pcmci import PCMCI
    except ImportError as error:
        raise RuntimeError(f"tigramite_unavailable:{error}") from error

    dataframe = pp.DataFrame(frame.to_numpy(), var_names=list(frame.columns))
    pcmci = PCMCI(
        dataframe=dataframe,
        cond_ind_test=ParCorr(significance="analytic"),
        verbosity=0,
    )
    result = pcmci.run_pcmci(tau_max=tau_max, pc_alpha=alpha)
    graph = result["graph"]
    candidates = []
    for target_index in range(graph.shape[0]):
        for source_index in range(graph.shape[1]):
            for lag in range(graph.shape[2]):
                marker = str(graph[target_index, source_index, lag])
                if not marker:
                    continue
                candidates.append({
                    "source": frame.columns[source_index],
                    "target": frame.columns[target_index],
                    "lag": lag,
                    "relation": marker,
                    "status": "DISCOVERED_ASSOCIATION",
                })
    return {
        "schema_version": "joz.causal-discovery.v1",
        "method": "tigramite.pcmci",
        "status": "candidate_temporal_structure",
        "variables": list(frame.columns),
        "tau_max": tau_max,
        "candidates": candidates,
        "warning": "Lagged candidates require domain assumptions and causal validation.",
    }
