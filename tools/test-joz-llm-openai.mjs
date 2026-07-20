import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);
const projectRoot = path.basename(process.cwd()) === "server" ? path.resolve(process.cwd(), "..") : process.cwd();
for (const envPath of [path.resolve(process.cwd(), "server/.env"), path.resolve(process.cwd(), ".env")]) {
  dotenv.config({ path: envPath });
}

const localOnly = process.env.JOZ_OPENAI_LOCAL_ONLY === "true";
if (!process.env.OPENAI_API_KEY && !localOnly) {
  throw new Error("Missing OPENAI_API_KEY. Add a current rotated key to server/.env; never paste it into chat.");
}

const localApiUrl = String(process.env.JOZ_LOCAL_API_URL || "http://127.0.0.1:3016").replace(/\/$/, "");
const datasetName = String(process.env.JOZ_OPENAI_QUALITY_DATASET || "joz-llm-openai-50-scenarios.json").trim();
const datasetPath = path.resolve(projectRoot, "server/content", datasetName);
const dataset = JSON.parse(await fs.readFile(datasetPath, "utf8"));
const limit = Math.max(1, Math.min(100, Number(process.env.JOZ_OPENAI_QUALITY_LIMIT) || dataset.cases.length));
const cases = dataset.cases.slice(0, limit);
const sessionKeyPrefix = `openai-quality-${Date.now()}`;

async function askLocal(question) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${localApiUrl}/api/joz-llm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionKey: `${sessionKeyPrefix}-${Math.random().toString(36).slice(2, 8)}`,
        messages: [{ role: "user", content: question }],
      }),
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`${response.status}: ${body?.error || "local API request failed"}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

const localResults = [];
for (const testCase of cases) {
  const response = await askLocal(testCase.question);
  localResults.push({
    id: testCase.id,
    question: testCase.question,
    route: response?.trace?.selectedRoute || null,
    verification: response?.verification?.status || null,
    reply: response?.reply || "",
  });
}

if (localOnly) {
  console.log(JSON.stringify({
    localApiUrl,
    evaluatedCorpus: cases.length,
    sessionKeyPrefix,
    localResults,
    note: "Local-only run completed. OpenAI judging was intentionally skipped; rerun with a current rotated key to score these responses and store evaluations.",
  }, null, 2));
  process.exit(0);
}

const evaluator = await execFileAsync(
  process.execPath,
  ["tools/evaluate-joz-llm-with-openai.mjs"],
  {
    cwd: path.resolve(projectRoot, "server"),
    env: {
      ...process.env,
      JOZ_EVAL_LIMIT: String(cases.length),
      JOZ_EVAL_SESSION_PREFIX: sessionKeyPrefix,
    },
    maxBuffer: 2 * 1024 * 1024,
  }
);

// db.js may print a startup status line before the evaluator JSON. Parse the
// JSON payload without turning a successful evaluation into a wrapper error.
const evaluatorOutput = String(evaluator.stdout || "").trim();
const evaluatorJsonStart = evaluatorOutput.indexOf("{");
if (evaluatorJsonStart < 0) {
  throw new Error(`OpenAI evaluator returned no JSON summary: ${evaluatorOutput.slice(0, 500)}`);
}
const openaiEvaluation = JSON.parse(evaluatorOutput.slice(evaluatorJsonStart));

console.log(JSON.stringify({
  localApiUrl,
  evaluatedCorpus: cases.length,
  sessionKeyPrefix,
  localResults,
  openaiEvaluation,
  note: "OpenAI judged the pre-answer draft and final answer. Results are stored in Supabase and visible in the Joz LLM dashboard; no automatic production repair was applied.",
}, null, 2));
