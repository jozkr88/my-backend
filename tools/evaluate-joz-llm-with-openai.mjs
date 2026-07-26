import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  initDatabase,
  isDatabaseEnabled,
  listUnevaluatedJozLlmRequestEvents,
  saveJozLlmEvaluation,
  saveJozLlmRepairCandidate,
} from "../db.js";

for (const envPath of [path.resolve(process.cwd(), "server/.env"), path.resolve(process.cwd(), ".env")]) {
  dotenv.config({ path: envPath });
}

const limit = Math.max(1, Math.min(500, Number(process.env.JOZ_EVAL_LIMIT) || 20));
const model = process.env.JOZ_EVAL_MODEL || "gpt-4o-mini";
const sessionKeyPrefix = String(process.env.JOZ_EVAL_SESSION_PREFIX || "").trim() || null;

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY. Add a current rotated key to server/.env; do not reuse an exposed historical key.");
}

await initDatabase();
if (!isDatabaseEnabled()) {
  throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL. Evaluations require durable database storage.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const events = await listUnevaluatedJozLlmRequestEvents(limit, sessionKeyPrefix);

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(5, Number(score.toFixed(2))));
}

function parseEvaluation(text) {
  const raw = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const parsed = JSON.parse(raw);
  function parseScoreSet(value = {}) {
    const scores = [value.correctness, value.relevance, value.groundedness, value.safety]
      .map(clampScore)
      .filter((score) => score !== null);
    if (!scores.length) {
      return {
        verdict: "warn",
        correctness: null,
        relevance: null,
        groundedness: null,
        safety: null,
      };
    }
    const verdict = scores.some((score) => score < 3)
      ? "fail"
      : scores.some((score) => score < 4)
        ? "warn"
        : "pass";
    return {
      verdict,
      correctness: clampScore(value.correctness),
      relevance: clampScore(value.relevance),
      groundedness: clampScore(value.groundedness),
      safety: clampScore(value.safety),
    };
  }

  const finalScores = parseScoreSet({
    correctness: parsed.correctness,
    relevance: parsed.relevance,
    groundedness: parsed.groundedness,
    safety: parsed.safety,
  });
  const preAnswerScores = parseScoreSet(parsed.preAnswer || parsed.pre_answer || {});
  const derivedVerdict = finalScores.verdict;
  const verdict = ["pass", "warn", "fail"].includes(parsed.verdict) ? parsed.verdict : derivedVerdict;
  return {
    verdict,
    preAnswerVerdict: ["pass", "warn", "fail"].includes(parsed.preAnswerVerdict || parsed.pre_answer_verdict)
      ? (parsed.preAnswerVerdict || parsed.pre_answer_verdict)
      : preAnswerScores.verdict,
    preAnswerCorrectness: preAnswerScores.correctness,
    preAnswerRelevance: preAnswerScores.relevance,
    preAnswerGroundedness: preAnswerScores.groundedness,
    preAnswerSafety: preAnswerScores.safety,
    finalVerdict: ["pass", "warn", "fail"].includes(parsed.finalVerdict || parsed.final_verdict)
      ? (parsed.finalVerdict || parsed.final_verdict)
      : finalScores.verdict,
    correctionEffective:
      parsed.correctionEffective == null && parsed.correction_effective == null
        ? null
        : Boolean(parsed.correctionEffective ?? parsed.correction_effective),
    correctionCritique: String(parsed.correctionCritique || parsed.correction_critique || "").slice(0, 4000),
    correctness: finalScores.correctness,
    relevance: finalScores.relevance,
    groundedness: finalScores.groundedness,
    safety: finalScores.safety,
    critique: String(parsed.critique || "").slice(0, 4000),
    repairNeeded: Boolean(parsed.repairNeeded) || verdict === "fail",
    repairType: ["route", "knowledge", "prompt", "none"].includes(parsed.repairType)
      ? parsed.repairType
      : "none",
    repairSuggestion: String(parsed.repairSuggestion || "").slice(0, 4000),
  };
}

async function evaluateEvent(event) {
  const evaluationResponse = await openai.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a strict evaluator for the Joz LLM. Compare the pre-answer draft and final answer. Judge each for relevance, grounding, coherence, and safety. Determine whether the final answer improved the draft without introducing a regression. Do not penalize an intentional knowledge-boundary answer when the question is genuinely outside the Joz scope. Return JSON only with preAnswer {verdict, correctness, relevance, groundedness, safety}, finalVerdict, correctness, relevance, groundedness, safety, correctionEffective, correctionCritique, critique, repairNeeded, repairType (route, knowledge, prompt, or none), and repairSuggestion. Scores are 0-5.",
      },
      {
        role: "user",
        content: JSON.stringify({
          question: event.user_message,
          preAnswerDraft:
            event?.trace?.verificationFlow?.initial?.reply ||
            event?.trace?.preAnswerDraft ||
            event.assistant_reply,
          finalAnswer: event.assistant_reply,
          verificationFlow: event?.trace?.verificationFlow || null,
          route: event.route,
          intentMode: event.intent_mode,
          deterministicVerification: event.verification,
          retrievedCategories: event.retrieved_categories,
          retrievedDocuments: event.retrieved_documents,
        }).slice(0, 14000),
      },
    ],
  });

  const evaluation = parseEvaluation(evaluationResponse.choices?.[0]?.message?.content || "{}");
  const evaluationId = await saveJozLlmEvaluation({
    requestEventId: event.id,
    evaluatorModel: model,
    ...evaluation,
    rawEvaluation: evaluation,
  });

  let repairCandidateId = null;
  if (evaluation.repairNeeded && evaluation.repairType !== "none" && evaluation.repairSuggestion) {
    repairCandidateId = await saveJozLlmRepairCandidate({
      evaluationId,
      requestEventId: event.id,
      repairType: evaluation.repairType,
      targetKey: event.route || null,
      proposedChange: evaluation.repairSuggestion,
      evidence: {
        question: event.user_message,
        preAnswerDraft:
          event?.trace?.verificationFlow?.initial?.reply ||
          event?.trace?.preAnswerDraft ||
          event.assistant_reply,
        answer: event.assistant_reply,
        correctionEffective: evaluation.correctionEffective,
        verdict: evaluation.verdict,
        evaluatorModel: model,
      },
    });
  }

  return { verdict: evaluation.verdict, repairCandidateId };
}

let passed = 0;
let warned = 0;
let failed = 0;
let repairs = 0;

for (const event of events) {
  const result = await evaluateEvent(event);
  if (result.verdict === "pass") passed += 1;
  if (result.verdict === "warn") warned += 1;
  if (result.verdict === "fail") failed += 1;
  if (result.repairCandidateId) repairs += 1;
}

console.log(JSON.stringify({
  evaluated: events.length,
  model,
  passed,
  warned,
  failed,
  repairCandidatesCreated: repairs,
  note: "Repair candidates are pending review; no production knowledge or routing was changed.",
}, null, 2));
