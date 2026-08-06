from collections import defaultdict, deque
from typing import Any


def _fallback_topological_check(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, Any]:
    node_ids = {str(node.get("id")) for node in nodes if node.get("id")}
    adjacency: dict[str, set[str]] = defaultdict(set)
    indegree = {node_id: 0 for node_id in node_ids}
    warnings: list[str] = []

    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if not source or not target:
            warnings.append("edge_missing_endpoint")
            continue
        if source not in node_ids or target not in node_ids:
            warnings.append("edge_references_unknown_node")
            continue
        if target not in adjacency[source]:
            adjacency[source].add(target)
            indegree[target] += 1

    queue = deque(node_id for node_id, degree in indegree.items() if degree == 0)
    visited = 0
    while queue:
        current = queue.popleft()
        visited += 1
        for target in adjacency[current]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    return {
        "valid": visited == len(node_ids),
        "cycles": [] if visited == len(node_ids) else ["cycle_detected"],
        "warnings": sorted(set(warnings)),
        "node_count": len(node_ids),
        "edge_count": sum(len(targets) for targets in adjacency.values()),
        "engine": "stdlib_topological_check",
    }


def validate_dag(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, Any]:
    """Validate a directed graph, using NetworkX when available.

    The standard-library fallback keeps contract tests runnable before the
    causal service image is provisioned with its scientific dependencies.
    """
    try:
        import networkx as nx
    except ImportError:
        return _fallback_topological_check(nodes, edges)

    graph = nx.DiGraph()
    graph.add_nodes_from(str(node.get("id")) for node in nodes if node.get("id"))
    warnings: list[str] = []
    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if not source or not target:
            warnings.append("edge_missing_endpoint")
            continue
        if source not in graph or target not in graph:
            warnings.append("edge_references_unknown_node")
            continue
        graph.add_edge(source, target, type=edge.get("type"), status=edge.get("status"))

    cycles = [[str(node) for node in cycle] for cycle in nx.simple_cycles(graph)]
    return {
        "valid": not cycles,
        "cycles": cycles[:20],
        "warnings": sorted(set(warnings)),
        "node_count": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
        "engine": "networkx",
    }

