import fs from "fs";
import path from "path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";
import { rankJozDocumentsForQuery } from "./shared/jozOntology.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDocsPath() {
  const candidates = [
    path.join(process.cwd(), "data", "joz", "published", "joz-documents.generated.json"),
    path.join(__dirname, "..", "data", "joz", "published", "joz-documents.generated.json"),
    path.join(__dirname, "data", "joz", "published", "joz-documents.generated.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

const docsPath = resolveDocsPath();

function loadDocs() {
  const published = JSON.parse(fs.readFileSync(docsPath, "utf8"));
  return published.records || [];
}

function rankedSlugs(query, intentMode, limit = 5) {
  return rankJozDocumentsForQuery(loadDocs(), {
    intentMode,
    query,
    limit,
  }).map((doc) => doc.slug);
}

test("business value query prioritizes why-hire record and enterprise proof", () => {
  const slugs = rankedSlugs("Why should we hire Joz now?", "business_need", 10);
  assert.equal(slugs[0], "business-need-why-hire-joz-now");
  assert.ok(slugs.includes("business-need-enterprise-proof"));
});

test("roi query surfaces roi model without inventing a proof-only ranking", () => {
  const slugs = rankedSlugs("Where is the ROI?", "business_need");
  assert.equal(slugs[0], "business-need-roi-model");
  assert.ok(slugs.includes("business-need-hero-value"));
});

test("systems mindset query surfaces core principles first", () => {
  const slugs = rankedSlugs("How does Joz think about complex systems?", "systems_mindset", 10);
  assert.equal(slugs[0], "systems-mindset-hero");
  assert.ok(slugs.includes("systems-principle-signal-over-noise"));
  assert.ok(slugs.includes("systems-principle-context-creates-intelligence"));
  assert.ok(slugs.includes("systems-principle-systems-before-features"));
});

test("autonomy query surfaces judgment and governance principles", () => {
  const slugs = rankedSlugs("What is Joz's approach to Agentic AI autonomy?", "systems_mindset", 10);
  assert.equal(slugs[0], "systems-agentic-ai-judgment");
  assert.ok(slugs.includes("systems-governance-mindset"));
});

test("skills query favors enterprise scale before smaller current projects", () => {
  const slugs = rankedSlugs("What is Joz strongest at?", "skills", 12);
  assert.equal(slugs[0], "skills-hero-agentic-ai");
  assert.ok(slugs.includes("skills-largest-enterprise-scale-proof"));
});

test("biggest enterprise achievement does not rank MarketClue first", () => {
  const slugs = rankedSlugs("What is Joz's biggest enterprise achievement?", "skills");
  assert.notEqual(slugs[0], "skills-agentic-ai-architecture");
  assert.equal(slugs[0], "skills-largest-enterprise-scale-proof");
});

test("cross-lane ai adoption query connects business need, mindset, and skills evidence", () => {
  const slugs = rankedSlugs("How can Joz improve AI adoption?", "business_need", 12);
  assert.ok(slugs.includes("business-need-ai-adoption-governance"));
  assert.ok(slugs.includes("skills-hero-agentic-ai"));
  assert.ok(slugs.includes("business-need-enterprise-proof"));
});
