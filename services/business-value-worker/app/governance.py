from __future__ import annotations

from typing import Any

PROHIBITED_PATTERNS = {
    "prohibited_or_sensitive_biometric_use": (
        "biometric identification",
        "facial recognition",
        "emotion recognition",
        "infer emotion from voice",
        "infer emotions from voice",
        "biometric categorisation",
    ),
    "social_scoring_or_manipulation": (
        "social score",
        "social scoring",
        "manipulate vulnerable",
        "subliminal manipulation",
        "exploit vulnerable people",
    ),
}

HIGH_IMPACT_PATTERNS = {
    "employment_or_worker_management": (
        "screen applicants",
        "screen candidates",
        "rank candidates",
        "hire candidates",
        "hiring decision",
        "employee performance",
        "performance rating",
        "promote an employee",
        "fire an employee",
        "dismiss an employee",
        "job application scoring",
    ),
    "credit_insurance_or_essential_services": (
        "credit score a person",
        "creditworthiness",
        "loan approval",
        "insurance pricing",
        "insurance eligibility",
        "healthcare eligibility",
        "benefit eligibility",
        "deny benefits",
        "essential service eligibility",
    ),
    "education_or_vulnerable_person_assessment": (
        "grade a student",
        "score a student",
        "student admission",
        "assess a child",
        "assess vulnerable people",
    ),
    "law_enforcement_migration_or_democratic_process": (
        "law enforcement risk",
        "predict crime",
        "immigration decision",
        "border decision",
        "asylum decision",
        "political persuasion targeting",
        "election influence targeting",
    ),
}


def normalize(value: str | None) -> str:
    return " ".join(str(value or "").lower().replace("_", " ").replace("-", " ").split())


def assess_ai_act_use(*, input_text: str = "", messages: list[dict[str, Any]] | None = None, evidence_text: str = "") -> dict[str, Any]:
    messages = messages or []
    text = normalize("\n".join([
        input_text,
        *(str(item.get("content", "")) for item in messages if item.get("role") == "user"),
        evidence_text,
    ]))
    prohibited = [category for category, terms in PROHIBITED_PATTERNS.items() if any(term in text for term in terms)]
    high_impact = [category for category, terms in HIGH_IMPACT_PATTERNS.items() if any(term in text for term in terms)]
    if prohibited:
        return {
            "status": "restricted",
            "riskTier": "prohibited_or_sensitive_review_required",
            "matchedCategories": prohibited,
            "reason": "This use may involve a prohibited or specially restricted practice and cannot be handled as an ordinary Business Value diagnosis.",
            "humanReviewRequired": True,
            "allowedForDiagnostic": False,
        }
    if high_impact:
        return {
            "status": "restricted",
            "riskTier": "high_impact_review_required",
            "matchedCategories": high_impact,
            "reason": "This use may affect people in a high-impact domain. Joz must not make or recommend the individual decision; legal, compliance, and human-rights review is required.",
            "humanReviewRequired": True,
            "allowedForDiagnostic": False,
        }
    return {
        "status": "clear_with_transparency",
        "riskTier": "limited_risk_transparency",
        "matchedCategories": [],
        "reason": "Organizational diagnostic use detected; continue to disclose AI involvement and keep conclusions as human-reviewed hypotheses.",
        "humanReviewRequired": False,
        "allowedForDiagnostic": True,
    }


def apply_governance(*, state: dict[str, Any], input_text: str = "", messages: list[dict[str, Any]] | None = None, evidence_text: str = "") -> dict[str, Any]:
    assessment = assess_ai_act_use(input_text=input_text, messages=messages, evidence_text=evidence_text)
    if assessment["allowedForDiagnostic"]:
        return {**state, "governance": assessment}
    return {
        **state,
        "status": "needs_attention",
        "confidence": min(float(state.get("confidence", 0)), 0.35),
        "completed": False,
        "governance": assessment,
        "diagnosis": {
            **state.get("diagnosis", {}),
            "type": "restricted_use_review",
            "notYetVerified": True,
            "summary": assessment["reason"],
        },
        "solutionMap": {
            **state.get("solutionMap", {}),
            "available": False,
            "summary": "Joz cannot provide an individual-impact decision or bypass the required human, legal, and compliance review.",
        },
        "approval": {
            **state.get("approval", {}),
            "required": True,
            "status": "pending",
            "scope": "human and compliance review of intended use",
        },
        "proposedAction": {
            "id": "ai_act_intended_use_review",
            "label": "Review intended use",
            "prompt": "This request may affect people in a regulated or high-impact context. Confirm that Joz will only help design safeguards and will not make or recommend the individual decision.",
            "requiresApproval": True,
            "nextNode": state.get("activeNode", "data"),
        },
    }
