import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildJozContextPacket } from "../shared/jozContextEngineering.js";
import {
  buildJozCausalReasoningContext,
  isJozCausalKnowledgeDocument,
  isJozCausalKnowledgeQuestion,
} from "../shared/jozCausalKnowledge.js";
import { evaluateJozCausalResponse } from "../shared/jozCausalResponseEvaluation.js";

const root = path.resolve(process.cwd());
for (const envPath of [path.resolve(root, "server/.env"), path.resolve(root, ".env")]) {
  dotenv.config({ path: envPath });
}

const live = process.argv.includes("--live");
const model = process.env.JOZ_EVAL_MODEL || process.env.JOZ_MODEL || "gpt-4o-mini";
const goldenPath = path.resolve(root, "data/joz/evaluations/causal-response-golden.json");
const publishedPath = path.resolve(root, "data/joz/published/joz-documents.generated.json");
const golden = JSON.parse(await fs.readFile(goldenPath, "utf8"));
const published = JSON.parse(await fs.readFile(publishedPath, "utf8"));
const records = Array.isArray(published.records) ? published.records : [];

function rankCausalDocuments(question) {
  const terms = String(question || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3);
  return records
    .filter(isJozCausalKnowledgeDocument)
    .map((document) => {
      const haystack = [document.title, document.summary, document.body, document.metadata?.slug]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { document, score };
    })
    .sort((left, right) => right.score - left.score || String(left.document.slug).localeCompare(String(right.document.slug)))
    .slice(0, 8)
    .map(({ document }) => ({
      title: document.title,
      category: document.category,
      summary: document.summary,
      body: document.body,
      metadata: { ...(document.metadata || {}), slug: document.slug, causalKnowledge: true },
    }));
}

function buildEvaluationContext(caseDefinition) {
  const question = String(caseDefinition.question || "");
  const causalQuestion = isJozCausalKnowledgeQuestion(question);
  const documents = causalQuestion ? rankCausalDocuments(question) : [];
  const causalKnowledge = causalQuestion
    ? {
        ...buildJozCausalReasoningContext({ query: question, documents, graph: null }),
        activeInContext: documents.length > 0,
        documentCount: documents.length,
      }
    : null;
  const packet = buildJozContextPacket({
    input: question,
    messages: [{ role: "user", content: question }],
    context: { currentPortal: "root", currentMesh: "ball" },
    intentMode: "skills",
    route: { selectedRoute: "unknown_fallback", detectedSubIntent: "general" },
    intentClassification: { kind: "answer", domain: "general_knowledge", needsClarification: false },
    agentPlan: { stage: "agent", strategy: "retrieve_then_answer", tools: ["joz_knowledge"] },
    retrievedDocuments: documents,
    retrievalMeta: causalKnowledge ? { causalKnowledge } : {},
  });
  return { causalQuestion, documents, causalKnowledge, packet };
}

async function callOpenAI(openai, question, packet) {
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content:
          "Answer the user's question directly as Joz MAXX. Use the supplied context as grounding. For causal questions, distinguish association from causation, state assumptions, avoid unsupported certainty, and label conceptual guidance versus empirical evidence. Do not claim personal experience or empirical results that are not in the context.",
      },
      { role: "system", content: JSON.stringify(packet) },
      { role: "user", content: question },
    ],
  });
  return String(response.choices?.[0]?.message?.content || "").trim();
}

const openai = live
  ? (() => {
      if (!process.env.OPENAI_API_KEY) throw new Error("--live requires OPENAI_API_KEY in server/.env or the environment");
      return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    })()
  : null;

const results = [];
for (const caseDefinition of golden.cases || []) {
  const context = buildEvaluationContext(caseDefinition);
  const reply = live ? await callOpenAI(openai, caseDefinition.question, context.packet) : "";
  const evaluation = evaluateJozCausalResponse({
    caseDefinition,
    reply,
    causalKnowledge: context.causalQuestion ? context.causalKnowledge : null,
    requireReply: live,
  });
  results.push({
    ...evaluation,
    causalQuestionDetected: context.causalQuestion,
    retrievedDocumentCount: context.documents.length,
    reply: live ? reply : undefined,
  });
}

const failed = results.filter((result) => !result.pass);
const report = {
  version: 1,
  mode: live ? "live_openai" : "offline_contract",
  model: live ? model : null,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  causalCases: results.filter((result) => result.expectedCausal).length,
  causalContextsActive: results.filter((result) => result.expectedCausal && result.detectedCausal).length,
  ordinaryCasesWithoutCausalContext: results.filter((result) => !result.expectedCausal && !result.detectedCausal).length,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
