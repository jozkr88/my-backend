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
  assert.equal(slugs[0], "business-need-enterprise-proof");
  assert.equal(slugs[1], "business-need-why-hire-joz-now");
  assert.ok(slugs.includes("business-need-enterprise-proof"));
  assert.ok(slugs.includes("business-need-why-hire-joz-now"));
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
  assert.equal(slugs[0], "skills-largest-enterprise-scale-proof");
  assert.ok(slugs.indexOf("skills-largest-enterprise-scale-proof") < slugs.indexOf("skills-agentic-ai-architecture"));
  assert.ok(slugs.indexOf("skills-quantified-business-outcomes") < slugs.indexOf("skills-agentic-ai-architecture"));
});

test("biggest enterprise achievement does not rank MarketClue first", () => {
  const slugs = rankedSlugs("What is Joz's biggest enterprise achievement?", "skills");
  assert.notEqual(slugs[0], "skills-agentic-ai-architecture");
  assert.equal(slugs[0], "skills-largest-enterprise-scale-proof");
});

test("broad credibility query favors business outcomes and proof before capability-first records", () => {
  const slugs = rankedSlugs("What makes Joz different?", "skills", 12);
  assert.ok(slugs.indexOf("business-need-enterprise-proof") < slugs.indexOf("skills-agentic-ai-architecture"));
  assert.ok(slugs.indexOf("skills-quantified-business-outcomes") < slugs.indexOf("skills-agentic-ai-architecture"));
});

test("relevance-now query keeps enterprise proof ahead of capability-first ranking", () => {
  const slugs = rankedSlugs("Why is Joz relevant now?", "business_need", 12);
  assert.equal(slugs[0], "business-need-enterprise-proof");
  assert.equal(slugs[1], "business-need-why-hire-joz-now");
});

test("cross-lane ai adoption query connects business need, mindset, and skills evidence", () => {
  const slugs = rankedSlugs("How can Joz improve AI adoption?", "business_need", 12);
  assert.ok(slugs.includes("business-need-ai-adoption-governance"));
  assert.ok(slugs.includes("skills-hero-agentic-ai"));
  assert.ok(slugs.includes("business-need-enterprise-proof"));
});

test("deep skills query ranks technical capability records above recruiter operations", () => {
  const slugs = rankedSlugs("What are Joz's deep skills?", "skills", 10);
  assert.equal(slugs[0], "skills-agentic-ai-architecture");
  assert.equal(slugs[1], "skills-technical-platform-stack");
  assert.ok(slugs.includes("skills-agentic-ai-ux-orchestration"));
  assert.ok(!slugs.slice(0, 4).includes("skills-recruiter-operational-facts"));
});

test("technical depth variants down-rank recruiter operations", () => {
  for (const query of [
    "What are Joz's strongest technical skills?",
    "How technical is Joz?",
    "What can Joz build?",
    "What is Joz's AI stack?",
  ]) {
    const slugs = rankedSlugs(query, "skills", 8);
    assert.ok(slugs.includes("skills-agentic-ai-architecture"));
    assert.ok(slugs.includes("skills-technical-platform-stack"));
    assert.ok(!slugs.slice(0, 3).includes("skills-recruiter-operational-facts"));
  }
});

test("Mediacorp employer query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What did Joz do at Mediacorp?", "skills", 8);
  assert.equal(slugs[0], "mediacorp-digital-platforms");
});

test("Maybank private banking query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What private banking work did Joz do at Maybank?", "skills", 8);
  assert.equal(slugs[0], "maybank-private-banking-digital");
});

test("Manulife projects query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What projects did Joz do at Manulife?", "skills", 8);
  assert.equal(slugs[0], "manulife-innovation-labs");
});

test("Erste employer query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What did Joz do at Erste Bank?", "skills", 8);
  assert.equal(slugs[0], "erste-accessibility-aem");
});

test("Ogilvy CMS query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What CMS projects did Joz do at Ogilvy?", "skills", 8);
  assert.equal(slugs[0], "ogilvy-enterprise-platforms");
});

test("UK healthcare query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What healthcare platforms did Joz work on in the UK?", "skills", 8);
  assert.equal(slugs[0], "uk-healthcare-digital-platforms");
});

test("Dubai Future Foundation employer query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What did Joz do for Dubai Future Foundation?", "skills", 8);
  assert.equal(slugs[0], "dubai-future-foundation-inclusive-design");
});

test("Hub71 employer query surfaces the grouped programme record", () => {
  const slugs = rankedSlugs("What did Joz do at Hub71?", "skills", 8);
  assert.equal(slugs[0], "hub71-tokenised-knowledge");
});
