export const CURRENT_DATE = "31 July 2026";

export const INITIAL_WORLD = {
  project: {
    name: "Project Atlas",
    plannedReleaseDate: "2026-09-15",
    predictedReleaseDate: "2026-10-04",
    completionRatio: 0.68,
    remainingEffortHours: 1260,
    blockedWorkRatio: 0.18,
    scopeGrowthRate: 0.14,
    onTimeProbability: 0.24,
    defectRisk: 0.12,
    estimatedCost: 410000,
  },
  team: {
    engineers: 12,
    contractors: 0,
    capacityUtilization: 0.94,
    backendCapacityGap: 0.21,
    reviewLatencyIncrease: 0.31,
  },
  customer: { sentiment: 0.54, renewalProbability: 0.68 },
  risk: { overall: 0.72, delivery: 0.81, quality: 0.44, customer: 0.39 },
};

export const SCENARIOS = [
  {
    id: "baseline",
    label: "Continue unchanged",
    shortLabel: "Baseline",
    actionType: "continue_unchanged",
    onTimeProbability: 0.24,
    predictedReleaseDate: "2026-10-04",
    estimatedCost: 410000,
    defectRisk: 0.12,
    renewalProbability: 0.68,
    confidence: 0.82,
    score: 0.36,
    customerImpact: "Renewal pressure increases",
  },
  {
    id: "contractors",
    label: "Add two contractors",
    shortLabel: "+2 contractors",
    actionType: "add_contractors",
    onTimeProbability: 0.58,
    predictedReleaseDate: "2026-09-24",
    estimatedCost: 448000,
    defectRisk: 0.18,
    renewalProbability: 0.74,
    confidence: 0.68,
    score: 0.62,
    customerImpact: "Renewal signal improves",
  },
  {
    id: "scope",
    label: "Reduce scope by 15%",
    shortLabel: "−15% scope",
    actionType: "reduce_scope",
    onTimeProbability: 0.76,
    predictedReleaseDate: "2026-09-17",
    estimatedCost: 392000,
    defectRisk: 0.1,
    renewalProbability: 0.79,
    confidence: 0.77,
    score: 0.81,
    customerImpact: "Renewal signal improves",
  },
  {
    id: "split",
    label: "Split release",
    shortLabel: "Split release",
    actionType: "split_release",
    onTimeProbability: 0.83,
    predictedReleaseDate: "2026-09-14",
    estimatedCost: 405000,
    defectRisk: 0.09,
    renewalProbability: 0.84,
    confidence: 0.74,
    score: 0.87,
    customerImpact: "Early value protects renewal",
  },
  {
    id: "freeze",
    label: "Freeze noncritical scope",
    shortLabel: "Freeze scope",
    actionType: "freeze_scope",
    onTimeProbability: 0.69,
    predictedReleaseDate: "2026-09-21",
    estimatedCost: 399000,
    defectRisk: 0.11,
    renewalProbability: 0.77,
    confidence: 0.75,
    score: 0.73,
    customerImpact: "Renewal remains stable",
  },
];

export const TIMELINE = [
  { id: "jul-01", date: "1 Jul", fullDate: "1 July 2026", type: "past", progress: 0.42, risk: 0.48 },
  { id: "jul-15", date: "15 Jul", fullDate: "15 July 2026", type: "past", progress: 0.56, risk: 0.61 },
  { id: "jul-31", date: "31 Jul", fullDate: CURRENT_DATE, type: "current", progress: 0.68, risk: 0.72 },
  { id: "aug-15", date: "15 Aug", fullDate: "15 August 2026", type: "future", progress: 0.78, risk: 0.75 },
  { id: "sep-15", date: "15 Sep", fullDate: "15 September 2026", type: "future", progress: 0.91, risk: 0.8 },
  { id: "oct-04", date: "4 Oct", fullDate: "4 October 2026", type: "future", progress: 1, risk: 0.84 },
];

export const DOMAIN_ENTITIES = [
  { id: "project", label: "Project", parent: "Project Atlas", domain: "Project", position: [-2.6, 1.18, 0.1], color: "#f5c36a", shape: "box" },
  { id: "team", label: "Team", parent: "12 engineers", domain: "Team", position: [2.42, 1.2, 0], color: "#7fe1c1", shape: "box" },
  { id: "customer", label: "Customer", parent: "Renewal 68%", domain: "Customer", position: [2.86, -1.28, -0.16], color: "#f08da9", shape: "sphere" },
  { id: "technology", label: "Technology", parent: "Backend gap 21%", domain: "Technology", position: [-2.65, -1.32, 0.16], color: "#7eb4ef", shape: "sphere" },
  { id: "capital", label: "Capital", parent: "€410k", domain: "Capital", position: [0.05, 2.36, -0.3], color: "#d9adf7", shape: "diamond" },
  { id: "risk", label: "Risk", parent: "72 overall", domain: "Risk", position: [0.15, -2.36, 0.28], color: "#ff806f", shape: "diamond" },
  { id: "release", label: "Release", parent: "15 Sep → 4 Oct", domain: "Project", position: [-4.02, 0.35, -0.15], color: "#f5c36a", shape: "sphere", small: true },
  { id: "backend", label: "Backend", parent: "capacity gap", domain: "Team", position: [3.92, 0.2, -0.08], color: "#7fe1c1", shape: "sphere", small: true },
  { id: "qa", label: "QA", parent: "review latency", domain: "Team", position: [3.75, -0.72, 0.08], color: "#b5e9da", shape: "sphere", small: true },
  { id: "scope", label: "Scope", parent: "+14% growth", domain: "Project", position: [-3.72, 1.62, 0.08], color: "#ffb36c", shape: "sphere", small: true },
  { id: "critical-path", label: "Critical Path", parent: "congested", domain: "Risk", position: [-0.65, -1.76, 0.04], color: "#ff806f", shape: "sphere", small: true },
];

export const CAUSAL_PATH = ["scope", "backend", "critical-path", "qa", "release", "customer"];

export const ENTITY_BY_ID = Object.fromEntries(DOMAIN_ENTITIES.map((entity) => [entity.id, entity]));

export function getScenario(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || SCENARIOS[0];
}

export function cloneInitialWorld() {
  return JSON.parse(JSON.stringify(INITIAL_WORLD));
}
