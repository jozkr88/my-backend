from __future__ import annotations

from typing import Any

from .governance import apply_governance

NODE_ORDER = ["data", "control", "oversight", "adoption"]

NODE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "data": {
        "label": "Data Reality",
        "summary": "The working hypothesis is that the system is reasoning over information that may not be trusted, owned, current, or verifiable.",
        "signals": ["data", "trust", "untrustworthy", "source of truth", "data quality", "stale", "freshness", "verification"],
        "evidence": [
            ("source_of_truth", "source of truth", ["source of truth", "authoritative source", "system of record"]),
            ("data_owner", "data owner", ["data owner", "owner of the data", "who owns", "owns it", "owns the data"]),
            ("freshness", "freshness rule", ["freshness", "fresh data", "fresh daily", "updated daily", "updated hourly", "last updated"]),
            ("verification", "verification rule", ["verified", "verification", "reconciled", "validation rule"]),
        ],
        "action": "Run a Data Reality assessment",
        "jozFit": "Joz establishes governed context: authoritative data, ownership, provenance, and verification before agents act.",
        "nextNode": "control",
    },
    "control": {
        "label": "Control",
        "summary": "The working hypothesis is that the system lacks clear boundaries around tools, permissions, ownership, or execution.",
        "signals": ["shadow ai", "unapproved", "permission", "ownership", "sovereignty", "governance", "control", "approved tool"],
        "evidence": [
            ("approved_tools", "approved tools", ["approved tool", "approved tools", "allowlist", "allowed tools"]),
            ("ownership_map", "ownership map", ["ownership", "owner", "accountable team", "data owner"]),
            ("permissions", "permission model", ["permission", "permissions", "access control", "access model", "least privilege", "acl"]),
            ("escalation", "escalation rule", ["escalation", "escalate", "stop condition", "blocked action"]),
        ],
        "action": "Map the control boundary",
        "jozFit": "Joz designs the operating boundary: approved tools, permissions, ownership, escalation, and controlled execution.",
        "nextNode": "oversight",
    },
    "oversight": {
        "label": "Oversight",
        "summary": "The working hypothesis is that autonomy is being requested before consequential actions can be explained, approved, verified, and reversed.",
        "signals": ["human in the loop", "human approval", "explainability", "explainable", "autonomous", "autonomy", "oversight", "rollback", "verify"],
        "evidence": [
            ("approval_points", "approval points", ["approval", "approve", "human in the loop", "human review"]),
            ("explanation_standard", "explanation standard", ["explainability", "explainable", "reason code", "why it decided"]),
            ("verification_path", "verification path", ["verify", "verification", "reconcile", "post-action check"]),
            ("rollback_path", "rollback path", ["rollback", "undo", "revert", "recovery"]),
        ],
        "action": "Define the oversight gate",
        "jozFit": "Joz separates reasoning from policy, approval, execution, and verification so autonomy can be earned safely.",
        "nextNode": "adoption",
    },
    "adoption": {
        "label": "Adoption",
        "summary": "The working hypothesis is that the system is not useful, specific, or trusted enough to become part of daily work.",
        "signals": ["generic", "adoption", "daily work", "pilot", "not useful", "users do not trust", "too generic", "workflow"],
        "evidence": [
            ("target_workflow", "target workflow", ["workflow", "process", "daily work", "use case"]),
            ("user_group", "user group", ["users", "user group", "team", "desk workers", "operators"]),
            ("trust_blocker", "trust blocker", ["do not trust", "don't trust", "trust issue", "generic", "not useful"]),
            ("success_metric", "success metric", ["success metric", "baseline", "measure", "kpi", "outcome"]),
        ],
        "action": "Design a bounded adoption pilot",
        "jozFit": "Joz connects the AI capability to a real workflow, useful context, user trust, and a measurable business outcome.",
        "nextNode": "data",
    },
}


def normalize(value: str | None) -> str:
    return " ".join(str(value or "").lower().replace("_", " ").replace("-", " ").split())


def user_text(messages: list[dict[str, Any]], current_input: str) -> str:
    history = [str(item.get("content", "")) for item in messages if item.get("role") == "user"]
    return "\n".join([*history, current_input]).strip()


def evidence_items(node: str, text: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = normalize(text)
    result = []
    for evidence_id, label, terms in NODE_DEFINITIONS[node]["evidence"]:
        sources = [
            record for record in records
            if record.get("evidenceKey") in {f"{node}.{evidence_id}", evidence_id}
        ]
        present = any(normalize(term) in normalized for term in terms) or bool(sources)
        result.append({
            "id": evidence_id,
            "label": label,
            "present": present,
            "sourceCount": len(sources),
            "verificationStatus": "verified" if any(item.get("verificationStatus") == "verified" for item in sources) else ("unverified" if sources else None),
        })
    return result


def build_diagnostic_state(
    *,
    input_text: str = "",
    messages: list[dict[str, Any]] | None = None,
    current_mesh: str | None = None,
    evidence_records: list[dict[str, Any]] | None = None,
    review_approved: bool = False,
    prior_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    messages = messages or []
    records = evidence_records or []
    latest = input_text or next((item.get("content", "") for item in reversed(messages) if item.get("role") == "user"), "")
    all_text = user_text(messages, input_text)
    scores = {node: sum(normalize(term) in normalize(latest) for term in definition["signals"]) for node, definition in NODE_DEFINITIONS.items()}
    active_node = current_mesh if current_mesh in NODE_ORDER and not scores.get(current_mesh) else max(scores, key=scores.get)
    if not scores[active_node]:
        historical_scores = {node: sum(normalize(term) in normalize(all_text) for term in definition["signals"]) for node, definition in NODE_DEFINITIONS.items()}
        active_node = max(historical_scores, key=historical_scores.get) if max(historical_scores.values()) else (current_mesh if current_mesh in NODE_ORDER else "data")

    evidence = evidence_items(active_node, all_text, records)
    missing = [item for item in evidence if not item["present"]]
    unverified = [record for record in records if record.get("verificationStatus") != "verified" and record.get("evidenceKey", "").startswith(f"{active_node}.")]
    has_confirmation = review_approved or any(term in normalize(latest) for term in ["confirmed", "we verified", "this is correct", "the diagnosis is right", "resolved"])
    prior_review = prior_state and prior_state.get("status") == "verified" and prior_state.get("approval", {}).get("status") == "approved"
    effective_review = bool(review_approved or prior_review)
    present_count = len(evidence) - len(missing)
    status = "verified" if has_confirmation and present_count >= max(2, len(evidence) - 1) and not unverified else ("in_progress" if present_count else "needs_attention")
    coverage = round(present_count / len(evidence), 2) if evidence else 0
    confidence = min(0.96, 0.35 + min(scores[active_node], 4) * 0.08 + coverage * 0.35 + (0.12 if status == "verified" else 0))
    if unverified and status != "verified":
        confidence = min(confidence, 0.79)
    definition = NODE_DEFINITIONS[active_node]
    state = {
        "schema": "business_value_diagnostic.v1",
        "portal": "business-value",
        "mode": "diagnose_and_propose",
        "activeNode": active_node,
        "status": status,
        "confidence": round(confidence, 2),
        "diagnosis": {"type": "working_hypothesis", "node": active_node, "label": definition["label"], "summary": definition["summary"], "notYetVerified": status != "verified"},
        "solutionMap": {"label": "Where Joz fits", "summary": definition["jozFit"], "intervention": definition["action"], "available": status != "needs_attention" or effective_review},
        "evidence": evidence,
        "evidenceCoverage": coverage,
        "missingEvidence": [{"id": item["id"], "label": item["label"]} for item in missing],
        "unverifiedEvidence": [{"evidenceKey": item.get("evidenceKey"), "sourceRef": item.get("sourceRef")} for item in unverified],
        "approval": {"required": True, "status": "approved" if effective_review or any(term in normalize(latest) for term in ["i approve", "approved", "start the assessment", "run the assessment", "continue the assessment"]) else "pending", "scope": "conversational diagnostic assessment only"},
        "proposedAction": {"id": f"business_value_{active_node}_assessment", "label": f"Review {definition['label']}" if len(missing) <= 1 and status != "needs_attention" else definition["action"], "prompt": f"Continue the {definition['label']} assessment. Tell me the {missing[0]['label'] if missing else 'next verification decision'}.", "requiresApproval": True, "nextNode": definition["nextNode"]},
        "statusByNode": {node: status if node == active_node else "unassessed" for node in NODE_ORDER},
        "nextNode": definition["nextNode"],
        "completed": status == "verified",
    }
    return apply_governance(
        state=state,
        input_text=input_text,
        messages=messages,
        evidence_text="\n".join(str(record.get("value", {})) for record in records),
    )
