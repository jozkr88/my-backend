import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../content/joz-business-transformation.json");
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

function normalize(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function findIndustry(input) {
  const clean = normalize(input);
  return DATA.industries.find((industry) =>
    industry.aliases.some((alias) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i").test(clean))
  ) || null;
}

function findMaturity(input) {
  const clean = normalize(input);
  let best = null;
  let bestScore = 0;
  for (const level of DATA.maturityLevels) {
    const score = level.signals.filter((signal) => clean.includes(signal)).length;
    if (score > bestScore || (score > 0 && score === bestScore && level.level > best?.level)) {
      best = level;
      bestScore = score;
    }
  }
  return best;
}

export function buildBusinessTransformationReply(input = "") {
  const industry = findIndustry(input);
  if (!industry) return null;

  const maturity = findMaturity(input);
  const maturityText = maturity
    ? `At ${maturity.name}: ${maturity.guidance}.`
    : "Start with a baseline, one bounded use case, verification, governance, and human approval.";

  return `For ${industry.name}, Joz targets ${industry.problems.join(", ")}. He can apply ${industry.helps.join(", ")} for measurable improvements in ${industry.outcomes.join(", ")}. ${maturityText}`;
}

export function getBusinessTransformationData() {
  return DATA;
}
