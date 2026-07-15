Agent Runtime Stack

Purpose
This record explains the runtime stack behind a serious agent system in a way that is useful for architecture, engineering, and recruiter conversations.

Core framing
An agent is not just an LLM. The runtime stack combines the model, instructions, tools, memory, orchestration, and verification.

Useful shorthand
- Agent = LLM + instructions + tools + memory + execution loop
- Single agent = one responsibility with defined tools and state
- Multi-agent system = supervisor agent + specialist agents + shared state
- Orchestrator = workflow engine + state management + execution control

Recommended production stack
- FastAPI as the API and agent gateway
- LangGraph as the reasoning and workflow graph
- Temporal as the durable execution layer for retries, approvals, and resumable work
- PostgreSQL for persistent state and audit records
- Redis for cache and short-lived coordination
- Event transport for communication between services
- Secret management for credentials and signing keys
- Observability for traces, metrics, logs, and failure visibility

Role separation
- FastAPI receives requests and exposes backend services
- LangGraph controls the reasoning workflow and state transitions
- Temporal manages durable business processes and retries
- PostgreSQL stores long-lived workflow state and audit history
- Observability shows routes, tool calls, latency, fallback behavior, and failures

Why this matters
The value of the stack is not novelty. It is reliable execution, controlled state transitions, failure recovery, and clear visibility into what the system did and why.
