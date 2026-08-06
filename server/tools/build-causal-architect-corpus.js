import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const dataRoot = path.join(repoRoot, "data", "joz");
const sourceFilename = "2026-08-06-chief-ai-ml-architect-causal-knowledge-base.md";
const sourcePath = path.join(dataRoot, "inbox", sourceFilename);
const outputPath = path.join(dataRoot, "canonical", "causal-ai-chief-architect-knowledge-base.jsonl");

const TAG_RULES = [
  ["causal_inference", /causal|do-calculus|intervention|counterfactual|treatment effect|refutation/i],
  ["structural_causal_models", /structural causal model|scm|structural equation/i],
  ["causal_discovery", /causal discovery|pc\b|fci\b|ges\b|notears|lingam|pcmci/i],
  ["time_series", /time-series|time series|temporal|lagged|streaming/i],
  ["knowledge_graphs", /knowledge graph|ontology|neo4j|rdf|shacl|graphdb|stardog/i],
  ["agentic_ai", /agentic|multi-step planning|agent roles|neuro-symbolic/i],
  ["decision_intelligence", /decision operating system|decision intelligence|enterprise decision/i],
  ["enterprise_architecture", /architecture|platform|enterprise systems|erp|wms|tms|mes/i],
  ["governance", /governance|guardrail|security|approval|audit|refutation|safety/i],
  ["distributed_systems", /distributed|high-throughput|kafka|streaming|stateful|scaling/i],
  ["mlops_observability", /mlops|observability|evaluation|model lifecycle|monitoring/i],
];

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function sectionPriority(title = "", parent = "") {
  const value = `${parent} ${title}`;
  if (/2\.[2-9]|3\.|4\.|5\.3|5\.7|6\./.test(value)) return "hero";
  if (/10\.|11\.|12\.|13\.|14\./.test(value)) return "high";
  return "standard";
}

function tagsFor(title, content) {
  const haystack = `${title}\n${content}`;
  const tags = new Set(["causal_intelligence", "ai_architecture"]);
  for (const [tag, pattern] of TAG_RULES) {
    if (pattern.test(haystack)) tags.add(tag);
  }
  return [...tags].sort();
}

function parseSections(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const sections = [];
  let parent = "";
  let current = null;

  const flush = (endLine) => {
    if (!current) return;
    const content = lines.slice(current.start, endLine).join("\n").trim();
    if (content) sections.push({ ...current, content, endLine });
  };

  lines.forEach((line, index) => {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h1) parent = h1[1].trim();
    if (!h2) return;
    flush(index);
    current = {
      title: h2[1].trim(),
      parent,
      start: index,
      lineStart: index + 1,
    };
  });
  flush(lines.length);

  return sections;
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source dataset: ${sourcePath}`);
  }

  const markdown = fs.readFileSync(sourcePath, "utf8");
  const sections = parseSections(markdown);
  const records = sections.map((section, index) => ({
    id: `causal-architect-${String(index + 1).padStart(2, "0")}-${slugify(section.title)}`,
    title: section.title,
    content: section.content,
    source: "Causal AI Chief Architect Knowledge Base",
    tags: tagsFor(section.title, section.content),
    priority: sectionPriority(section.title, section.parent),
    dataset_id: "joz-causal-ai-chief-architect-v1",
    causal_model_version: "joz-causal-architecture-v2",
    corpus_section: section.title,
    corpus_parent: section.parent,
    source_line_start: section.lineStart,
    source_line_end: section.endLine,
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  console.log(JSON.stringify({ sourcePath, outputPath, sourceBytes: Buffer.byteLength(markdown), records: records.length }, null, 2));
}

main();
