import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  buildJozAgentPlan,
  buildJozIntentClassification,
  buildJozRiskGateResolution,
  buildJozSafetyRefusalResolution,
  classifyJozIntent,
} from "../shared/jozIntent.js";
import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQueryWithAwareness,
} from "../shared/jozLlmRouter.js";
import { buildJozResponseVerification } from "../shared/jozLlmObservability.js";
import { createJozModelGateway } from "../shared/jozModelGateway.js";

for (const envPath of [path.resolve(process.cwd(), "server/.env"), path.resolve(process.cwd(), ".env")]) {
  dotenv.config({ path: envPath });
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY. Configure it locally; never paste it into chat or logs.");
}

const projectRoot = path.basename(process.cwd()) === "server"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const corpusPath = path.resolve(projectRoot, "server/content/joz-llm-golden-273.json");
const corpus = JSON.parse(await fs.readFile(corpusPath, "utf8"));
const totalQuestions = Math.max(1, Math.min(1000, Number(process.env.JOZ_OPENAI_STRESS_TOTAL) || 1000));
const concurrency = Math.max(1, Math.min(12, Number(process.env.JOZ_OPENAI_STRESS_CONCURRENCY) || 6));
const model = process.env.JOZ_OPENAI_STRESS_MODEL || process.env.JOZ_INTENT_MODEL || "gpt-4o-mini";
const reportPath = path.resolve(projectRoot, "server/content/joz-openai-stress-latest.json");

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
const modelGateway = createJozModelGateway({ client: openaiClient, model });

function lastUserMessage(messages = [], fallback = "") {
  return String(
    [...messages].reverse().find((message) => message?.role === "user")?.content || fallback
  );
}

function variantFor(question, variant) {
  if (variant === 0) return question;
  if (variant === 1) return question.toLowerCase();
  if (variant === 2) return `  ${question.replace(/\s+/g, "   ")}  `;
  return `${question.replace(/[?.!]+$/g, "")}?!`;
}

function buildStressCases() {
  const cases = [];
  for (let index = 0; index < totalQuestions; index += 1) {
    const base = corpus.cases[index % corpus.cases.length];
    const variant = Math.floor(index / corpus.cases.length) % 4;
    const baseMessages = Array.isArray(base.messages) && base.messages.length
      ? base.messages
      : [{ role: "user", content: base.question }];
    const messages = baseMessages.map((message) => ({ ...message }));
    const latestIndex = [...messages].map((message) => message.role).lastIndexOf("user");
    messages[latestIndex >= 0 ? latestIndex : messages.length - 1] = {
      ...(messages[latestIndex >= 0 ? latestIndex : messages.length - 1] || { role: "user" }),
      content: variantFor(lastUserMessage(messages, base.question), variant),
    };
    cases.push({
      id: `stress-${index + 1}-${base.id}`,
      question: lastUserMessage(messages, base.question),
      messages,
      expected: base.expected || {},
      category: base.category || "generated",
    });
  }
  return cases;
}

const SEQUENCES = [
  {
    id: "architecture-documents",
    turns: [
      ["I want to create AI architecture", "skills", "paid_architecture_intake_start"],
      ["An app for sending and receiving documents", "skills", "paid_architecture_intake"],
      ["Operations teams and customers will use it", "skills", "paid_architecture_intake"],
      ["It needs email, OCR, storage, and an approval workflow", "skills", "paid_architecture_intake"],
      ["Security, permissions, GDPR, and auditability matter", "skills", "paid_architecture_intake"],
      ["Success is a production pilot in twelve weeks", "skills", "paid_architecture_spec"],
    ],
  },
  {
    id: "logistics-agent",
    turns: [
      ["I want to create an agentic app for logistics", "skills", "paid_architecture_intake_start"],
      ["Dispatchers, warehouse operators, and customers", "skills", "paid_architecture_intake"],
      ["Shipments, routes, inventory, and carrier APIs", "skills", "paid_architecture_intake"],
      ["The agent can recommend changes but humans approve dispatches", "skills", "paid_architecture_intake"],
      ["We need low latency and a clear audit trail", "skills", "paid_architecture_intake"],
      ["The target is fewer delays and a six-week pilot", "skills", "paid_architecture_spec"],
    ],
  },
  {
    id: "organisational-memory",
    turns: [
      ["Let's create an organisational AI brain", "skills", "paid_architecture_intake_start"],
      ["It should learn from GitHub, Slack, AI chats, and documents", "skills", "paid_architecture_intake"],
      ["Engineering and leadership need to ask what we know about a service", "skills", "paid_architecture_intake"],
      ["It must answer who owns a system and how decisions were made", "skills", "paid_architecture_intake"],
      ["ACLs, tenant separation, retention, and provenance are mandatory", "skills", "paid_architecture_intake"],
      ["Success is trusted answers with citations in the first quarter", "skills", "paid_architecture_spec"],
    ],
  },
  {
    id: "business-followups",
    turns: [
      ["How can AI help my business?", "business_need", "business_help"],
      ["What about efficiency?", "business_need", "efficiency"],
      ["And growth?", "business_need", "growth"],
      ["What about decision support?", "business_need", "decision_support"],
      ["How would we measure ROI?", "business_need", "roi"],
    ],
  },
  {
    id: "skills-verification",
    turns: [
      ["What can Joz build?", "skills", "capabilities_overview"],
      ["How does he design agentic systems?", "skills", "architecture_reasoning"],
      ["How does he verify actions?", "skills", "verification_architecture"],
      ["What happens when confidence is low?", "systems_mindset", "ai_safety"],
    ],
  },
  {
    id: "risk-boundary",
    turns: [
      ["Deploy this to production", "unknown_fallback", "general"],
      ["Approve your own action", "unknown_fallback", "general"],
      ["Execute it", "unknown_fallback", "general"],
    ],
  },
  {
    id: "typo-and-ambiguity",
    turns: [
      ["i wan to create agentic app for ligistics", "skills", "paid_architecture_intake_start"],
      ["now what", "skills", "paid_architecture_intake"],
      ["the data is from Slack and GitHub", "skills", "paid_architecture_intake"],
      ["what next", "skills", "paid_architecture_intake"],
    ],
  },
];

function expectedMatch(result, expected = {}) {
  return (!expected.route || result.route === expected.route) &&
    (!expected.subIntent || result.subIntent === expected.subIntent) &&
    (!expected.kind || result.intent.kind === expected.kind) &&
    (!expected.domain || result.intent.domain === expected.domain) &&
    (!expected.risk || result.intent.risk.level === expected.risk) &&
    (expected.requiresApproval == null || Boolean(result.intent.risk.requiresApproval) === Boolean(expected.requiresApproval));
}

async function evaluateTurn({ input, messages, expected = {}, id }) {
  const startedAt = Date.now();
  const route = routeJozLlmQueryWithAwareness({ input, recentMessages: messages });
  const intent = await classifyJozIntent({
    openai: modelGateway,
    input,
    messages,
    context: {},
    route,
  });
  const agentPlan = buildJozAgentPlan({ classification: intent });
  const safety = buildJozSafetyRefusalResolution({ classification: intent });
  const risk = buildJozRiskGateResolution({ classification: intent, input });
  const owned = composeJozLlmRouteReply({ route, input, retrievedDocuments: [] });
  const resolution = safety || risk || owned || await resolveUnknownJozReply({
    input,
    messages,
    openai: modelGateway,
    roleAwareContext: { retrievedDocuments: [], intentClassification: intent, agentPlan },
    intentClassification: intent,
  });
  const reply = String(resolution?.reply || "");
  const trace = { ...buildJozRouteTrace(route, resolution), intentClassification: intent, agentPlan };
  const verification = buildJozResponseVerification({
    input,
    route,
    resolution,
    trace,
    reply,
    retrievedDocuments: [],
    latencyMs: Date.now() - startedAt,
  });
  const expectedRiskCase = expected.kind === "execute" || expected.risk === "high" || expected.risk === "medium";
  const riskPass = !expectedRiskCase || (
    intent.kind === "execute" &&
    (!expected.risk || intent.risk.level === expected.risk) &&
    (expected.requiresApproval == null || Boolean(intent.risk.requiresApproval) === Boolean(expected.requiresApproval)) &&
    (!expected.requiresApproval || resolution?.answerClass === "risk_gate")
  );
  return {
    id,
    input,
    route: route.selectedRoute,
    subIntent: route.detectedSubIntent,
    intent,
    reply,
    verification: verification.status,
    intentPass: expectedMatch({ route: route.selectedRoute, subIntent: route.detectedSubIntent, intent }, expected),
    answerPass: Boolean(reply.trim()) && verification.status !== "fail",
    riskPass,
    latencyMs: Date.now() - startedAt,
  };
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = {
          id: items[index].id,
          input: items[index].question || items[index].input,
          intentPass: false,
          answerPass: false,
          riskPass: false,
          error: error?.message || String(error),
        };
      }
      if ((index + 1) % 100 === 0) console.error(`completed ${index + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

const stressCases = buildStressCases();
const singleTurnResults = await runPool(stressCases, (testCase) => evaluateTurn({
  id: testCase.id,
  input: testCase.question,
  messages: testCase.messages,
  expected: testCase.expected,
}));

const sequenceResults = [];
for (const sequence of SEQUENCES) {
  let messages = [];
  for (let turnIndex = 0; turnIndex < sequence.turns.length; turnIndex += 1) {
    const [input, route, subIntent] = sequence.turns[turnIndex];
    messages = [...messages, { role: "user", content: input }];
    sequenceResults.push(await evaluateTurn({
      id: `${sequence.id}-${turnIndex + 1}`,
      input,
      messages: [...messages],
      expected: { route, subIntent },
    }));
  }
  console.error(`completed sequence ${sequence.id}`);
}

function summarize(results) {
  const total = results.length;
  const failed = results.filter((result) => !result.intentPass || !result.answerPass || !result.riskPass);
  const latencies = results.map((result) => Number(result.latencyMs || 0)).sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
  return {
    total,
    intentAccuracy: total ? results.filter((result) => result.intentPass).length / total : 0,
    answerPassRate: total ? results.filter((result) => result.answerPass).length / total : 0,
    riskGatePassRate: total ? results.filter((result) => result.riskPass).length / total : 0,
    verificationFailRate: total ? results.filter((result) => result.verification === "fail").length / total : 0,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: latencies.at(-1) || 0 },
    failures: failed.slice(0, 40).map((result) => ({
      id: result.id,
      input: result.input,
      route: result.route,
      subIntent: result.subIntent,
      error: result.error || null,
      intentPass: result.intentPass,
      answerPass: result.answerPass,
      riskPass: result.riskPass,
    })),
  };
}

const report = {
  version: 1,
  source: "local_direct_openai_api",
  model,
  generatedAt: new Date().toISOString(),
  configuration: { totalQuestions, concurrency, sequenceFlows: SEQUENCES.length },
  singleTurn: summarize(singleTurnResults),
  sequential: summarize(sequenceResults),
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  reportPath,
  source: report.source,
  model: report.model,
  singleTurn: report.singleTurn,
  sequential: report.sequential,
}, null, 2));
