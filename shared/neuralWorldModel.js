import { buildLearningExamples } from "./learnedWorldModel.js";

export const NEURAL_WORLD_MODEL_SCHEMA_VERSION = "1.0";
export const NEURAL_WORLD_MODEL_VERSION = "neural-app-world-v1";
export const NEURAL_FEATURE_SIZE = 128;
export const NEURAL_HIDDEN_SIZE = 32;

const STATE_FIELDS = [
  "portal",
  "stage",
  "currentStateKey",
  "focusedEntityId",
  "visibleEntityIds",
  "visitedPortalIds",
];

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function token(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map((item) => token(item).replace("meet_joz", "meet-joz")).sort();
  }
  if (typeof value === "string") return token(value).replace("meet_joz", "meet-joz");
  return value ?? null;
}

function projectState(state = {}) {
  return Object.fromEntries(STATE_FIELDS.map((field) => [field, canonical(state[field])]));
}

function actionValue(action) {
  if (typeof action === "string") return token(action);
  return token(action?.type || action?.action || action?.id);
}

function hash(value, size) {
  let result = 2166136261;
  for (const character of String(value || "")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) % size;
}

function featureTokens(state = {}, action = "") {
  const projected = projectState(state);
  const tokens = [`action:${actionValue(action)}`];
  for (const field of STATE_FIELDS) {
    const value = projected[field];
    if (Array.isArray(value)) {
      value.forEach((item) => tokens.push(`${field}:${item}`));
    } else if (value !== null && value !== undefined && value !== "") {
      tokens.push(`${field}:${value}`);
    }
  }
  return tokens;
}

function vectorize(state, action, featureSize) {
  const vector = Array.from({ length: featureSize }, () => 0);
  for (const feature of featureTokens(state, action)) {
    const index = hash(feature, featureSize);
    vector[index] += feature.startsWith("action:") ? 1 : 0.5;
  }
  return vector;
}

function seededRandom(seed = 17) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

function zeros(length) {
  return Array.from({ length }, () => 0);
}

function matrix(rows, columns, random) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => (random() - 0.5) * 0.12)
  );
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, value))));
}

function softmax(values) {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  return exponentials.map((value) => value / total);
}

function forward(model, state, action) {
  const featureSize = Number(model?.architecture?.featureSize) || NEURAL_FEATURE_SIZE;
  const hiddenSize = Number(model?.architecture?.hiddenSize) || NEURAL_HIDDEN_SIZE;
  const vector = vectorize(state, action, featureSize);
  const hidden = zeros(hiddenSize);

  for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
    let value = Number(model.biasHidden?.[hiddenIndex] || 0);
    for (let featureIndex = 0; featureIndex < featureSize; featureIndex += 1) {
      value += vector[featureIndex] * Number(model.weightsInputHidden?.[hiddenIndex]?.[featureIndex] || 0);
    }
    hidden[hiddenIndex] = Math.max(0, value);
  }

  const outputSize = Array.isArray(model.labels) ? model.labels.length : 0;
  const logits = zeros(outputSize);
  for (let outputIndex = 0; outputIndex < outputSize; outputIndex += 1) {
    let value = Number(model.biasOutput?.[outputIndex] || 0);
    for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
      value += hidden[hiddenIndex] * Number(model.weightsHiddenOutput?.[outputIndex]?.[hiddenIndex] || 0);
    }
    logits[outputIndex] = value;
  }

  let successLogit = Number(model.biasSuccess || 0);
  for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
    successLogit += hidden[hiddenIndex] * Number(model.weightsHiddenSuccess?.[hiddenIndex] || 0);
  }

  return { vector, hidden, probabilities: softmax(logits), successProbability: sigmoid(successLogit) };
}

function outcomeLabel(state = {}) {
  return JSON.stringify(projectState(state));
}

function findRowByTrajectoryId(rows = []) {
  return new Map(
    rows.map((row) => [String(row?.trajectoryId || row?.trajectory_id || ""), row])
  );
}

function buildExamples(rows = [], options = {}) {
  const rowById = findRowByTrajectoryId(rows);
  return buildLearningExamples(rows, options).map((example) => {
    const row = rowById.get(String(example.trajectoryId || "")) || {};
    return {
      ...example,
      stateBefore: projectState(example.stateBefore),
      observedState: projectState(example.observedState),
      action: actionValue(example.action),
      outcome: outcomeLabel(example.observedState),
      success: row.success === true,
    };
  });
}

function createModel(labels, { featureSize, hiddenSize, seed = 17 } = {}) {
  const random = seededRandom(seed);
  return {
    schemaVersion: NEURAL_WORLD_MODEL_SCHEMA_VERSION,
    modelVersion: NEURAL_WORLD_MODEL_VERSION,
    architecture: {
      type: "hashed-feature-mlp",
      featureSize,
      hiddenSize,
      activation: "relu",
      outputs: ["next_state_softmax", "success_sigmoid"],
    },
    featureHashing: {
      method: "fnv1a_signed_bag_of_state_tokens",
      featureSize,
      stateFields: STATE_FIELDS,
    },
    labels,
    weightsInputHidden: matrix(hiddenSize, featureSize, random),
    biasHidden: zeros(hiddenSize),
    weightsHiddenOutput: matrix(labels.length, hiddenSize, random),
    biasOutput: zeros(labels.length),
    weightsHiddenSuccess: Array.from({ length: hiddenSize }, () => (random() - 0.5) * 0.12),
    biasSuccess: 0,
  };
}

export function trainNeuralWorldModel(rows = [], {
  epochs = 80,
  learningRate = 0.03,
  featureSize = NEURAL_FEATURE_SIZE,
  hiddenSize = NEURAL_HIDDEN_SIZE,
  seed = 17,
} = {}) {
  const examples = buildExamples(rows, { salt: "neural-app-world-v1" });
  const trainingExamples = examples.filter((example) => example.split === "train");
  const labels = [...new Set(trainingExamples.map((example) => example.outcome))].sort();
  if (!trainingExamples.length || !labels.length) {
    throw new Error("Neural World Model requires eligible training trajectories");
  }

  const model = createModel(labels, { featureSize, hiddenSize, seed });
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  let finalLoss = null;

  for (let epoch = 0; epoch < Math.max(1, Math.round(epochs)); epoch += 1) {
    let epochLoss = 0;
    for (const example of trainingExamples) {
      const result = forward(model, example.stateBefore, example.action);
      const targetIndex = labelIndex.get(example.outcome);
      if (targetIndex === undefined) continue;

      const outputGradient = result.probabilities.map((probability, index) =>
        probability - (index === targetIndex ? 1 : 0)
      );
      const successTarget = example.success ? 1 : 0;
      const successGradient = result.successProbability - successTarget;
      const hiddenGradient = zeros(hiddenSize);

      for (let outputIndex = 0; outputIndex < labels.length; outputIndex += 1) {
        for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
          hiddenGradient[hiddenIndex] +=
            outputGradient[outputIndex] * model.weightsHiddenOutput[outputIndex][hiddenIndex];
          model.weightsHiddenOutput[outputIndex][hiddenIndex] -=
            learningRate * outputGradient[outputIndex] * result.hidden[hiddenIndex];
        }
        model.biasOutput[outputIndex] -= learningRate * outputGradient[outputIndex];
      }

      for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
        hiddenGradient[hiddenIndex] += successGradient * model.weightsHiddenSuccess[hiddenIndex];
        model.weightsHiddenSuccess[hiddenIndex] -=
          learningRate * successGradient * result.hidden[hiddenIndex];
      }
      model.biasSuccess -= learningRate * successGradient;

      for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
        const reluGradient = result.hidden[hiddenIndex] > 0 ? hiddenGradient[hiddenIndex] : 0;
        for (let featureIndex = 0; featureIndex < featureSize; featureIndex += 1) {
          model.weightsInputHidden[hiddenIndex][featureIndex] -=
            learningRate * reluGradient * result.vector[featureIndex];
        }
        model.biasHidden[hiddenIndex] -= learningRate * reluGradient;
      }

      epochLoss +=
        -Math.log(Math.max(1e-8, result.probabilities[targetIndex])) +
        -(successTarget * Math.log(Math.max(1e-8, result.successProbability)) +
          (1 - successTarget) * Math.log(Math.max(1e-8, 1 - result.successProbability)));
    }
    finalLoss = epochLoss / trainingExamples.length;
  }

  const splitCounts = examples.reduce((result, example) => {
    result[example.split] = (result[example.split] || 0) + 1;
    return result;
  }, {});
  model.trainedAt = new Date().toISOString();
  model.training = {
    eligibleExamples: examples.length,
    trainingExamples: trainingExamples.length,
    splitCounts,
    epochs: Math.max(1, Math.round(epochs)),
    learningRate,
    finalLoss,
    splitStrategy: "session_hash; no session is shared across splits",
  };
  return model;
}

export function predictNeuralNextStates(model, currentState = {}, action, { topK = 3 } = {}) {
  if (!validateNeuralWorldModel(model) || !action) return [];
  const result = forward(model, currentState, action);
  return result.probabilities
    .map((probability, index) => ({
      predictedState: JSON.parse(model.labels[index]),
      probability,
      successProbability: result.successProbability,
      confidence: Math.min(0.99, Number(model.training?.trainingExamples || 0) /
        (Number(model.training?.trainingExamples || 0) + 20)),
      evidence: "neural_transition_model",
      learned: true,
      modelVersion: model.modelVersion,
    }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, Math.max(1, topK));
}

export function evaluateNeuralWorldModel(model, rows = [], { topK = 3 } = {}) {
  if (!validateNeuralWorldModel(model)) {
    return { meaningful: false, sampleCount: 0, coveredSamples: 0, metrics: {} };
  }
  const examples = buildExamples(rows, { salt: "neural-app-world-v1" })
    .filter((example) => example.split === "test");
  let coveredSamples = 0;
  let top1Correct = 0;
  let topKCorrect = 0;
  let brierScore = 0;

  for (const example of examples) {
    const predictions = predictNeuralNextStates(model, example.stateBefore, example.action, { topK });
    if (!predictions.length) continue;
    coveredSamples += 1;
    if (predictions[0].predictedState && outcomeLabel(predictions[0].predictedState) === example.outcome) {
      top1Correct += 1;
    }
    if (predictions.some((prediction) => outcomeLabel(prediction.predictedState) === example.outcome)) {
      topKCorrect += 1;
    }
    const probability = predictions.find(
      (prediction) => outcomeLabel(prediction.predictedState) === example.outcome
    )?.probability || 0;
    brierScore += (probability - 1) ** 2 + predictions
      .filter((prediction) => outcomeLabel(prediction.predictedState) !== example.outcome)
      .reduce((sum, prediction) => sum + prediction.probability ** 2, 0);
  }

  return {
    evaluationType: "neural_app_world_transition_model",
    modelVersion: model.modelVersion,
    split: "session_hash:test",
    sampleCount: examples.length,
    coveredSamples,
    coverage: examples.length ? coveredSamples / examples.length : 0,
    metrics: {
      nextStateAccuracy: examples.length ? top1Correct / examples.length : 0,
      topKStateAccuracy: examples.length ? topKCorrect / examples.length : 0,
      coveredNextStateAccuracy: coveredSamples ? top1Correct / coveredSamples : 0,
      brierScore: coveredSamples ? brierScore / coveredSamples : null,
    },
    meaningful: examples.length >= 10,
    limitations: [
      "This is a small neural transition predictor for the application world, not a general physical-world model.",
      "Predictions are shadow-only and cannot authorize execution.",
    ],
  };
}

export function validateNeuralWorldModel(model) {
  return Boolean(
    model &&
    model.schemaVersion === NEURAL_WORLD_MODEL_SCHEMA_VERSION &&
    model.modelVersion === NEURAL_WORLD_MODEL_VERSION &&
    Array.isArray(model.labels) &&
    model.architecture?.type === "hashed-feature-mlp" &&
    Array.isArray(model.weightsInputHidden) &&
    Array.isArray(model.weightsHiddenOutput)
  );
}

export function loadNeuralWorldModel(filePath, readFileSync = null) {
  if (!filePath || typeof readFileSync !== "function") return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return validateNeuralWorldModel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
