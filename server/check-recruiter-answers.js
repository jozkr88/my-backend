#!/usr/bin/env node

import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";
import { validateAppContext } from "./shared/meetJozWorld.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, needle, label) {
  assert(String(text || "").toLowerCase().includes(String(needle).toLowerCase()), `${label}: missing "${needle}"`);
}

function assertExcludes(text, needle, label) {
  assert(!String(text || "").toLowerCase().includes(String(needle).toLowerCase()), `${label}: must not include "${needle}"`);
}

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

function runCase(testCase) {
  const { appContext, legacyContext } = buildContexts(testCase.context);
  const route = routeJozLlmQuery({
    input: testCase.input,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: testCase.input,
    appContext,
    legacyContext,
  });
  const trace = buildJozRouteTrace(route, resolution);

  assert(route.selectedRoute === testCase.expectedRoute, `${testCase.name}: selectedRoute expected ${testCase.expectedRoute} got ${route.selectedRoute}`);
  assert(route.detectedIntent === testCase.expectedIntent, `${testCase.name}: detectedIntent expected ${testCase.expectedIntent} got ${route.detectedIntent}`);

  if (testCase.expectedSubIntent) {
    assert(route.detectedSubIntent === testCase.expectedSubIntent, `${testCase.name}: detectedSubIntent expected ${testCase.expectedSubIntent} got ${route.detectedSubIntent}`);
  }

  if (testCase.expectedAnswerSource) {
    assert(trace.answerSource === testCase.expectedAnswerSource, `${testCase.name}: answerSource expected ${testCase.expectedAnswerSource} got ${trace.answerSource}`);
  }

  if (testCase.expectedComposer) {
    assert(trace.selectedOperationalComposer === testCase.expectedComposer || trace.composer === testCase.expectedComposer, `${testCase.name}: composer expected ${testCase.expectedComposer}`);
  }

  for (const needle of testCase.mustInclude || []) {
    assertIncludes(resolution.reply, needle, `${testCase.name} reply`);
  }

  for (const needle of testCase.mustExclude || []) {
    assertExcludes(resolution.reply, needle, `${testCase.name} reply`);
  }

  if (testCase.expectActions) {
    assert(Array.isArray(resolution.actions) && resolution.actions.length === 2, `${testCase.name}: expected recruiter actions`);
    assert(resolution.actions.some((action) => action.id === "call_joz"), `${testCase.name}: missing call_joz action`);
    assert(resolution.actions.some((action) => action.id === "email_joz"), `${testCase.name}: missing email_joz action`);
  } else {
    assert(!Array.isArray(resolution.actions) || resolution.actions.length === 0, `${testCase.name}: actions should be empty`);
  }

  return {
    name: testCase.name,
    route: route.selectedRoute,
    intent: route.detectedIntent,
    subIntent: route.detectedSubIntent,
    composer: trace.selectedOperationalComposer || trace.composer,
  };
}

const CASES = [
  {
    name: "generic_strengths",
    input: "Explain Joz's strongest skills with proof, not buzzwords.",
    expectedRoute: "skills",
    expectedIntent: "skills",
    expectedSubIntent: "proof_backed_strengths",
    expectedAnswerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
    expectedComposer: "composeSkillsReply",
    mustInclude: ["Maybank", "Manulife", "Mediacorp", "Erste Bank"],
    mustExclude: ["EP", "PEP", "work authorization", "Singapore work pass"],
    expectActions: false,
  },
  {
    name: "generic_ui_ux_css",
    input: "How strong is Joz in CSS, design systems, motion, and accessibility?",
    expectedRoute: "skills",
    expectedIntent: "skills",
    expectedSubIntent: "ui_ux_css_accessibility",
    expectedAnswerSource: "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
    expectedComposer: "composeSkillsReply",
    mustInclude: ["Mediacorp", "Leo Burnett/Publicis", "Maybank", "Erste Bank"],
    expectActions: false,
  },
  {
    name: "generic_compensation",
    input: "What compensation is Joz looking for?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_compensation",
    expectedSubIntent: "compensation",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeCompensationAnswer",
    mustInclude: ["role scope", "location", "overall package"],
    mustExclude: ["SGD", "Singapore role context", "$", "€", "£"],
    expectActions: true,
  },
  {
    name: "generic_work_authorization",
    input: "What is Joz's work authorization status?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_work_authorization",
    expectedSubIntent: "work_authorization",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeWorkAuthorizationAnswer",
    mustInclude: ["Slovak", "EU national", "specific country"],
    mustExclude: ["Singapore", "EP", "PEP"],
    expectActions: true,
  },
  {
    name: "generic_notice_period",
    input: "What is Joz's notice period?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_notice_period",
    expectedSubIntent: "notice_period",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeNoticePeriodAnswer",
    mustInclude: ["notice period", "earliest start date", "confirmed directly"],
    expectActions: true,
  },
  {
    name: "generic_working_model",
    input: "Is Joz open to remote, hybrid, or onsite work?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_working_model",
    expectedSubIntent: "working_model",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeWorkingModelAnswer",
    mustInclude: ["remote", "hybrid", "on-site"],
    expectActions: true,
  },
  {
    name: "singapore_market_fit",
    input: "Why is Joz a fit for Singapore recruiters?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_singapore_fit",
    expectedSubIntent: "singapore_fit",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeSingaporeFitAnswer",
    mustInclude: ["Maybank-Ageas Etiqa", "Manulife", "Mediacorp", "Singapore Stock Exchange", "Singapore"],
    expectActions: true,
  },
  {
    name: "singapore_compensation_explicit",
    input: "What compensation range is Joz targeting in Singapore?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_compensation",
    expectedSubIntent: "singapore_specific",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeSingaporeCompensationAnswer",
    mustInclude: ["Singapore role", "overall package"],
    mustExclude: ["$", "€", "£"],
    expectActions: true,
  },
  {
    name: "singapore_work_authorization_explicit",
    input: "Does Joz need Singapore sponsorship or an EP?",
    expectedRoute: "joz_knowledge",
    expectedIntent: "recruiter_work_authorization",
    expectedSubIntent: "singapore_specific",
    expectedAnswerSource: "deterministic_recruiter_operational",
    expectedComposer: "composeWorkAuthorizationAnswer",
    mustInclude: ["Singapore", "EP", "PEP", "confirmed directly"],
    expectActions: true,
  },
];

function main() {
  const results = CASES.map(runCase);
  console.log(`Recruiter eval passed: ${results.length} case(s).`);
  for (const result of results) {
    console.log(`- ${result.name}: ${result.route} / ${result.intent} / ${result.subIntent} / ${result.composer}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Recruiter eval failed: ${error.message}`);
  process.exitCode = 1;
}
