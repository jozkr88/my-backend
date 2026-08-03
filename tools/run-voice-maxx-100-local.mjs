import dotenv from "dotenv";

for (const envPath of [".env.local", ".env", "server/.env"]) {
  dotenv.config({ path: envPath, override: false });
}

const localApiUrl = String(process.env.JOZ_LOCAL_API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(8, Number(process.env.JOZ_100_CONCURRENCY) || 4));
const runId = `${Date.now()}`;
const sessionKey = `voice-maxx-100-${runId}`;

const questions = [
  ["world_model", "what is space?"],
  ["world_model", "whats time?"],
  ["world_model", "what is state?"],
  ["world_model", "what is a world model?"],
  ["world_model", "what is a trajectory?"],
  ["world_model", "what is the next state?"],
  ["world_model", "can AI predict?"],
  ["world_model", "does space matter?"],
  ["world_model", "does time matter?"],
  ["world_model", "what changes now?"],
  ["world_model", "what comes next?"],
  ["world_model", "can you model reality?"],
  ["world_model", "what is an action?"],
  ["world_model", "what is an observation?"],
  ["world_model", "what is a future?"],
  ["world_model", "can worlds be simulated?"],
  ["world_model", "what does prediction mean?"],
  ["world_model", "how do states change?"],
  ["world_model", "what is spatial AI?"],
  ["world_model", "why model the world?"],

  ["joz", "who is Joz?"],
  ["joz", "what can Joz build?"],
  ["joz", "what are Joz skills?"],
  ["joz", "what is Joz good at?"],
  ["joz", "is Joz technical?"],
  ["joz", "what does Joz know?"],
  ["joz", "what is Joz's stack?"],
  ["joz", "does Joz build agents?"],
  ["joz", "does Joz use RAG?"],
  ["joz", "does Joz use graphs?"],
  ["joz", "does Joz use Neo4j?"],
  ["joz", "does Joz use Supabase?"],
  ["joz", "can Joz scale AI?"],
  ["joz", "can Joz ship products?"],
  ["joz", "what is Joz's value?"],
  ["joz", "what has Joz delivered?"],
  ["joz", "can Joz help teams?"],
  ["joz", "does Joz understand business?"],
  ["joz", "what is Joz's edge?"],
  ["joz", "why work with Joz?"],

  ["typo", "whos joz?"],
  ["typo", "wat can joz do?"],
  ["typo", "wht r joz skils?"],
  ["typo", "does joz buld agents?"],
  ["typo", "can joz scl ai?"],
  ["typo", "whats jozs stak?"],
  ["typo", "is joz techincal?"],
  ["typo", "how dos rag work?"],
  ["typo", "wat is spce?"],
  ["typo", "wats the time?"],
  ["typo", "wether in spain?"],
  ["typo", "arange time with joz?"],
  ["typo", "schedul a meting?"],
  ["typo", "bok joz?"],
  ["typo", "i wana meet joz?"],
  ["typo", "plese show ai strenth?"],
  ["typo", "can u explane memory?"],
  ["typo", "why is this not workng?"],
  ["typo", "try agen?"],
  ["typo", "did u undrstand me?"],

  ["piss_taking", "is this just hype?"],
  ["piss_taking", "is Joz a wizard?"],
  ["piss_taking", "is this buzzword soup?"],
  ["piss_taking", "does this actually work?"],
  ["piss_taking", "are you just guessing?"],
  ["piss_taking", "can you stop flexing?"],
  ["piss_taking", "why so many arrows?"],
  ["piss_taking", "is AI magic now?"],
  ["piss_taking", "is this the big brain?"],
  ["piss_taking", "do you ever say no?"],
  ["piss_taking", "can you be less boring?"],
  ["piss_taking", "is this all smoke?"],
  ["piss_taking", "what is the point?"],
  ["piss_taking", "so what, then?"],
  ["piss_taking", "prove it?"],
  ["piss_taking", "is this hot or not?"],
  ["piss_taking", "are you taking the piss?"],
  ["piss_taking", "did a robot write this?"],
  ["piss_taking", "can this beat a spreadsheet?"],
  ["piss_taking", "why should I care?"],

  ["edge", "what now?"],
  ["edge", "why?"],
  ["edge", "and then?"],
  ["edge", "really?"],
  ["edge", "you sure?"],
  ["edge", "say that again?"],
  ["edge", "what did you hear?"],
  ["edge", "can you help?"],
  ["edge", "hello?"],
  ["edge", "who are you?"],

  ["action", "arrange time with Joz?"],
  ["action", "book time with Joz?"],
  ["action", "schedule a call with Joz?"],
  ["action", "set up a meeting?"],
  ["action", "meet with Joz?"],
  ["action", "talk to Joz?"],
  ["action", "send an email?"],
  ["action", "call Joz now?"],
  ["action", "deploy this?"],
  ["action", "do it now?"],
];

if (questions.length !== 100) {
  throw new Error(`Expected exactly 100 questions, found ${questions.length}`);
}

async function ask(question, index, category) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${localApiUrl}/api/joz-llm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-joz-test-run": sessionKey,
      },
      body: JSON.stringify({
        sessionKey,
        messages: [{ role: "user", content: question }],
        context: {
          currentPortal: "root",
          testRun: { id: sessionKey, label: "Voice MAXX 100 short-question sweep", index, total: 100, category },
        },
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${response.status}: ${body?.error || "local backend request failed"}`);
    }
    return {
      index,
      category,
      question,
      answer: body?.reply || "",
      route: body?.trace?.selectedRoute || body?.mode || null,
      subIntent: body?.trace?.detectedSubIntent || null,
      verification: body?.verification?.status || null,
      responseStatus: body?.observability?.logged ? "logged" : "not_logged",
      modelRuntime: body?.modelRuntime || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = new Array(questions.length);
let cursor = 0;
async function worker() {
  while (cursor < questions.length) {
    const index = cursor++;
    const [category, question] = questions[index];
    try {
      results[index] = await ask(question, index + 1, category);
    } catch (error) {
      results[index] = { index: index + 1, category, question, error: error.message };
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const successful = results.filter((result) => !result.error);
const failed = results.filter((result) => result.error);
const genericFallbacks = successful.filter((result) =>
  /i didn.t catch that|not in the current joz knowledge graph|lacks context/i.test(result.answer)
);
const verificationFailures = successful.filter((result) => result.verification === "fail");
const categorySummary = Object.fromEntries(
  [...new Set(questions.map(([category]) => category))].map((category) => {
    const categoryResults = successful.filter((result) => result.category === category);
    return [category, { total: questions.filter(([item]) => item === category).length, completed: categoryResults.length }];
  })
);

console.log(JSON.stringify({
  ok: failed.length === 0,
  localApiUrl,
  sessionKey,
  total: questions.length,
  completed: successful.length,
  failed: failed.length,
  genericFallbacks: genericFallbacks.length,
  verificationFailures: verificationFailures.length,
  categorySummary,
  modelRuntime: successful.find((result) => result.modelRuntime)?.modelRuntime || null,
  failedQuestions: failed,
  results,
  storageNote: "Each request is logged by the local backend. With SUPABASE_DB_URL configured, rows are stored in Supabase joz_llm_request_events; otherwise they remain in the local memory fallback.",
}, null, 2));

