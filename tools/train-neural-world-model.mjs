import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadTrajectoryFile } from "./world-model-dataset.mjs";
import {
  evaluateNeuralWorldModel,
  trainNeuralWorldModel,
} from "../shared/neuralWorldModel.js";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const inputPath = argument("--input");
const outputPath = argument(
  "--output",
  path.resolve("data/joz/published/neural-world-model.json")
);
const evaluationPath = argument(
  "--evaluation-output",
  outputPath.replace(/\.json$/i, ".evaluation.json")
);

if (!inputPath) {
  throw new Error("Usage: npm run train:neural-world-model -- --input <trajectory.jsonl> [--output <model.json>]");
}

const rows = await loadTrajectoryFile(inputPath);
const model = trainNeuralWorldModel(rows, {
  epochs: Number(argument("--epochs", "80")),
  learningRate: Number(argument("--learning-rate", "0.03")),
});
const evaluation = evaluateNeuralWorldModel(model, rows);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
await writeFile(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  inputPath,
  outputPath,
  evaluationPath,
  architecture: model.architecture,
  training: model.training,
  evaluation,
}, null, 2)}\n`);
