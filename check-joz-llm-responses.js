#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  composeJozLlmRouteReply,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, expected = [], label) {
  const lower = String(text || "").toLowerCase();
  for (const value of expected) {
    assert(lower.includes(String(value).toLowerCase()), `${label}: missing "${value}"`);
  }
}

function assertExcludes(text, forbidden = [], label) {
  const lower = String(text || "").toLowerCase();
  for (const value of forbidden) {
    assert(!lower.includes(String(value).toLowerCase()), `${label}: must not include "${value}"`);
  }
}

function wordCount(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function buildContexts(overrides = {}) {
  const appContext = {
    currentPortal: "root",
    currentMesh: "ball",
    currentMeshStage: null,
    ...overrides,
  };

  return {
    appContext,
    legacyContext: {},
  };
}

function loadHumanEvalCases() {
  const filePath = path.join(__dirname, "content", "joz-llm-human-evals.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const CORE_CASES = [
  {
    name: "Business Value Definition",
    prompt: "What is business value?",
    expectedRoute: "business_need",
    expectedSubIntent: "business_value_definition",
    minWords: 45,
    maxWords: 80,
    includes: ["measurable", "revenue", "margin", "cost"],
    excludes: ["Maybank-Ageas Etiqa", "worth hiring"],
  },
  {
    name: "Efficiency",
    prompt: "How does Joz create business value through efficiency, lower cost, faster execution, and stronger operational leverage?",
    expectedRoute: "business_need",
    expectedSubIntent: "efficiency",
    minWords: 55,
    maxWords: 90,
    includes: ["process cost", "cycle time", "operational leverage", "Leo Burnett/Publicis"],
    excludes: ["20x digital sales growth", "30x audience growth"],
  },
  {
    name: "Growth",
    prompt: "How does Joz use AI systems to support growth, scaling, better decisions, and stronger commercial performance?",
    expectedRoute: "business_need",
    expectedSubIntent: "growth",
    minWords: 55,
    maxWords: 90,
    includes: ["commercial", "20x digital sales growth", "30x audience growth", "11 APAC markets"],
    excludes: ["Leo Burnett/Publicis", "handoff friction"],
  },
  {
    name: "Functions",
    prompt: "How can Joz create business value across functions like finance, ERP, accounting, HR, marketing, and operations?",
    expectedRoute: "business_need",
    expectedSubIntent: "functions",
    minWords: 55,
    maxWords: 95,
    includes: ["finance", "ERP", "accounting", "HR", "marketing", "operations"],
    excludes: ["20x digital sales growth", "worth hiring"],
  },
  {
    name: "Decision Support",
    prompt: "How does Joz improve decision support through better signal, prioritization, judgment, and clarity in noisy business environments?",
    expectedRoute: "business_need",
    expectedSubIntent: "decision_support",
    minWords: 55,
    maxWords: 110,
    includes: ["signal", "prioritization", "judgment", "accountable execution"],
    excludes: ["finance and accounting"],
  },
  {
    name: "Why Hire Joz",
    prompt: "Why should we hire Joz now?",
    expectedRoute: "business_need",
    expectedSubIntent: "hire_value",
    minWords: 35,
    maxWords: 80,
    includes: ["Maybank-Ageas Etiqa", "Manulife", "Mediacorp", "Erste Bank"],
    excludes: ["What is business value"],
  },
];

const HUMAN_CASES = loadHumanEvalCases().map((testCase) => ({
  name: `Human Eval: ${testCase.name}`,
  prompt: testCase.prompt,
  expectedRoute: testCase.expectedRoute,
  expectedSubIntent: testCase.expectedSubIntent,
  includes: testCase.requiredPhrases || [],
  excludes: testCase.forbiddenPhrases || [],
  context: testCase.context || {},
}));

function runCase(testCase) {
  const { appContext, legacyContext } = buildContexts(testCase.context || {});
  const route = routeJozLlmQuery({
    input: testCase.prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: testCase.prompt,
    appContext,
    legacyContext,
  });

  const reply = String(resolution?.reply || "");
  const words = wordCount(reply);

  assert(route.selectedRoute === testCase.expectedRoute, `${testCase.name}: expected route ${testCase.expectedRoute}, got ${route.selectedRoute}`);
  assert(route.detectedSubIntent === testCase.expectedSubIntent, `${testCase.name}: expected sub-intent ${testCase.expectedSubIntent}, got ${route.detectedSubIntent}`);
  if (Number.isFinite(testCase.minWords)) {
    assert(words >= testCase.minWords, `${testCase.name}: expected at least ${testCase.minWords} words, got ${words}`);
  }
  if (Number.isFinite(testCase.maxWords)) {
    assert(words <= testCase.maxWords, `${testCase.name}: expected at most ${testCase.maxWords} words, got ${words}`);
  }
  assertIncludes(reply, testCase.includes, testCase.name);
  assertExcludes(reply, testCase.excludes, testCase.name);

  console.log(`PASS ${testCase.name}`);
  console.log(`  route=${route.selectedRoute} subIntent=${route.detectedSubIntent} words=${words}`);
  console.log(`  ${reply}`);
}

function run() {
  const cases = [...CORE_CASES, ...HUMAN_CASES];
  for (const testCase of cases) {
    runCase(testCase);
  }
  console.log(`All response checks passed (${cases.length} cases).`);
}

try {
  run();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
