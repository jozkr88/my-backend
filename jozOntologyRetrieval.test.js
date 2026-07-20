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

function rankedTitles(query, intentMode, limit = 5) {
  return rankJozDocumentsForQuery(loadDocs(), {
    intentMode,
    query,
    limit,
  }).map((doc) => doc.title);
}

test("canonical technical concept queries rank the expected records first", () => {
  const cases = [
    ["What is an agent?", "skills", "Agent Definition"],
    ["What is MCP?", "skills", "MCP"],
    ["What is LangGraph?", "skills", "Orchestration"],
    ["What is Temporal?", "skills", "Orchestration"],
    ["What is FastAPI used for?", "skills", "FastAPI"],
    ["What role does a knowledge graph play?", "skills", "Organisational Knowledge Layer"],
    ["When would Joz use Python versus Golang?", "skills", "Golang and Python"],
  ];

  for (const [query, intentMode, expectedTitle] of cases) {
    const titles = rankedTitles(query, intentMode, 5);
    assert.equal(titles[0], expectedTitle, `${query} should rank ${expectedTitle} first`);
  }
});

test("canonical governance and autonomous-execution queries rank the expected records first", () => {
  const cases = [
    ["How does Joz defend against prompt injection?", "systems_mindset", "Prompt Injection Defense"],
    ["Why must permissions be enforced before retrieval?", "skills", "ACL-Aware Retrieval"],
    ["What is Joz's Organisational Awareness Layer?", "skills", "Organisational Awareness Layer"],
    ["What is Joz's Autonomous Execution Layer?", "business_need", "Autonomous Execution Layer"],
    ["How does Joz verify autonomous code changes?", "systems_mindset", "Autonomous Code Verification"],
  ];

  for (const [query, intentMode, expectedTitle] of cases) {
    const titles = rankedTitles(query, intentMode, 5);
    assert.equal(titles[0], expectedTitle, `${query} should rank ${expectedTitle} first`);
  }
});

test("canonical infrastructure and platform queries rank the expected records first", () => {
  const cases = [
    ["What is Docker?", "skills", "Docker"],
    ["What is Kubernetes?", "skills", "Kubernetes"],
    ["What is the difference between Docker and Kubernetes?", "skills", "Kubernetes"],
    ["What is a Kubernetes pod?", "skills", "Kubernetes Pods"],
    ["What is a Kubernetes deployment?", "skills", "Kubernetes Deployment"],
    ["What is a Kubernetes service?", "skills", "Kubernetes Service"],
    ["What is ingress?", "skills", "Ingress and API Gateway"],
    ["What does a load balancer do?", "skills", "Load Balancer"],
    ["What is horizontal scaling?", "skills", "Horizontal and Vertical Scaling"],
    ["What is autoscaling?", "skills", "Autoscaling"],
    ["Why should APIs be stateless?", "skills", "Stateless Services"],
    ["What is PostgreSQL used for?", "skills", "PostgreSQL"],
    ["What is Redis used for?", "skills", "Redis"],
    ["What is the difference between PostgreSQL and Redis?", "skills", "Redis"],
    ["What is Kafka?", "skills", "Kafka and NATS"],
    ["When would Joz use Kafka versus NATS?", "skills", "Kafka and NATS"],
    ["What is event-driven architecture?", "skills", "Event-Driven Architecture"],
    ["What is Temporal used for?", "skills", "Temporal"],
    ["What is workload identity?", "skills", "Workload Identity"],
    ["What is Vault or KMS?", "skills", "Secrets Management"],
    ["What is OpenTelemetry?", "skills", "OpenTelemetry"],
    ["What is the difference between logs, metrics, and traces?", "skills", "Observability"],
    ["What is CI/CD?", "skills", "CI/CD"],
    ["What is Terraform?", "skills", "Infrastructure as Code"],
    ["What is GitOps?", "skills", "GitOps"],
    ["What is a canary deployment?", "skills", "Blue-Green and Canary Deployment"],
    ["What is a circuit breaker?", "skills", "Circuit Breaker"],
    ["What is idempotency?", "skills", "Idempotency"],
    ["What is backpressure?", "skills", "Backpressure"],
    ["How does Joz scale an agent platform?", "skills", "Agent Infrastructure Scaling"],
    ["How does Joz approach disaster recovery?", "skills", "Disaster Recovery"],
    ["What is Joz's infrastructure philosophy?", "skills", "How Joz Approaches Infrastructure"],
  ];

  for (const [query, intentMode, expectedTitle] of cases) {
    const titles = rankedTitles(query, intentMode, 5);
    assert.equal(titles[0], expectedTitle, `${query} should rank ${expectedTitle} first`);
  }
});

test("business value query prioritizes why-hire record and enterprise proof", () => {
  const slugs = rankedSlugs("Why should we hire Joz now?", "business_need", 10);
  assert.equal(slugs[0], "business-need-enterprise-proof");
  assert.equal(slugs[1], "business-need-why-hire-joz-now");
  assert.ok(slugs.includes("business-need-enterprise-proof"));
  assert.ok(slugs.includes("business-need-why-hire-joz-now"));
});

test("roi query surfaces roi model without inventing a proof-only ranking", () => {
  const slugs = rankedSlugs("Where is the ROI?", "business_need", 10);
  assert.equal(slugs[0], "business-need-roi-model");
  assert.ok(slugs.includes("business-need-profit-levers"));
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
  assert.ok(slugs.includes("business-need-skills-mindset-agentic-architecture-infrastructure"));
  assert.ok(slugs.includes("business-need-why-joz-is-irreplaceable"));
});

test("efficiency query prioritizes the efficiency-led business value record", () => {
  const slugs = rankedSlugs(
    "How does Joz create business value through efficiency, lower cost, faster execution, and stronger operational leverage?",
    "business_need",
    8
  );
  assert.equal(slugs[0], "business-need-efficiency-vs-growth");
  assert.ok(slugs.includes("business-need-profit-levers"));
});

test("growth query prioritizes growth and profit-oriented business value records", () => {
  const slugs = rankedSlugs(
    "How does Joz use AI systems to support growth, scaling, better decisions, and stronger commercial performance?",
    "business_need",
    8
  );
  assert.equal(slugs[0], "business-need-efficiency-vs-growth");
  assert.ok(slugs.includes("business-need-profit-levers"));
});

test("functions query prioritizes by-function business value framing", () => {
  const slugs = rankedSlugs(
    "How can Joz create business value across functions like finance, ERP, accounting, HR, marketing, and operations?",
    "business_need",
    8
  );
  assert.equal(slugs[0], "business-need-ai-by-function");
  assert.ok(slugs.includes("business-need-erp-finance-hr-marketing-opportunity-map"));
});

test("decision support query prioritizes decision-intelligence records", () => {
  const slugs = rankedSlugs(
    "How does Joz improve decision support through better signal, prioritization, judgment, and clarity in noisy business environments?",
    "business_need",
    8
  );
  assert.equal(slugs[0], "business-need-decision-intelligence");
  assert.ok(slugs.includes("business-need-hero-value"));
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
