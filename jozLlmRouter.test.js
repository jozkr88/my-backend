import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";
import { validateAppContext } from "./shared/meetJozWorld.js";

function buildContexts(context = {}) {
  const legacyContext = {
    currentPortal: context.currentPortal || "root",
    currentMesh: context.currentMesh || null,
    currentMeshStage: context.currentMeshStage || null,
  };

  return {
    legacyContext,
    appContext: validateAppContext({}, legacyContext).value,
  };
}

test("routes identity profile queries ahead of assistant fallback", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Who is Joz?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Who is Joz?",
    appContext,
    legacyContext,
  });
  const trace = buildJozRouteTrace(route, resolution);

  assert.equal(route.selectedRoute, "identity_profile");
  assert.equal(trace.fallbackUsed, false);
  assert.match(resolution.reply, /Joz Krupa is an Agentic AI Architecture and Innovation Leader/i);
  assert.doesNotMatch(resolution.reply, /Joz LLM can explain/i);
});

test("routes education queries to factual profile education", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Where did Joz study?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Where did Joz study?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "factual_profile");
  assert.equal(route.detectedSubIntent, "education");
  assert.match(resolution.reply, /University of Central Lancashire/i);
});

test("routes Gold Pill queries to canonical world concept before world awareness", () => {
  const { appContext, legacyContext } = buildContexts({
    currentPortal: "root",
    currentMesh: "ball",
  });
  const route = routeJozLlmQuery({
    input: "What is the Gold Pill?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "canonical_world_concept");
  assert.equal(route.detectedConcept, "gold_pill");
});

test("routes deep skills queries to skills and returns technical depth reply", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const route = routeJozLlmQuery({
    input: "What are deep skills of Joz?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "What are deep skills of Joz?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "capabilities_overview");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Agentic AI|agentic AI/i);
  assert.match(resolution.reply, /RAG/i);
  assert.match(resolution.reply, /context engineering/i);
  assert.match(resolution.reply, /decision intelligence/i);
  assert.match(resolution.reply, /AI governance/i);
  assert.match(resolution.reply, /Python|FastAPI/i);
  assert.match(resolution.reply, /enterprise architecture|enterprise/i);
  assert.doesNotMatch(resolution.reply, /Slovak|EU national|\bEP\b|\bPEP\b|work authorization/i);
  assert.equal(Array.isArray(resolution.actions) ? resolution.actions.length : 0, 0);
});

test("routes recruiter location queries to deterministic operational answer with actions", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Where is Joz located?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Where is Joz located?",
    appContext,
    legacyContext,
  });
  const trace = buildJozRouteTrace(route, resolution);

  assert.equal(route.detectedIntent, "recruiter_location");
  assert.equal(route.selectedRoute, "joz_knowledge");
  assert.equal(resolution.reply, "Joz operates across Dubai, Singapore, Zurich, Europe, and global markets.");
  assert.equal(resolution.selectedOperationalComposer, "composeLocationAnswer");
  assert.deepEqual(
    resolution.actions.map((action) => action.id),
    ["call_joz", "email_joz"]
  );
  assert.equal(trace.selectedOperationalComposer, "composeLocationAnswer");
  assert.deepEqual(trace.recommendedActionIds, ["call_joz", "email_joz"]);
  assert.equal(trace.validationPassed, true);
  assert.equal(trace.fallbackUsed, false);
});

test("programme employer queries can resolve from retrieved programme records without model fallback", async () => {
  const resolution = await resolveUnknownJozReply({
    input: "What did Joz do at Mediacorp?",
    messages: [{ role: "user", content: "What did Joz do at Mediacorp?" }],
    openai: null,
    roleAwareContext: {
      retrievedDocuments: [
        {
          title: "National Media Platforms and Mobile Transformation — Mediacorp, Singapore",
          category: "project",
          summary:
            "National-scale media, election, news, streaming, CMS, mobile, Apple Watch, and corporate experience architecture across Mediacorp.",
          metadata: {
            companies: ["Mediacorp", "Channel NewsAsia"],
            projects: [
              "Channel NewsAsia iOS and Android apps",
              "Apple Watch app UX for Channel NewsAsia",
              "Toggle/mewatch VoD",
              "Corporate-wide UX Guidelines",
            ],
          },
        },
      ],
    },
  });

  assert.equal(resolution.fallbackUsed, false);
  assert.equal(resolution.composer, "buildProgrammeRecordReply");
  assert.match(resolution.reply, /Mediacorp/i);
  assert.match(resolution.reply, /Apple Watch/i);
  assert.match(resolution.reply, /VoD/i);
  assert.match(resolution.reply, /Corporate-wide UX Guidelines/i);
});
