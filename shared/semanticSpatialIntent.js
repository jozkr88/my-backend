const ENTITY_LABELS = {
  joz_neurons: "Joz's neurons",
  joz_skills: "Joz's skills",
  joz_works: "Joz's works",
};

function clean(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(value, phrases) {
  return phrases.some((phrase) => value.includes(phrase));
}

function inferContextualEntitySet(context = {}) {
  const portal = clean(context.currentPortal || context.portal || "");
  const path = clean(context.path || context.currentPath || "");
  if (portal === "maxx" || portal === "the-vibe-energy" || path.includes("/neo/maxx")) {
    return "joz_neurons";
  }
  if (portal === "meet-joz" || path.includes("/neo/meet-joz")) {
    return "joz_skills";
  }
  return null;
}

function inferEntitySet(text, context = {}) {
  if (hasAny(text, ["neuron", "neurons", "neurotransmitter", "brain signal", "brain layer", "reasoning layer"])) {
    return "joz_neurons";
  }
  if (hasAny(text, ["skill", "skills", "capabilities", "capability", "what joz can do"])) {
    return "joz_skills";
  }
  if (hasAny(text, ["work", "works", "portfolio", "projects", "case studies", "proof", "outcomes"])) {
    return "joz_works";
  }
  return inferContextualEntitySet(context);
}

function inferTargetMode(text) {
  return hasAny(text, [
    "around me",
    "in my room",
    "in my space",
    "in the room",
    "in real life",
    "in reality",
    "real world",
    "camera",
    "ar",
    "on my phone",
    "phone",
  ])
    ? "ar"
    : "ar";
}

function isSpatialCandidate(text) {
  return hasAny(text, [
    "spatial",
    "space",
    "around me",
    "my room",
    "my space",
    "in the room",
    "real world",
    "reality",
    "camera",
    "ar",
    "3d",
    "immersive",
    "walk through",
    "walk around",
    "place this",
    "put this",
    "bring this",
    "see this",
    "see it",
    "view this",
    "open this on my phone",
    "phone",
  ]);
}

function actionForText(text) {
  if (hasAny(text, ["place", "put", "bring"])) return "place_entity_set";
  return "experience_spatially";
}

export function buildSpatialPlacement({
  action = "experience_spatially",
  entitySet,
  targetMode = "ar",
  sourceText = "",
  confidence = 0.8,
  source = "semantic_rules",
} = {}) {
  if (!entitySet || !ENTITY_LABELS[entitySet]) return null;
  return {
    action,
    entitySet,
    entityLabel: ENTITY_LABELS[entitySet],
    targetMode,
    layout: "radial",
    anchorId: targetMode === "ar" ? "current_ar_anchor" : "current_world",
    requiresApproval: true,
    sourceText,
    semantic: {
      source,
      confidence,
    },
  };
}

export function resolveSemanticSpatialIntent(input = "", context = {}) {
  const text = clean(input);
  if (!text || !isSpatialCandidate(text)) {
    return {
      matched: false,
      source: "semantic_rules",
      confidence: 0,
      placement: null,
    };
  }

  const entitySet = inferEntitySet(text, context);
  if (!entitySet) {
    return {
      matched: false,
      source: "semantic_rules",
      confidence: 0.35,
      placement: null,
    };
  }

  const placement = buildSpatialPlacement({
    action: actionForText(text),
    entitySet,
    targetMode: inferTargetMode(text),
    sourceText: text,
    confidence: hasAny(text, ["spatial", "ar", "around me", "my room", "my space", "3d", "immersive"])
      ? 0.86
      : 0.68,
  });

  return {
    matched: true,
    source: "semantic_rules",
    confidence: placement.semantic.confidence,
    placement,
  };
}

function parseJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function resolveSemanticSpatialIntentWithModel({
  input = "",
  context = {},
  openai = null,
  model = "gpt-4o-mini",
} = {}) {
  const rules = resolveSemanticSpatialIntent(input, context);
  if (rules.matched || rules.confidence === 0) return rules;
  if (!openai?.chat?.completions?.create) return rules;

  let response = null;
  try {
    response = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Classify whether the user wants a Joz spatial/AR/3D experience.",
            "Return only JSON with: matched boolean, entitySet string/null, action string, confidence number.",
            "entitySet must be one of joz_neurons, joz_skills, joz_works, or null.",
            "Use context: maxx means joz_neurons; meet-joz means joz_skills.",
            "Do not match ordinary hiring, CV, business, or explanation questions.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            input,
            context: {
              currentPortal: context.currentPortal || context.portal || null,
              currentPath: context.currentPath || context.path || null,
            },
          }),
        },
      ],
    });
  } catch {
    return rules;
  }

  const parsed = parseJsonObject(response?.choices?.[0]?.message?.content);
  if (!parsed?.matched) return rules;
  const entitySet = ["joz_neurons", "joz_skills", "joz_works"].includes(parsed.entitySet)
    ? parsed.entitySet
    : inferContextualEntitySet(context);
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.6));
  const action = parsed.action === "place_entity_set" ? "place_entity_set" : "experience_spatially";
  const placement = buildSpatialPlacement({
    action,
    entitySet,
    targetMode: inferTargetMode(clean(input)),
    sourceText: clean(input),
    confidence,
    source: "semantic_model",
  });

  if (!placement || confidence < 0.55) return rules;
  return {
    matched: true,
    source: "semantic_model",
    confidence,
    placement,
  };
}
