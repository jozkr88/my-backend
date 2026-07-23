import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { initDatabase, listRecentJozLlmRequestEvents } from "../db.js";

for (const envPath of [path.resolve(process.cwd(), "server/.env"), path.resolve(process.cwd(), ".env")]) {
  dotenv.config({ path: envPath });
}

const outputPath = path.resolve(process.cwd(), "content/joz-llm-real-user-anonymized.json");
const syntheticSessionPatterns = [
  /^openai-quality-/i,
  /^(production|rotation|more-test|golden|quality|deploy|staging|check)-/i,
  /^test(?:-|$)/i,
];

function redact(value = "") {
  let text = String(value || "")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[PHONE]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[ID]")
    .replace(/\b(?:api[_ -]?key|token|secret|password|private key)\s*[:=]?\s*\S+/gi, "$1 [REDACTED]")
    .replace(/\b(?:joz(?:ef)?\s+krupa)\b/gi, "[PERSON]")
    .replace(/\b(?:my name is|i am|i'm)\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?/g, "$1 [NAME]")
    .replace(/\b(?:account|order|invoice|ticket|case)\s*#?\s*[A-Z0-9-]{4,}\b/gi, "$1 [REFERENCE]")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 700);
}

function isSafeForFixture(raw, redacted) {
  if (!redacted || redacted.length < 3) return false;
  if (/\[EMAIL\]|\[PHONE\]|\[IP\]/.test(redacted)) return false;
  if (/\b(?:password|secret|private key|seed phrase|social security|passport number)\b/i.test(raw)) return false;
  return true;
}

await initDatabase();
const rows = await listRecentJozLlmRequestEvents(100);
const cases = [];
const seen = new Set();

for (const row of rows) {
  const sessionKey = String(row.session_key || "").trim();
  if (syntheticSessionPatterns.some((pattern) => pattern.test(sessionKey))) continue;

  const rawQuestion = String(row.user_message || "").trim();
  const question = redact(rawQuestion);
  if (!isSafeForFixture(rawQuestion, question)) continue;
  const rawAnswer = String(row.assistant_reply || "").trim();
  const assistantReply = redact(rawAnswer);
  if (!isSafeForFixture(rawAnswer, assistantReply)) continue;
  const dedupeKey = question.toLowerCase();
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  cases.push({
    id: `real-user-${String(row.id)}`,
    category: "real_user",
    question,
    assistantReply,
    observedRoute: row.route || null,
    observedVerification: row.verification?.status || null,
    expected: null,
    humanLabel: null,
    reviewStatus: "pending",
    source: "anonymized_production_observability",
  });
}

await fs.writeFile(
  outputPath,
  JSON.stringify({
    version: 1,
    description: "Redacted, deduplicated production questions for human labeling. Synthetic evaluation sessions are excluded.",
    generatedAt: new Date().toISOString(),
    privacy: {
      rawMessagesPersisted: false,
      redactions: ["url", "email", "phone", "ip", "uuid", "credential", "personal name heuristic", "reference number"],
      humanLabelRequired: true,
    },
    total: cases.length,
    cases,
  }, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({ outputPath, total: cases.length, excludedSyntheticOrSensitive: rows.length - cases.length }, null, 2));
process.exit(0);
