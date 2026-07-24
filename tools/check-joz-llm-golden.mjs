import fs from "node:fs/promises";
import path from "node:path";
import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQuery,
} from "../shared/jozLlmRouter.js";
import { buildJozResponseVerification } from "../shared/jozLlmObservability.js";

const datasetPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../content/joz-llm-golden-regression.json");
const dataset = JSON.parse(await fs.readFile(datasetPath, "utf8"));

function lower(value) {
  return String(value || "").toLowerCase();
}

async function runCase(caseDefinition) {
  const route = routeJozLlmQuery({ input: caseDefinition.question });
  const ownedResolution = composeJozLlmRouteReply({
    route,
    input: caseDefinition.question,
    retrievedDocuments: [],
  });
  const resolution = ownedResolution || (await resolveUnknownJozReply({
    input: caseDefinition.question,
    messages: [{ role: "user", content: caseDefinition.question }],
    openai: null,
    roleAwareContext: { retrievedDocuments: [] },
  }));
  const reply = String(resolution?.reply || "");
  const trace = buildJozRouteTrace(route, resolution);
  const verification = buildJozResponseVerification({
    input: caseDefinition.question,
    route,
    resolution,
    trace,
    reply,
    retrievedDocuments: [],
    latencyMs: 0,
  });
  const answer = lower(reply);
  const failures = [];

  if (route.selectedRoute !== caseDefinition.expectedRoute) {
    failures.push(`route=${route.selectedRoute}, expected=${caseDefinition.expectedRoute}`);
  }
  if (route.detectedSubIntent !== caseDefinition.expectedSubIntent) {
    failures.push(`subintent=${route.detectedSubIntent}, expected=${caseDefinition.expectedSubIntent}`);
  }
  for (const phrase of caseDefinition.requiredPhrases || []) {
    if (!answer.includes(lower(phrase))) failures.push(`missing phrase: ${phrase}`);
  }
  for (const phrase of caseDefinition.forbiddenPhrases || []) {
    if (answer.includes(lower(phrase))) failures.push(`forbidden phrase: ${phrase}`);
  }
  if (verification.status === "fail") failures.push("deterministic verification failed");

  return {
    id: caseDefinition.id,
    question: caseDefinition.question,
    pass: failures.length === 0,
    route: route.selectedRoute,
    subIntent: route.detectedSubIntent,
    verification: verification.status,
    failures,
  };
}

const results = [];
for (const caseDefinition of dataset.cases || []) {
  results.push(await runCase(caseDefinition));
}

const failed = results.filter((result) => !result.pass);
console.log(JSON.stringify({
  datasetVersion: dataset.version,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2));

if (failed.length) process.exitCode = 1;
