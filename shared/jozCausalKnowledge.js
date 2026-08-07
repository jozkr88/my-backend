function cleanText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function isJozCausalKnowledgeQuestion(input = "") {
  const text = cleanText(input).toLowerCase();
  return Boolean(
    text && /\b(caus(?:e|al|ation)|counterfactual|intervention|what would happen if|what if|do[- ]calculus|effect estimation|treatment effect|refut(?:e|ation)|structural causal|identif(?:y|iable|ication)|mechanism|confound|dag|causal graph|decision operating system|world model)\b/.test(text)
  );
}

export function promoteJozCausalKnowledgeIntent({ input = "", classification = null } = {}) {
  if (!classification || classification.kind !== "answer" || !isJozCausalKnowledgeQuestion(input)) {
    return classification;
  }

  return {
    ...classification,
    domain: "general_knowledge",
    needsClarification: false,
    routingOverride: "causal_knowledge_open_domain",
  };
}

export function isJozCausalKnowledgeDocument(document = {}) {
  const metadata = document?.metadata || {};
  const text = cleanText([
    document?.title,
    document?.category,
    metadata.slug,
    metadata.dataset_id,
    metadata.causal_model_version,
    metadata.causal_claims ? JSON.stringify(metadata.causal_claims) : "",
    document?.summary,
    document?.body,
  ].join(" ")).toLowerCase();
  return Boolean(
    text && /\b(causal|counterfactual|intervention|do[- ]calculus|treatment effect|refutation|structural causal|causal inference|causal graph|causal intelligence|decision operating system)\b/.test(text)
  );
}

export function buildJozCausalReasoningContext({ query = "", documents = [], graph = null } = {}) {
  return {
    mode: "query_scoped_augment",
    questionType: "causal_reasoning",
    query: cleanText(query).slice(0, 400),
    workflow: [
      "Define treatment, outcome, unit, time window, and decision objective.",
      "Separate association from causal effect and inspect identification assumptions.",
      "Use the causal graph to expose confounders, mediators, colliders, and pathways.",
      "Prefer versioned evidence-backed claims; label hypotheses and associations explicitly.",
      "For what-if questions, distinguish intervention from counterfactual reasoning.",
      "State uncertainty, limitations, and refutation requirements before recommending action.",
    ],
    answerGuardrails: [
      "Never turn a discovered association into a causal claim.",
      "Do not imply an effect is identifiable without the required assumptions.",
      "Use evidence strength and model version when describing causal relationships.",
      "If evidence is conceptual rather than empirical, say so directly.",
    ],
    retrievedCausalDocuments: documents.slice(0, 8).map((document) => ({
      title: cleanText(document?.title) || null,
      slug: cleanText(document?.metadata?.slug) || null,
      category: cleanText(document?.category) || null,
      evidenceTier: cleanText(document?.metadata?.evidence_tier) || null,
      verificationStatus: cleanText(document?.metadata?.verification_status || document?.metadata?.verification?.status) || null,
    })),
    graph: graph
      ? {
          backend: graph.backend || "artifact",
          matchedNodeCount: Number(graph.matchedNodeIds?.length || 0),
          pathCount: Number(graph.paths?.length || 0),
          causalPathCount: Number((graph.paths || []).filter((path) => (path.edgeTypes || []).some((type) => String(type).toLowerCase().includes("causal"))).length),
        }
      : null,
  };
}
