from __future__ import annotations

from typing import Any, TypedDict

from .diagnostic import build_diagnostic_state

try:
    from langgraph.graph import END, StateGraph
except ImportError:  # The deterministic fallback keeps local tests dependency-light.
    END = None
    StateGraph = None

try:
    from langgraph.checkpoint.postgres import PostgresSaver
except ImportError:
    PostgresSaver = None


class DiagnosticGraphState(TypedDict, total=False):
    request: dict[str, Any]
    diagnostic: dict[str, Any]


def _diagnose(state: DiagnosticGraphState) -> DiagnosticGraphState:
    request = state.get("request", {})
    state["diagnostic"] = build_diagnostic_state(
        input_text=request.get("input", ""),
        messages=request.get("messages", []),
        current_mesh=request.get("currentMesh"),
        evidence_records=request.get("evidenceRecords", []),
        review_approved=request.get("reviewApproved", False),
        prior_state=request.get("priorState"),
    )
    return state


def build_workflow(checkpointer=None):
    if StateGraph is None:
        return None
    graph = StateGraph(DiagnosticGraphState)
    graph.add_node("diagnose", _diagnose)
    graph.set_entry_point("diagnose")
    graph.add_edge("diagnose", END)
    return graph.compile(checkpointer=checkpointer)


class DiagnosticWorkflow:
    def __init__(self, database_url: str | None = None, require_database: bool = False) -> None:
        self._checkpoint_context = None
        self._checkpointer = None
        self._durable = False
        if require_database and not database_url:
            raise RuntimeError("BUSINESS_VALUE_DATABASE_URL is required in production")
        if require_database and PostgresSaver is None:
            raise RuntimeError("langgraph-checkpoint-postgres is required in production")
        if database_url and PostgresSaver is not None and StateGraph is not None:
            try:
                self._checkpoint_context = PostgresSaver.from_conn_string(database_url)
                self._checkpointer = self._checkpoint_context.__enter__()
                self._checkpointer.setup()
                self._durable = True
            except Exception:
                if self._checkpoint_context is not None:
                    self._checkpoint_context.__exit__(None, None, None)
                self._checkpoint_context = None
                self._checkpointer = None
                if require_database:
                    raise
        self.graph = build_workflow(self._checkpointer)

    @property
    def runtime(self) -> str:
        if self._durable:
            return "langgraph_postgres"
        return "langgraph_ephemeral" if self.graph is not None else "deterministic_fallback"

    @property
    def durable_checkpoint(self) -> bool:
        return self._durable

    def run(self, request: dict[str, Any], thread_id: str | None = None) -> dict[str, Any]:
        if self.graph is not None:
            config = {"configurable": {"thread_id": thread_id or "anonymous"}}
            return self.graph.invoke({"request": request}, config=config).get("diagnostic", {})
        return _diagnose({"request": request}).get("diagnostic", {})

    def close(self) -> None:
        if self._checkpoint_context is not None:
            self._checkpoint_context.__exit__(None, None, None)
            self._checkpoint_context = None
