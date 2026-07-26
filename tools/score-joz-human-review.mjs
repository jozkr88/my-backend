import fs from "node:fs/promises";
import path from "node:path";

const queuePath = path.resolve(process.cwd(), "content/joz-human-review-queue.json");
const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
const reviewed = (queue.cases || []).filter((item) => item?.humanReview?.status === "reviewed");
const pending = (queue.cases || []).length - reviewed.length;

function numericScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 5 ? score : null;
}

const scoreKeys = ["correctness", "relevance", "groundedness", "safety"];
const scored = reviewed.map((item) => {
  const scores = item.humanReview?.scores || {};
  const values = scoreKeys.map((key) => numericScore(scores[key]));
  return {
    id: item.id,
    category: item.category,
    average: values.every((value) => value !== null)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    scoresComplete: values.every((value) => value !== null),
    label: item.humanReview?.label || null,
  };
});
const complete = scored.filter((item) => item.scoresComplete);
const average = complete.length
  ? complete.reduce((sum, item) => sum + item.average, 0) / complete.length
  : null;

console.log(JSON.stringify({
  queueTotal: (queue.cases || []).length,
  reviewed: reviewed.length,
  pending,
  completeScoreSheets: complete.length,
  averageScore: average === null ? null : Number(average.toFixed(2)),
  reviewedByCategory: Object.fromEntries(
    [...new Set(reviewed.map((item) => item.category))].map((category) => [
      category,
      reviewed.filter((item) => item.category === category).length,
    ])
  ),
}, null, 2));

if (reviewed.some((item) => !item.humanReview?.label || !item.humanReview?.notes)) {
  console.error("Human review contains reviewed items without a label or notes.");
  process.exitCode = 1;
}
