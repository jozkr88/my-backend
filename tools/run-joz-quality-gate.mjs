import fs from "node:fs/promises";
import path from "node:path";
import {
  buildJozIntentClassification,
  buildJozRiskGateResolution,
  buildJozSafetyRefusalResolution,
} from "../shared/jozIntent.js";
import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQueryWithAwareness,
} from "../shared/jozLlmRouter.js";
import { buildJozResponseVerification } from "../shared/jozLlmObservability.js";

const root = path.resolve(process.cwd());
const corpusName = process.env.JOZ_QUALITY_CORPUS || "joz-llm-golden-273.json";
const corpusPath = path.resolve(root, "content", corpusName);
const realUserPath = path.resolve(root, "content/joz-llm-real-user-anonymized.json");
const baselinePath = path.resolve(root, "content/joz-quality-baseline.json");
const reportPath = path.resolve(root, process.env.JOZ_QUALITY_REPORT_PATH || "content/joz-quality-latest-report.json");
const writeArtifacts = process.env.JOZ_QUALITY_WRITE_ARTIFACTS === "true";

const corpus = JSON.parse(await fs.readFile(corpusPath, "utf8"));
const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
let realUserCases = [];
try {
  const realUser = JSON.parse(await fs.readFile(realUserPath, "utf8"));
  realUserCases = Array.isArray(realUser.cases) ? realUser.cases : [];
} catch {
  realUserCases = [];
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function latestUserMessage(caseDefinition) {
  const messages = Array.isArray(caseDefinition.messages) ? caseDefinition.messages : [];
  return String(messages.findLast?.((message) => message?.role === "user")?.content || caseDefinition.question || "");
}

async function evaluateCase(caseDefinition) {
  const input = latestUserMessage(caseDefinition);
  const messages = Array.isArray(caseDefinition.messages)
    ? caseDefinition.messages
    : [{ role: "user", content: input }];
  const route = routeJozLlmQueryWithAwareness({
    input,
    recentMessages: messages,
  });
  const intent = buildJozIntentClassification({ input, route });
  const safetyRefusalResolution = buildJozSafetyRefusalResolution({ classification: intent });
  const riskResolution = buildJozRiskGateResolution({ classification: intent });
  const ownedResolution = composeJozLlmRouteReply({
    route,
    input,
    recentMessages: messages,
    retrievedDocuments: [],
  });
  const resolution = safetyRefusalResolution || riskResolution || ownedResolution || (await resolveUnknownJozReply({
    input,
    messages,
    openai: null,
    roleAwareContext: { retrievedDocuments: [], intentClassification: intent },
    intentClassification: intent,
  }));
  const reply = String(resolution?.reply || "");
  const trace = {
    ...buildJozRouteTrace(route, resolution),
    intentClassification: intent,
  };
  const verification = buildJozResponseVerification({
    input,
    route,
    resolution,
    trace,
    reply,
    retrievedDocuments: [],
    latencyMs: 0,
  });
  const expected = caseDefinition.expected || {};
  const answer = lower(reply);
  const intentFailures = [];
  const answerFailures = [];
  const riskFailures = [];
  const groundingFailures = [];

  if (expected.route && route.selectedRoute !== expected.route) {
    intentFailures.push(`route=${route.selectedRoute}, expected=${expected.route}`);
  }
  if (expected.subIntent && route.detectedSubIntent !== expected.subIntent) {
    intentFailures.push(`subIntent=${route.detectedSubIntent}, expected=${expected.subIntent}`);
  }
  if (expected.kind && intent.kind !== expected.kind) {
    intentFailures.push(`kind=${intent.kind}, expected=${expected.kind}`);
  }
  if (expected.domain && intent.domain !== expected.domain) {
    intentFailures.push(`domain=${intent.domain}, expected=${expected.domain}`);
  }
  if (expected.requiresConversationContext && messages.length < 2) {
    intentFailures.push("conversation context was not supplied");
  }

  for (const phrase of caseDefinition.requiredPhrases || []) {
    if (!answer.includes(lower(phrase))) groundingFailures.push(`missing required phrase: ${phrase}`);
  }
  for (const phrase of caseDefinition.forbiddenPhrases || []) {
    if (answer.includes(lower(phrase))) answerFailures.push(`forbidden phrase: ${phrase}`);
  }
  if (!reply.trim()) answerFailures.push("empty reply");
  if (verification.status === "fail") answerFailures.push("deterministic verification failed");

  const isRiskCase = expected.kind === "execute" || expected.risk === "high" || expected.risk === "medium";
  if (isRiskCase) {
    if (intent.kind !== "execute") riskFailures.push(`not classified as execute: ${intent.kind}`);
    if (intent.risk.level !== expected.risk) riskFailures.push(`risk=${intent.risk.level}, expected=${expected.risk}`);
    if (Boolean(intent.risk.requiresApproval) !== Boolean(expected.requiresApproval)) {
      riskFailures.push(`requiresApproval=${intent.risk.requiresApproval}, expected=${expected.requiresApproval}`);
    }
    if (expected.requiresApproval && resolution?.answerClass !== "risk_gate") {
      riskFailures.push(`resolution=${resolution?.answerClass || "missing"}, expected risk_gate`);
    }
  }

  return {
    id: caseDefinition.id,
    category: caseDefinition.category,
    question: caseDefinition.question,
    route: route.selectedRoute,
    subIntent: route.detectedSubIntent,
    intent,
    verification: verification.status,
    reply,
    intentPass: intentFailures.length === 0,
    answerPass: answerFailures.length === 0,
    riskPass: riskFailures.length === 0,
    groundingPass: groundingFailures.length === 0,
    failures: { intent: intentFailures, answer: answerFailures, risk: riskFailures, grounding: groundingFailures },
    needsHumanReview:
      intentFailures.length > 0 ||
      answerFailures.length > 0 ||
      riskFailures.length > 0 ||
      groundingFailures.length > 0 ||
      (verification.status === "warn" && intent.confidenceBand === "low" && expected.kind !== "clarify"),
  };
}

const results = [];
for (const caseDefinition of corpus.cases || []) results.push(await evaluateCase(caseDefinition));

const total = results.length;
const count = (key) => results.filter((result) => result[key]).length;
const riskResults = results.filter((result) => result.category === "adversarial" && result.intent?.kind === "execute" || result.failures.risk.length > 0 || result.intent?.risk?.requiresApproval);
const report = {
  version: 1,
  corpus: corpusName,
  deployId: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null,
  total,
  generatedAt: new Date().toISOString(),
  metrics: {
    intentAccuracy: total ? count("intentPass") / total : 0,
    answerQuality: total ? count("answerPass") / total : 0,
    grounding: total ? count("groundingPass") / total : 0,
    riskGatePassRate: riskResults.length ? riskResults.filter((result) => result.riskPass).length / riskResults.length : 1,
    riskCases: riskResults.length,
    humanReviewRequired: results.filter((result) => result.needsHumanReview).length,
  },
  failures: results.filter((result) => result.needsHumanReview).slice(0, 100),
  results,
  realUserFixture: {
    total: realUserCases.length,
    labeled: realUserCases.filter((item) => item.humanLabel).length,
    pendingHumanLabels: realUserCases.filter((item) => !item.humanLabel).length,
  },
};

if (writeArtifacts) {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  const queuePath = path.resolve(root, "content/joz-human-review-queue.json");
  await fs.writeFile(queuePath, JSON.stringify({
    version: 1,
    description: "Human review queue for borderline or failed Joz quality cases.",
    generatedAt: report.generatedAt,
    reviewInstructions: [
      "Label the intended kind, domain, route, and risk level.",
      "Score answer correctness, relevance, groundedness, and safety from 0 to 5.",
      "Record a concise correction or rationale; do not paste personal data into notes.",
    ],
    cases: [
      ...report.failures.map((result) => ({
        ...result,
        humanReview: { status: "pending", reviewer: null, label: null, scores: null, notes: "" },
      })),
      ...realUserCases
        .filter((item) => !item.humanLabel)
        .map((item) => ({
          ...item,
          humanReview: { status: "pending", reviewer: null, label: null, scores: null, notes: "" },
        })),
    ],
  }, null, 2) + "\n", "utf8");
}

console.log(JSON.stringify({
  corpus: corpusName,
  total,
  metrics: report.metrics,
  thresholds: baseline.thresholds,
  artifactWritten: writeArtifacts,
}, null, 2));

const failures = [];
for (const [metric, minimum] of Object.entries(baseline.thresholds || {})) {
  if (metric === "maxHumanReviewRequired") continue;
  if (metric === "riskGatePassRate" && report.metrics[metric] < minimum) failures.push(`${metric}=${report.metrics[metric]} < ${minimum}`);
  else if (metric !== "maxRiskFailures" && report.metrics[metric] < minimum) failures.push(`${metric}=${report.metrics[metric]} < ${minimum}`);
}
if (report.metrics.riskGatePassRate < 1) failures.push("riskGatePassRate must remain 1.0");
if (report.metrics.humanReviewRequired > Number(baseline.thresholds?.maxHumanReviewRequired ?? total)) {
  failures.push(`humanReviewRequired=${report.metrics.humanReviewRequired} exceeds baseline limit`);
}
if (failures.length) {
  console.error(JSON.stringify({ qualityGate: "failed", failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ qualityGate: "passed" }, null, 2));
}
