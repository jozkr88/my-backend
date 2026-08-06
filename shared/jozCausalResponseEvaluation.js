function normalize(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text, phrases = []) {
  return phrases.some((phrase) => normalize(text).includes(normalize(phrase)));
}

export function evaluateJozCausalResponse({
  caseDefinition = {},
  reply = "",
  causalKnowledge = null,
  requireReply = false,
} = {}) {
  const question = String(caseDefinition.question || "");
  const expectedCausal = Boolean(caseDefinition.expectedCausal);
  const detectedCausal = Boolean(causalKnowledge);
  const failures = [];
  const answer = normalize(reply);

  if (expectedCausal !== detectedCausal) {
    failures.push(expectedCausal ? "causal context was not attached" : "causal context leaked into an ordinary query");
  }
  if (expectedCausal) {
    if (!causalKnowledge?.activeInContext) failures.push("causal context is not active");
    if (Number(causalKnowledge?.documentCount || causalKnowledge?.retrievedCausalDocuments?.length || 0) < 1) {
      failures.push("no causal documents were retrieved");
    }
    if (!Array.isArray(causalKnowledge?.workflow) || causalKnowledge.workflow.length < 3) {
      failures.push("causal workflow is incomplete");
    }
    if (!Array.isArray(causalKnowledge?.answerGuardrails) || causalKnowledge.answerGuardrails.length < 2) {
      failures.push("causal answer guardrails are incomplete");
    }
  }

  if (requireReply && !answer) failures.push("empty model reply");
  if (answer) {
    for (const group of caseDefinition.requiredAny || []) {
      if (!includesAny(answer, group)) failures.push(`missing one of: ${group.join(", ")}`);
    }
    for (const phrase of caseDefinition.forbiddenPhrases || []) {
      if (answer.includes(normalize(phrase))) failures.push(`forbidden phrase: ${phrase}`);
    }
  }

  return {
    id: caseDefinition.id || null,
    question,
    expectedCausal,
    detectedCausal,
    answerChecked: Boolean(answer),
    pass: failures.length === 0,
    failures,
  };
}
