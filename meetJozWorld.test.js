import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMeetJozWorldManifest,
  loadMeetJozWorldSources,
} from "./tools/build-meetjoz-world.js";
import {
  buildMeetJozWorldAnswerContext,
  buildMeetJozWorldAwarenessReply,
  buildMeetJozWorldAwarenessResolution,
  resolveMeetJozWorldState,
  routeMeetJozWorldIntent,
  validateAppContext,
} from "./shared/meetJozWorld.js";

test("world build validation succeeds for canonical sources", () => {
  const { manifest, report } = buildMeetJozWorldManifest(loadMeetJozWorldSources());

  assert.equal(report.status, "ok");
  assert.equal(manifest.world.id, "meetjoz_spatial_world");
  assert.ok(manifest.objects.length >= 20);
});

test("world build rejects duplicate ids", () => {
  const sources = loadMeetJozWorldSources();
  sources.objects = [...sources.objects, { ...sources.objects[0] }];

  assert.throws(() => buildMeetJozWorldManifest(sources), /MeetJoz world build failed/);
});

test("world build rejects broken relationships", () => {
  const sources = loadMeetJozWorldSources();
  sources.relationships = [
    ...sources.relationships,
    { source_id: "root_gold_pill", type: "navigates_to", target_id: "missing_target" },
  ];

  assert.throws(() => buildMeetJozWorldManifest(sources), /MeetJoz world build failed/);
});

test("world build rejects invalid sequence stages", () => {
  const sources = loadMeetJozWorldSources();
  sources.sequences = [
    {
      ...sources.sequences[0],
      stage_ids: ["maxx_signal_transfer", "maxx_synapse_connection"],
    },
    ...sources.sequences.slice(1),
  ];

  assert.throws(() => buildMeetJozWorldManifest(sources), /MeetJoz world build failed/);
});

test("world build rejects invalid action object references", () => {
  const sources = loadMeetJozWorldSources();
  sources.actions = [
    ...sources.actions,
    {
      id: "broken_action",
      action: "broken",
      label: "Broken",
      target_object_id: "missing_object",
    },
  ];

  assert.throws(() => buildMeetJozWorldManifest(sources), /MeetJoz world build failed/);
});

test("device behavior resolution matches current object and device", () => {
  const state = resolveMeetJozWorldState({
    appContext: {
      current_portal: "maxx",
      focused_object: "maxx_neurons",
      device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
    },
  });

  assert.equal(state.focusedObject?.id, "maxx_neurons");
  assert.equal(state.deviceBehaviors[0]?.effect, "pause_and_reveal");
});

test("runtime app_context validation normalizes legacy meet-joz state", () => {
  const result = validateAppContext(
    {
      current_portal: "meet_joz",
      focused_object: "skills",
      device: { class: "mobile", mobile: true, ar_available: true, spatial_available: false },
    },
    {
      currentPortal: "meet-joz",
      currentMesh: "skills",
      currentMeshStage: "skills_stop",
    }
  );

  assert.equal(result.value.current_portal, "meet_joz");
  assert.equal(result.value.focused_object, "meet_joz_mogg");
  assert.equal(result.value.current_stage, "meet_joz_mogg_stage");
});

test("intent routing distinguishes knowledge, awareness, and mixed", () => {
  assert.equal(routeMeetJozWorldIntent("What is Joz strongest at?"), "joz_knowledge");
  assert.equal(routeMeetJozWorldIntent("What am I looking at?"), "world_awareness");
  assert.equal(routeMeetJozWorldIntent("Where are Joz's skills?"), "mixed");
  assert.equal(routeMeetJozWorldIntent("What is the Gold Pill?"), "world_awareness");
  assert.equal(routeMeetJozWorldIntent("Gold Pill"), "world_awareness");
  assert.equal(routeMeetJozWorldIntent("pill"), "world_awareness");
  assert.equal(routeMeetJozWorldIntent("capsule"), "world_awareness");
});

test("world-aware answer context summarizes portal, object, and actions", () => {
  const context = buildMeetJozWorldAnswerContext({
    input: "What happens when I click the neuron?",
    appContext: {
      current_portal: "maxx",
      focused_object: "maxx_neurons",
      device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
    },
  });

  assert.equal(context.portal, "maxx");
  assert.equal(context.focused_object, "maxx_neurons");
  assert.equal(context.route, "world_awareness");
  assert.ok(context.available_action_ids.includes("pause_neurons"));
});

test("world-aware replies explain stage meaning and next action", () => {
  const reply = buildMeetJozWorldAwarenessReply({
    input: "What stage am I in?",
    appContext: {
      current_portal: "meet_joz",
      focused_object: "mogg",
      current_stage: "meet_joz_mogg_stage",
      available_actions: ["show_skills_layer", "back_to_root"],
      device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
    },
  });

  assert.match(reply, /Mogg/);
  assert.match(reply, /digital twin/);
  assert.match(reply, /Open Skills Layer|Return to root/);
});

test("gold pill reply uses canonical world definition instead of generic internet fallback", () => {
  const reply = buildMeetJozWorldAwarenessReply({
    input: "What is the Gold Pill?",
    appContext: {
      current_portal: "root",
      focused_object: "root_gold_pill",
      available_actions: ["go_meet_joz", "go_maxx_via_enter"],
      device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
    },
  });

  assert.ok(reply.startsWith("The Gold Pill is a core concept within MeetJoz and neoMAXX."));
  assert.match(reply, /skills/i);
  assert.match(reply, /capabilities/i);
  assert.match(reply, /competences/i);
  assert.match(reply, /innovation/i);
  assert.match(reply, /\bAI\b/i);
  assert.match(reply, /competitive advantage/i);
  assert.match(reply, /route into Meet Joz/i);
  assert.doesNotMatch(reply, /online communities/i);
  assert.doesNotMatch(reply, /blue pill/i);
  assert.doesNotMatch(reply, /red pill/i);
  assert.doesNotMatch(reply, /awareness of harsh realities/i);
  assert.doesNotMatch(reply, /personal fulfillment/i);
  assert.doesNotMatch(reply, /non-traditional methods/i);
  assert.doesNotMatch(reply, /^The gold pill typically refers to/i);
});

test("gold pill reply explains MAXX role when current portal is maxx", () => {
  const reply = buildMeetJozWorldAwarenessReply({
    input: "Tell me about the Gold Pill",
    appContext: {
      current_portal: "maxx",
      focused_object: "maxx_neurons",
      available_actions: ["pause_neurons", "resume_neurons"],
      device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
    },
  });

  assert.match(reply, /neoMAXX/i);
  assert.match(reply, /transforms human and AI potential into innovation/i);
  assert.doesNotMatch(reply, /^The gold pill typically refers to/i);
});

const OWNED_CONCEPT_CASES = [
  {
    input: "What is Flex?",
    concept: "flex",
    terms: [/arrival/i, /presence/i, /vibe/i, /atmosphere/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is Ascend?",
    concept: "ascend",
    terms: [/discovery/i, /progression/i, /scale/i, /recognition|proof/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is Mogg?",
    concept: "mogg",
    terms: [/digital twin/i, /identity layer/i, /presence/i, /embodiment/i],
    forbidden: [/root/i, /gold pill/i, /online communities/i, /slang/i, /\.glb/i, /stage id/i, /object id/i],
  },
  {
    input: "What is Workf?",
    concept: "workf",
    terms: [/skills/i, /deep work/i, /execution/i, /technical depth/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is Worldx?",
    concept: "worldx",
    terms: [/semantic city/i, /Meet Joz/i, /environment/i, /sequence/i],
    forbidden: [/online communities/i, /slang/i],
  },
  {
    input: "What is Aura?",
    concept: "aura",
    terms: [/emotional/i, /perceptual/i, /presence/i, /atmosphere/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is Frame?",
    concept: "frame",
    terms: [/structure/i, /proportion/i, /coherence/i, /perception/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is Ascension?",
    concept: "ascension",
    terms: [/consistency/i, /precision/i, /discipline/i, /conditioning|refinement/i],
    forbidden: [/fitness advice/i, /online culture/i, /looksmaxxing/i],
  },
  {
    input: "What is Dominance?",
    concept: "dominance",
    terms: [/signal/i, /presence/i, /impact/i, /clarity/i],
    forbidden: [/aggression/i, /social superiority/i, /hierarchy/i],
  },
  {
    input: "What is 10/10 Frame Mogg?",
    concept: "frame_mogg",
    terms: [/structure/i, /proportion/i, /symmetry/i, /style/i, /aura/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
  {
    input: "What is The Elite Beauty?",
    concept: "elite_beauty",
    terms: [/Neurodesign layer/i, /Ascension/i, /Frame Mogg/i, /perception design/i],
    forbidden: [/looksmaxxing/i, /online communities/i, /slang/i],
  },
];

for (const testCase of OWNED_CONCEPT_CASES) {
  test(`owned concept replies stay canonical: ${testCase.concept}`, () => {
    const resolution = buildMeetJozWorldAwarenessResolution({
      input: testCase.input,
      appContext: {
        current_portal: "meet_joz",
        focused_object: "meet_joz_mogg",
        current_stage: "meet_joz_mogg_stage",
        device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
      },
    });

    assert.equal(routeMeetJozWorldIntent(testCase.input), "world_awareness");
    assert.equal(resolution.answerSource, "canonical_concept");
    assert.equal(
      resolution.selectedWorldRecord,
      testCase.concept === "mogg" ? "meet_joz_mogg" : testCase.concept
    );
    assert.equal(resolution.detectedConcept, testCase.concept);
    assert.equal(resolution.fallbackUsed, false);
    assert.equal(resolution.validationPassed, true);
    assert.equal(resolution.responseMode, "concept_explainer");

    const reply = String(resolution.reply || "");
    for (const matcher of testCase.terms) {
      assert.match(reply, matcher);
    }
    for (const matcher of testCase.forbidden) {
      assert.doesNotMatch(reply, matcher);
    }
  });
}

const MOGG_EXPLICIT_QUERY_CASES = [
  "What is Mogg?",
  "What is Mogging?",
  "Tell me about Mogg.",
  "Who is Mogg?",
  "Explain Mogg.",
];

for (const input of MOGG_EXPLICIT_QUERY_CASES) {
  test(`explicit Mogg query beats focused root object: ${input}`, () => {
    const resolution = buildMeetJozWorldAwarenessResolution({
      input,
      appContext: {
        current_portal: "root",
        focused_object: "root_gold_pill",
        current_stage: null,
        available_actions: ["go_meet_joz", "go_maxx_via_enter"],
        device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
      },
    });

    assert.equal(resolution.detectedConcept, "mogg");
    assert.equal(resolution.selectedWorldRecord, "meet_joz_mogg");
    assert.equal(resolution.fallbackUsed, false);
    assert.equal(resolution.answerSource, "canonical_concept");
    assert.equal(resolution.responseMode, "concept_explainer");
    assert.match(String(resolution.reply || ""), /digital twin/i);
    assert.match(String(resolution.reply || ""), /identity layer/i);
    assert.match(String(resolution.reply || ""), /presence/i);
    assert.match(String(resolution.reply || ""), /embodiment/i);
    assert.doesNotMatch(String(resolution.reply || ""), /root_gold_pill/i);
    assert.doesNotMatch(String(resolution.reply || ""), /Gold Pill/i);
    assert.doesNotMatch(String(resolution.reply || ""), /You are inside/i);
    assert.doesNotMatch(String(resolution.reply || ""), /You are focused on/i);
    assert.doesNotMatch(String(resolution.reply || ""), /Available actions/i);
    assert.doesNotMatch(String(resolution.reply || ""), /\.glb|stage id|object id|renderer/i);
  });
}

const CONCEPT_EXPLAINER_CASES = [
  {
    input: "What is Flex?",
    concept: "flex",
    terms: [/arrival/i, /presence/i, /vibe/i, /identity/i],
  },
  {
    input: "What is Ascend?",
    concept: "ascend",
    terms: [/discovery/i, /progression/i, /proof|recognition/i, /scale/i],
  },
  {
    input: "What is Mogging?",
    concept: "mogg",
    terms: [/digital twin/i, /identity layer/i, /presence/i, /embodiment/i],
  },
  {
    input: "What is Workf?",
    concept: "workf",
    terms: [/deep work/i, /skills/i, /execution/i, /technical depth/i],
  },
];

for (const testCase of CONCEPT_EXPLAINER_CASES) {
  test(`explicit concept query uses concept explainer mode: ${testCase.input}`, () => {
    const resolution = buildMeetJozWorldAwarenessResolution({
      input: testCase.input,
      appContext: {
        current_portal: "meet_joz",
        focused_object: "meet_joz_semantic_city",
        current_stage: null,
        available_actions: ["show_flex", "show_ascend", "show_mogg"],
        device: { class: "desktop", mobile: false, ar_available: false, spatial_available: false },
      },
    });

    assert.equal(resolution.detectedConcept, testCase.concept);
    assert.equal(resolution.responseMode, "concept_explainer");
    assert.equal(resolution.fallbackUsed, false);
    const reply = String(resolution.reply || "");
    for (const matcher of testCase.terms) {
      assert.match(reply, matcher);
    }
    assert.doesNotMatch(reply, /You are inside/i);
    assert.doesNotMatch(reply, /You are focused on/i);
    assert.doesNotMatch(reply, /Available actions/i);
    assert.doesNotMatch(reply, /\.glb|stage id|object id|renderer/i);
  });
}
