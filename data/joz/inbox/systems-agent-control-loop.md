Agent Control Loop For High-Stakes Systems

Purpose
This record captures the safest control loop for agent systems that can trigger real actions.

Core rule
LLM proposes. Policy validates. Secure service executes. Real systems verify.

Expanded loop
Intent -> Plan -> Retrieve -> Simulate -> Validate -> Approve -> Execute -> Verify

Why this is the right control model
The model should not directly perform high-stakes actions. It should propose a next step. Policy should check permissions, limits, approvals, and confidence. A secure execution layer should act. Verification should confirm what actually happened in authoritative systems.

What this prevents
- Unsupported autonomous actions
- Prompt-led execution without controls
- Weak auditability
- Irreversible mistakes caused by reasoning drift
- Unverified outcomes being treated as complete

Why this matters
The hardest problem is not intelligence. It is safely turning intelligence into action with deterministic control points, visible approvals, and real post-action confirmation.
