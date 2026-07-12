function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function countMatches(text, terms = []) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

const CANONICAL_CONCEPTS = [
  {
    concept: "gold_pill",
    patterns: ["gold pill"],
  },
  {
    concept: "neo_maxx",
    patterns: ["neomaxxing", "neo/maxx", "neo maxx"],
  },
  {
    concept: "meet_joz",
    patterns: ["meet joz"],
  },
  {
    concept: "maxx",
    patterns: ["maxx"],
  },
  {
    concept: "meet_joz_flex",
    patterns: [" flex", "what is flex", "tell me about flex"],
  },
  {
    concept: "meet_joz_ascend",
    patterns: [" ascend", "what is ascend", "tell me about ascend"],
  },
  {
    concept: "meet_joz_mogg",
    patterns: ["mogg"],
  },
  {
    concept: "workf",
    patterns: ["workf"],
  },
  {
    concept: "worldx",
    patterns: ["worldx"],
  },
  {
    concept: "elite_beauty",
    patterns: ["the elite beauty", "elite beauty", "neurodesign"],
  },
  {
    concept: "capsule",
    patterns: ["capsule"],
  },
];

const DEFINITION_PROMPTS = [
  "what is ",
  "what does ",
  "what do ",
  "tell me about ",
  "explain ",
  "define ",
  "meaning of ",
  "is ",
];

const WORLD_AWARENESS_PATTERNS = [
  "what is this place",
  "what are my choices",
  "what am i looking at",
  "what stage am i in",
  "what happens if i click",
  "what happens when i click",
  "what happens in the animation",
  "what are the moving objects",
  "what does the synapse represent",
  "can i place this in ar",
  "what happens if i click the neuron",
  "what is the moon for",
  "what is the brain",
  "what does enter do",
];

const FACTUAL_SUBINTENTS = {
  education: [
    "where did joz study",
    "what degree",
    "degree",
    "education",
    "studied",
    "study",
    "university",
    "master",
    "msc",
    "academic",
  ],
  certifications: [
    "certification",
    "certifications",
    "certified",
    "mit sloan",
    "mit/ideo",
    "ideo",
    "hpi",
    "apple design labs",
    "wwdc",
  ],
  contact: [
    "contact",
    "email",
    "phone",
    "number",
    "reach joz",
  ],
  location: [
    "where is joz based",
    "where is joz located",
    "based",
    "location",
    "located",
  ],
  nationality: [
    "nationality",
    "citizenship",
    "citizen",
    "eu national",
    "slovak",
  ],
  experience_years: [
    "years of experience",
    "how many years",
    "yoe",
    "years in ai",
    "years in ml",
  ],
  career_chronology: [
    "career chronology",
    "career path",
    "career history",
    "career background",
    "chronology",
  ],
  companies: [
    "what companies",
    "which companies",
    "where has joz worked",
    "companies",
    "employers",
  ],
  roles: [
    "what roles",
    "which roles",
    "job titles",
    "roles",
    "titles",
  ],
  availability: [
    "availability",
    "available",
    "start date",
    "notice period",
    "when can joz start",
  ],
  work_authorization: [
    "work authorization",
    "work authorisation",
    "work pass",
    "visa",
    "singapore pass",
    "singapore work pass",
  ],
};

const BUSINESS_PATTERNS = [
  "why should we hire joz",
  "why should a company hire joz",
  "why hire joz",
  "roi",
  "business value",
  "agentic ai and ai systems role",
  "problems can joz solve",
  "what problems can joz solve",
  "measurable outcomes",
  "ai adoption",
  "operational lift",
];

const MINDSET_PATTERNS = [
  "how does joz think",
  "explain how joz thinks",
  "decision-making",
  "intelligence, systems",
  "systems mindset",
  "systems and decision-making",
  "signal over noise",
  "context creates intelligence",
  "trust before autonomy",
  "feedback loops",
  "decision quality",
  "principles",
];

const SKILLS_PATTERNS = [
  "what is joz strongest at",
  "strongest skills",
  "how technical is joz",
  "technical capabilities",
  "agentic ai",
  "rag",
  "architecture",
  "engineering stack",
  "multimodal ai",
  "financial-services experience",
  "financial services experience",
];

function detectCanonicalConcept(clean, legacyContext = {}) {
  const hasDefinitionPrompt =
    DEFINITION_PROMPTS.some((pattern) => clean.startsWith(pattern)) ||
    clean.split(" ").length <= 3;

  if (!hasDefinitionPrompt) {
    return null;
  }

  for (const entry of CANONICAL_CONCEPTS) {
    if (entry.patterns.some((pattern) => clean.includes(pattern))) {
      if (entry.concept === "capsule") {
        const portal = String(legacyContext?.currentPortal || "").toLowerCase();
        const mesh = String(legacyContext?.currentMesh || "").toLowerCase();
        if (portal !== "meet_joz" && mesh !== "capsule") continue;
      }
      return entry.concept;
    }
  }

  return null;
}

function detectWorldAwareness(clean) {
  return includesAny(clean, WORLD_AWARENESS_PATTERNS);
}

function detectFactualSubIntent(clean) {
  let best = null;

  for (const [subIntent, patterns] of Object.entries(FACTUAL_SUBINTENTS)) {
    const score = countMatches(clean, patterns);
    if (!score) continue;
    if (!best || score > best.score) {
      best = { subIntent, score };
    }
  }

  return best?.subIntent || null;
}

function detectMixed(clean) {
  const hasWorld = includesAny(clean, [
    "maxx",
    "meet joz",
    "gold pill",
    "mogg",
    "flex",
    "ascend",
    "workf",
    "worldx",
    "in the app",
  ]);
  const hasMindset = includesAny(clean, MINDSET_PATTERNS);
  const hasSkills = includesAny(clean, SKILLS_PATTERNS) || includesAny(clean, ["proof of joz's ai skills", "proof of joz ai skills"]);
  const hasBusiness = includesAny(clean, BUSINESS_PATTERNS);
  const domainCount = [hasWorld, hasMindset, hasSkills, hasBusiness].filter(Boolean).length;
  return hasWorld && domainCount >= 2;
}

export function resolveJozLlmRoute({ message = "", legacyContext = {} } = {}) {
  const clean = normalizeText(message);
  const concept = detectCanonicalConcept(clean, legacyContext);

  if (concept) {
    return {
      detectedIntent: "canonical_world_concept",
      detectedSubIntent: null,
      detectedConcept: concept,
      selectedRoute: "canonical_world_concept",
      selectedRecordIds: [concept],
      intentMode: null,
    };
  }

  if (detectWorldAwareness(clean)) {
    return {
      detectedIntent: "world_awareness",
      detectedSubIntent: null,
      detectedConcept: null,
      selectedRoute: "world_awareness",
      selectedRecordIds: [],
      intentMode: null,
    };
  }

  const factualSubIntent = detectFactualSubIntent(clean);
  if (factualSubIntent) {
    return {
      detectedIntent: "factual_profile",
      detectedSubIntent: factualSubIntent,
      detectedConcept: null,
      selectedRoute: "factual_profile",
      selectedRecordIds: [`factual_profile.${factualSubIntent}`],
      intentMode: null,
    };
  }

  if (includesAny(clean, BUSINESS_PATTERNS)) {
    return {
      detectedIntent: "business_need",
      detectedSubIntent: null,
      detectedConcept: null,
      selectedRoute: "business_need",
      selectedRecordIds: ["proof.maybank", "proof.mediacorp", "proof.erste", "proof.manulife"],
      intentMode: "business_need",
    };
  }

  if (includesAny(clean, MINDSET_PATTERNS)) {
    return {
      detectedIntent: "systems_mindset",
      detectedSubIntent: null,
      detectedConcept: null,
      selectedRoute: "systems_mindset",
      selectedRecordIds: ["principle.signal_over_noise", "principle.context_creates_intelligence", "principle.trust_before_autonomy"],
      intentMode: "systems_mindset",
    };
  }

  if (includesAny(clean, SKILLS_PATTERNS)) {
    return {
      detectedIntent: "skills",
      detectedSubIntent: null,
      detectedConcept: null,
      selectedRoute: "skills",
      selectedRecordIds: ["skills.agentic_ai_architecture", "skills.retrieval", "skills.observability"],
      intentMode: "skills",
    };
  }

  if (detectMixed(clean)) {
    return {
      detectedIntent: "mixed",
      detectedSubIntent: null,
      detectedConcept: null,
      selectedRoute: "mixed",
      selectedRecordIds: [],
      intentMode: null,
    };
  }

  return {
    detectedIntent: "unknown_fallback",
    detectedSubIntent: null,
    detectedConcept: null,
    selectedRoute: "unknown_fallback",
    selectedRecordIds: [],
    intentMode: null,
  };
}
