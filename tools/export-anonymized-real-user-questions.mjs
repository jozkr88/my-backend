import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { initDatabase, listRecentJozLlmRequestEvents } from "../db.js";
import { isSafeJozFixtureText, redactJozFixtureText } from "../shared/jozPrivacy.js";

for (const envPath of [path.resolve(process.cwd(), "server/.env"), path.resolve(process.cwd(), ".env")]) {
  dotenv.config({ path: envPath });
}

const outputPath = path.resolve(process.cwd(), "content/joz-llm-real-user-anonymized.json");
const syntheticSessionPatterns = [
  /^openai-quality-/i,
  /^(production|rotation|more-test|golden|quality|deploy|staging|check)-/i,
  /^test(?:-|$)/i,
];

await initDatabase();
const rows = await listRecentJozLlmRequestEvents(100);
const cases = [];
const seen = new Set();

for (const row of rows) {
  const sessionKey = String(row.session_key || "").trim();
  if (syntheticSessionPatterns.some((pattern) => pattern.test(sessionKey))) continue;

  const rawQuestion = String(row.user_message || "").trim();
  const question = redactJozFixtureText(rawQuestion);
  if (!isSafeJozFixtureText(rawQuestion, question)) continue;
  const rawAnswer = String(row.assistant_reply || "").trim();
  const assistantReply = redactJozFixtureText(rawAnswer);
  if (!isSafeJozFixtureText(rawAnswer, assistantReply)) continue;
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
