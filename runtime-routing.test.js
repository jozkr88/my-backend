import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.js";

const BANNED_GOLD_PILL_TERMS = [
  "online communities",
  "blue pill",
  "red pill",
  "awareness of harsh realities",
  "personal fulfillment",
  "non-traditional methods",
];

async function postJson(pathname, body, options = {}) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return { status: response.status, payload };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function getJson(pathname, options = {}) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      headers: options.headers || {},
    });
    const payload = await response.json();
    return { status: response.status, payload };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertCanonicalGoldPillReply(reply) {
  assert.ok(
    reply.startsWith("The Gold Pill is a core concept within MeetJoz and neoMAXX."),
    `Expected canonical opening, received: ${reply}`
  );

  for (const bannedTerm of BANNED_GOLD_PILL_TERMS) {
    assert.doesNotMatch(reply, new RegExp(bannedTerm, "i"));
  }
}

test("POST /api/joz-llm routes gold pill queries through canonical world concept", async () => {
  const { status, payload } = await postJson("/api/joz-llm", {
    sessionKey: "runtime-joz-llm-gold-pill",
    messages: [{ role: "user", content: "What is the gold pill?" }],
    context: {
      currentPortal: "root",
      currentMesh: "ball",
      currentMeshStage: null,
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.mode, "canonical_world_concept");
  assert.equal(payload.trace?.detectedIntent, "canonical_world_concept");
  assert.equal(payload.trace?.detectedSubIntent, "gold_pill");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "canonical_world_concept");
  assert.equal(payload.trace?.selectedWorldRecord, "root_gold_pill / gold_pill concept");
  assert.equal(payload.trace?.answerSource, "root_gold_pill / gold_pill concept");
  assert.equal(payload.trace?.composer, "composeCanonicalWorldConceptReply");
  assert.equal(payload.trace?.fallbackUsed, false);
  assertCanonicalGoldPillReply(String(payload.reply || ""));
});

test("POST /api/agentic preserves canonical world awareness in the live response contract", async () => {
  const { status, payload } = await postJson("/api/agentic", {
    input: "What is the gold pill?",
    context: {
      currentPortal: "root",
      currentMesh: "ball",
      allowedActions: ["brain", "ball"],
      knownInteractiveMeshes: ["brain", "ball"],
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.intent, "world_awareness");
  assert.equal(payload.params?.source, "world_awareness");
  assert.equal(payload.trace?.detectedConcept, "gold_pill");
  assert.equal(payload.trace?.selectedRoute, "world_awareness");
  assert.equal(payload.trace?.selectedWorldRecord, "root_gold_pill / gold_pill concept");
  assertCanonicalGoldPillReply(String(payload.response || ""));
  assertCanonicalGoldPillReply(String(payload.params?.awareness || ""));
});

test("POST /api/joz-llm/callback-request stores callback requests and returns delivery status", async () => {
  const { status, payload } = await postJson("/api/joz-llm/callback-request", {
    sessionKey: "runtime-callback-request",
    name: "Casey Example",
    phone: "+1 415 555 0100",
    time: "Tomorrow 3pm",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.match(String(payload.delivery?.status || ""), /^(delivered|stored_only|delivery_failed)$/);
  assert.ok(Array.isArray(payload.delivery?.channels));
  assert.match(String(payload.persistedTo || ""), /^(database|memory)$/);
});

test("POST /api/joz-llm/callback-request validates required fields", async () => {
  const { status, payload } = await postJson("/api/joz-llm/callback-request", {
    name: "Casey Example",
    time: "Tomorrow 3pm",
  });

  assert.equal(status, 400);
  assert.match(String(payload.error || ""), /missing callback name, phone, or time/i);
});

test("GET /api/privacy/meta exposes retention defaults and processors", async () => {
  const { status, payload } = await getJson("/api/privacy/meta");

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.retentionDays?.conversations, 30);
  assert.equal(payload.retentionDays?.callbackRequests, 30);
  assert.equal(payload.retentionDays?.privacyRequests, 365);
  assert.ok(Array.isArray(payload.processors));
  assert.ok(payload.processors.includes("Supabase"));
  assert.ok(payload.processors.includes("OpenAI"));
  assert.ok(payload.processors.includes("Resend"));
});

test("POST /api/privacy/export returns matching fallback callback request data", async () => {
  const uniqueEmail = `casey+${Date.now()}@example.com`;
  const uniquePhone = `+41 76 497 ${String(Date.now()).slice(-4)}`;
  const seed = await postJson("/api/joz-llm/callback-request", {
    sessionKey: "privacy-export-seed",
    name: "Casey Example",
    phone: uniquePhone,
    email: uniqueEmail,
    time: "Monday 10:00",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
    },
  });

  assert.equal(seed.status, 200);

  const { status, payload } = await postJson("/api/privacy/export", {
    email: uniqueEmail,
    phone: uniquePhone,
  });

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data?.callbackRequests?.length, 1);
  const exportedCallback = payload.data?.callbackRequests?.[0] || {};
  assert.equal(
    exportedCallback.name || exportedCallback.requested_name,
    "Casey Example"
  );
  assert.equal(
    exportedCallback.email || exportedCallback.requested_email,
    uniqueEmail
  );
  assert.ok(Array.isArray(payload.data?.conversations));
  assert.ok(Array.isArray(payload.data?.messages));

  if (payload.data?.conversations?.length) {
    assert.ok(
      payload.data.conversations.some(
        (conversation) =>
          String(conversation.id || "") === String(exportedCallback.conversation_id || "")
      )
    );
  }

  if (payload.data?.messages?.length) {
    assert.ok(
      payload.data.messages.some((message) =>
        ["callback_request", "callback_status"].includes(String(message.message_kind || ""))
      )
    );
  }
});

test("POST /api/privacy/delete removes matching fallback callback request data", async () => {
  const uniqueEmail = `jordan+${Date.now()}@example.com`;
  const uniquePhone = `+1 415 555 ${String(Date.now()).slice(-4)}`;
  const seed = await postJson("/api/joz-llm/callback-request", {
    sessionKey: "privacy-delete-seed",
    name: "Jordan Example",
    phone: uniquePhone,
    email: uniqueEmail,
    time: "Friday 16:00",
    context: {
      currentPortal: "meet-joz",
      currentMesh: "discover",
      currentMeshStage: "discover_stop",
    },
  });

  assert.equal(seed.status, 200);

  const deletion = await postJson("/api/privacy/delete", {
    email: uniqueEmail,
    phone: uniquePhone,
  });

  assert.equal(deletion.status, 200);
  assert.equal(deletion.payload.ok, true);
  assert.equal(deletion.payload.deletion?.deletedCallbackRequests, 1);

  const exportedAfterDelete = await postJson("/api/privacy/export", {
    email: uniqueEmail,
    phone: uniquePhone,
  });

  assert.equal(exportedAfterDelete.status, 200);
  assert.equal(exportedAfterDelete.payload.data?.callbackRequests?.length, 0);
});

test("POST /api/privacy/export validates lookup requirements", async () => {
  const { status, payload } = await postJson("/api/privacy/export", {});

  assert.equal(status, 400);
  assert.match(String(payload.error || ""), /provide conversationid and sessionkey/i);
});

const JOZ_ROUTER_GATE_CASES = [
  {
    name: "identity_profile",
    body: {
      sessionKey: "runtime-joz-identity",
      messages: [{ role: "user", content: "Who is Joz?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "identity_profile",
      detectedSubIntent: "overview",
      detectedConcept: "joz_identity",
      selectedRoute: "identity_profile",
      answerSource: "JOZ_LLM_CV + JOZ_LLM_IDENTITY",
      composer: "composeIdentityProfileReply",
      fallbackUsed: false,
    },
    text: [/Joz Krupa/i],
  },
  {
    name: "factual_profile.education",
    body: {
      sessionKey: "runtime-joz-education",
      messages: [{ role: "user", content: "Where did Joz study?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "factual_profile",
      detectedSubIntent: "education",
      detectedConcept: "education",
      selectedRoute: "factual_profile",
      answerSource: "JOZ_LLM_CV.education + JOZ_LLM_IDENTITY",
      composer: "composeFactualProfileReply",
      fallbackUsed: false,
    },
    text: [/University of Central Lancashire/i],
  },
  {
    name: "skills.capabilities_overview",
    body: {
      sessionKey: "runtime-joz-skills",
      messages: [{ role: "user", content: "What can Joz do?" }],
      context: {
        currentPortal: "meet-joz",
        currentMesh: "skills",
        currentMeshStage: "skills_stop",
      },
    },
    expected: {
      detectedIntent: "skills",
      detectedSubIntent: "capabilities_overview",
      detectedConcept: "skills",
      selectedRoute: "skills",
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSkillsReply",
      fallbackUsed: false,
    },
    text: [/agentic ai architecture/i],
  },
  {
    name: "systems_mindset",
    body: {
      sessionKey: "runtime-joz-mindset",
      messages: [{ role: "user", content: "How does Joz think?" }],
      context: {
        currentPortal: "root",
        currentMesh: "brain",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "systems_mindset",
      detectedSubIntent: "thinking_model",
      detectedConcept: "systems_mindset",
      selectedRoute: "systems_mindset",
      answerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer: "composeSystemsMindsetReply",
      fallbackUsed: false,
    },
    text: [/systems before features|signal from noise/i],
  },
  {
    name: "business_need",
    body: {
      sessionKey: "runtime-joz-business",
      messages: [{ role: "user", content: "Why should we hire Joz?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "business_need",
      detectedSubIntent: "hire_value",
      detectedConcept: "business_value",
      selectedRoute: "business_need",
      answerSource: "JOZ_LLM_CV.experience",
      composer: "composeBusinessNeedReply",
      fallbackUsed: false,
    },
    text: [/Maybank|Mediacorp|Erste Bank|Manulife/i],
  },
  {
    name: "canonical_world_concept.gold_pill",
    body: {
      sessionKey: "runtime-joz-gold-pill-2",
      messages: [{ role: "user", content: "What is the Gold Pill?" }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    },
    expected: {
      detectedIntent: "canonical_world_concept",
      detectedSubIntent: "gold_pill",
      detectedConcept: "gold_pill",
      selectedRoute: "canonical_world_concept",
      answerSource: "root_gold_pill / gold_pill concept",
      composer: "composeCanonicalWorldConceptReply",
      fallbackUsed: false,
    },
    text: [/The Gold Pill is a core concept within MeetJoz and neoMAXX\./i],
  },
];

for (const testCase of JOZ_ROUTER_GATE_CASES) {
  test(`POST /api/joz-llm six-query gate: ${testCase.name}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", testCase.body);

    assert.equal(status, 200);
    assert.equal(payload.trace?.detectedIntent, testCase.expected.detectedIntent);
    assert.equal(payload.trace?.detectedSubIntent, testCase.expected.detectedSubIntent);
    assert.equal(payload.trace?.detectedConcept, testCase.expected.detectedConcept);
    assert.equal(payload.trace?.selectedRoute, testCase.expected.selectedRoute);
    assert.equal(payload.trace?.answerSource, testCase.expected.answerSource);
    assert.equal(payload.trace?.composer, testCase.expected.composer);
    assert.equal(payload.trace?.fallbackUsed, testCase.expected.fallbackUsed);

    for (const matcher of testCase.text) {
      assert.match(String(payload.reply || ""), matcher);
    }

    assert.doesNotMatch(String(payload.reply || ""), /Joz LLM can explain Joz's fit/i);
  });
}

const OWNED_CONCEPT_ENDPOINT_CASES = [
  {
    name: "flex",
    query: "What is Flex?",
    selectedWorldRecord: "flex",
    composer: "composeFlexAnswer",
    text: [/arrival/i, /presence/i, /vibe/i, /atmosphere/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    name: "ascend",
    query: "What is Ascend?",
    selectedWorldRecord: "ascend",
    composer: "composeAscendAnswer",
    text: [/discovery/i, /progression/i, /scale/i, /recognition|proof/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    name: "mogg",
    query: "What is Mogging?",
    selectedWorldRecord: "meet_joz_mogg",
    composer: "composeMoggAnswer",
    text: [/digital twin/i, /Meet Joz/i, /Ascend/i, /Workf/i],
    forbidden: [/root_gold_pill/i, /Gold Pill/i, /online communities/i, /slang/i],
  },
  {
    name: "workf",
    query: "What is Workf?",
    selectedWorldRecord: "workf",
    composer: "composeWorkfAnswer",
    text: [/skills/i, /deep work/i, /execution/i, /technical depth/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    name: "worldx",
    query: "What is Worldx?",
    selectedWorldRecord: "worldx",
    composer: "composeWorldxAnswer",
    text: [/semantic city/i, /Meet Joz/i, /environment/i, /sequence/i],
    forbidden: [/online communities/i, /slang/i],
  },
];

for (const testCase of OWNED_CONCEPT_ENDPOINT_CASES) {
  test(`POST /api/joz-llm routes owned concept canonically: ${testCase.name}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", {
      sessionKey: `runtime-owned-concept-${testCase.name}`,
      messages: [{ role: "user", content: testCase.query }],
      context: {
        currentPortal: "meet-joz",
        currentMesh: "mogg",
        currentMeshStage: "skills_stop",
      },
    });

    assert.equal(status, 200);
    assert.equal(payload.mode, "world_awareness");
    assert.equal(payload.trace?.detectedIntent, "world_awareness");
    assert.equal(payload.trace?.selectedRoute, "world_awareness");
    assert.equal(payload.trace?.selectedWorldRecord, testCase.selectedWorldRecord);
    assert.equal(payload.trace?.answerSource, "canonical_concept");
    assert.equal(payload.trace?.responseMode, "concept_explainer");
    assert.equal(payload.trace?.composer, testCase.composer);
    assert.equal(payload.trace?.fallbackUsed, false);
    assert.equal(payload.trace?.validationPassed, true);

    const reply = String(payload.reply || "");
    for (const matcher of testCase.text) {
      assert.match(reply, matcher);
    }
    for (const matcher of testCase.forbidden) {
      assert.doesNotMatch(reply, matcher);
    }
    assert.doesNotMatch(reply, /You are inside/i);
    assert.doesNotMatch(reply, /You are focused on/i);
    assert.doesNotMatch(reply, /Available actions/i);
  });
}

for (const query of [
  "What is Mogg?",
  "Tell me about Mogg.",
  "Who is Mogg?",
  "Explain Mogg.",
]) {
  test(`POST /api/joz-llm explicit Mogg query wins over root focus: ${query}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", {
      sessionKey: `runtime-mogg-${query}`,
      messages: [{ role: "user", content: query }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
        app_context: {
          current_portal: "root",
          focused_object: "root_gold_pill",
          device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
        },
      },
    });

    assert.equal(status, 200);
    assert.equal(payload.mode, "world_awareness");
    assert.equal(payload.trace?.detectedIntent, "world_awareness");
    assert.equal(payload.trace?.detectedConcept, "mogg");
    assert.equal(payload.trace?.selectedRoute, "world_awareness");
    assert.equal(payload.trace?.selectedWorldRecord, "meet_joz_mogg");
    assert.equal(payload.trace?.responseMode, "concept_explainer");
    assert.equal(payload.trace?.fallbackUsed, false);
    assert.match(String(payload.reply || ""), /digital twin/i);
    assert.match(String(payload.reply || ""), /Meet Joz/i);
    assert.match(String(payload.reply || ""), /Ascend/i);
    assert.match(String(payload.reply || ""), /Workf/i);
    assert.doesNotMatch(String(payload.reply || ""), /root_gold_pill/i);
    assert.doesNotMatch(String(payload.reply || ""), /Gold Pill/i);
    assert.doesNotMatch(String(payload.reply || ""), /You are inside/i);
    assert.doesNotMatch(String(payload.reply || ""), /You are focused on/i);
    assert.doesNotMatch(String(payload.reply || ""), /Available actions/i);
  });
}

for (const query of [
  "What is neoMAXX?",
  "What is neo/maxx?",
  "What is NEO/MAXX?",
  "What is Neomaxxing?",
]) {
  test(`POST /api/joz-llm canonical neoMAXX branding holds: ${query}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", {
      sessionKey: `runtime-neomaxx-${query}`,
      messages: [{ role: "user", content: query }],
      context: {
        currentPortal: "root",
        currentMesh: "brain",
        currentMeshStage: null,
      },
    });

    assert.equal(status, 200);
    assert.equal(payload.mode, "canonical_world_concept");
    assert.equal(payload.trace?.detectedConcept, "neo_maxx");
    assert.equal(payload.trace?.selectedRoute, "canonical_world_concept");
    assert.equal(payload.trace?.fallbackUsed, false);
    assert.match(String(payload.reply || ""), /^neoMAXX is a concept created by Joz Krupa\./);
  });
}

const RECRUITER_OPERATIONAL_CASES = [
  {
    name: "location",
    query: "Where is Joz located?",
    expectedReply:
      "Joz operates across Dubai, Singapore, Zurich, Europe, and global markets.",
    expectedIntent: "recruiter_location",
    expectedComposer: "composeLocationAnswer",
    forbidden: [/Slovakia/i, /Bratislava/i, /\bEP\b/i, /\bPEP\b/i],
  },
  {
    name: "availability",
    query: "Is Joz available?",
    expectedReply:
      "Joz is open to discussing suitable opportunities. Availability depends on the role, location, scope, and start-date requirements.",
    expectedIntent: "recruiter_availability",
    expectedComposer: "composeAvailabilityAnswer",
    forbidden: [],
  },
  {
    name: "compensation",
    query: "What salary does Joz want?",
    expectedReply:
      "Compensation depends on the role scope, location, seniority, responsibilities, and overall package. The best next step is a direct conversation with Joz.",
    expectedIntent: "recruiter_compensation",
    expectedComposer: "composeCompensationAnswer",
    forbidden: [/\b(?:usd|sgd|eur|gbp|aed|chf|\$|€|£)\s*\d/i, /\b\d+\s*(k|K)\b/],
  },
  {
    name: "contact",
    query: "How can I contact Joz?",
    expectedReply:
      "You can contact Joz by phone at +65 3107 2412 or by email at joz@meetjoz.com.",
    expectedIntent: "recruiter_contact",
    expectedComposer: "composeContactAnswer",
    forbidden: [],
  },
  {
    name: "work_authorization",
    query: "Does Joz have a Singapore EP?",
    expectedReply:
      "Joz's current work-authorization status should be confirmed directly for the specific hiring process.",
    expectedIntent: "recruiter_work_authorization",
    expectedComposer: "composeWorkAuthorizationAnswer",
    forbidden: [/currently has an EP/i, /currently has a PEP/i, /active Singapore work authorization/i],
  },
];

for (const testCase of RECRUITER_OPERATIONAL_CASES) {
  test(`POST /api/joz-llm deterministic recruiter operational answer: ${testCase.name}`, async () => {
    const { status, payload } = await postJson("/api/joz-llm", {
      sessionKey: `runtime-recruiter-${testCase.name}`,
      messages: [{ role: "user", content: testCase.query }],
      context: {
        currentPortal: "root",
        currentMesh: "ball",
        currentMeshStage: null,
      },
    }, {
      headers: {
        "x-forwarded-for": `198.51.100.${80 + RECRUITER_OPERATIONAL_CASES.indexOf(testCase)}`,
      },
    });

    assert.equal(status, 200);
    assert.equal(payload.mode, "joz_knowledge");
    assert.equal(payload.reply, testCase.expectedReply);
    assert.equal(payload.trace?.detectedIntent, testCase.expectedIntent);
    assert.equal(payload.trace?.selectedRoute, "joz_knowledge");
    assert.equal(payload.trace?.answerSource, "deterministic_recruiter_operational");
    assert.equal(payload.trace?.selectedOperationalComposer, testCase.expectedComposer);
    assert.deepEqual(payload.trace?.recommendedActionIds, ["call_joz", "email_joz"]);
    assert.equal(payload.trace?.validationPassed, true);
    assert.equal(payload.trace?.fallbackUsed, false);
    assert.deepEqual(
      payload.actions?.map((action) => action.id),
      ["call_joz", "email_joz"]
    );
    assert.deepEqual(
      payload.actions?.map((action) => action.label),
      ["Call Joz", "Email Joz"]
    );
    for (const matcher of testCase.forbidden) {
      assert.doesNotMatch(String(payload.reply || ""), matcher);
    }
  });
}

test("POST /api/joz-llm deep technical skills does not return recruiter actions", async () => {
  const { status, payload } = await postJson("/api/joz-llm", {
    sessionKey: "runtime-deep-technical-skills",
    messages: [{ role: "user", content: "What are Joz's deep technical skills?" }],
    context: {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
    },
  }, {
    headers: {
      "x-forwarded-for": "198.51.100.99",
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.trace?.detectedIntent, "skills");
  assert.equal(payload.trace?.selectedRoute, "skills");
  assert.equal(Array.isArray(payload.actions) ? payload.actions.length : 0, 0);
  assert.doesNotMatch(
    String(payload.reply || ""),
    /\bSlovak\b|\bsalary\b|\bEP\b|\bPEP\b|\+65 3107 2412|joz@meetjoz\.com/i
  );
});
