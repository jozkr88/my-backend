function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeQueryType(value = "") {
  const queryType = cleanText(value).toLowerCase();
  return ["intervention", "counterfactual", "decision"].includes(queryType)
    ? queryType
    : "intervention";
}

export function buildJozCausalDecisionSupportReply({
  input = "",
  causalAnalysis = {},
  causalTool = {},
} = {}) {
  const queryType = normalizeQueryType(causalAnalysis?.queryType);
  const status = cleanText(causalAnalysis?.status).toLowerCase() || "not_executed";
  const query = cleanText(input);
  const article = queryType === "intervention" ? "an" : "a";
  const estimate = causalTool?.result || null;

  if (estimate?.status === "estimated" && Number.isFinite(Number(estimate.average_treatment_effect))) {
    const effect = Number(estimate.average_treatment_effect);
    const effectPoints = `${effect >= 0 ? "+" : ""}${(effect * 100).toFixed(1)} percentage points`;
    const refutationStatus = cleanText(estimate.refutation?.status).toLowerCase();
    const refutationText = refutationStatus
      ? ` The refutation check returned ${refutationStatus}; this does not prove causality, but it did not reject the tested structure.`
      : "";
    return {
      reply: `Using the versioned synthetic customer-wait-time dataset, reducing wait time from ${estimate.treatment_value} to ${estimate.control_value} minutes is estimated to change conversion rate by ${effectPoints}. This is a model-based estimate for demonstration, not a production claim; validate it with real customer data and a controlled test.${refutationText}`,
      answerSource: "causal_effect_estimate",
      composer: "buildJozCausalDecisionSupportReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["causal_ai"],
      answerClass: "causal_decision_support",
      confidence: "medium",
    };
  }

  if (status === "unavailable") {
    return {
      reply: `This is ${article} ${queryType} question: ${query} The causal service is temporarily unavailable, so I will not invent an effect. Once it is available, the analysis still needs a versioned dataset, an explicit outcome, and stated causal assumptions.`,
      answerSource: "causal_decision_support",
      composer: "buildJozCausalDecisionSupportReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["causal_ai"],
      answerClass: "causal_decision_support",
      confidence: "high",
    };
  }

  const reasoning = queryType === "counterfactual"
    ? "This asks what would have happened under a different condition for a particular factual case."
    : queryType === "decision"
      ? "This asks which action should be chosen, so the alternatives, outcomes, constraints, and decision objective must be explicit."
      : "This is an intervention question: what would change if the proposed action were applied?";

  return {
    reply: `${reasoning} I cannot responsibly claim a numerical effect from the current knowledge base alone. To estimate it, we need a versioned dataset, a defined outcome, the unit and time window, a causal graph with its assumptions and confounders, and refutation checks. Until those are supplied, any expected lift or reduction is a hypothesis—not a causal estimate.`,
    answerSource: "causal_decision_support",
    composer: "buildJozCausalDecisionSupportReply",
    fallbackUsed: false,
    intentMode: "skills",
    retrievedCategories: ["causal_ai"],
    answerClass: "causal_decision_support",
    confidence: "high",
  };
}
