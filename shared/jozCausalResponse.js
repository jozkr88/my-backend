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
} = {}) {
  const queryType = normalizeQueryType(causalAnalysis?.queryType);
  const status = cleanText(causalAnalysis?.status).toLowerCase() || "not_executed";
  const query = cleanText(input);

  if (status === "unavailable") {
    return {
      reply: `This is a ${queryType} question: ${query} The causal service is temporarily unavailable, so I will not invent an effect. Once it is available, the analysis still needs a versioned dataset, an explicit outcome, and stated causal assumptions.`,
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
