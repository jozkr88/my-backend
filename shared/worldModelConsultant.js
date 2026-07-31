// The consultant MVP uses a deliberately explicit, deterministic contract.
// Joz MAXX can enrich the language around this contract, but it does not own
// validation, scoring, IDs, or report permissions.

export const CONSULTANT_VERSION = "world-model-consultant-mvp-1";
export const CONSULTANT_REPORT_PRICE_EUR = 199;

export const CONSULTANT_FIELDS = [
  {
    key: "companyName",
    label: "What is the company called?",
    hint: "A company name or working name is enough.",
    placeholder: "e.g. Northstar Logistics",
    type: "text",
  },
  {
    key: "industry",
    label: "What industry are you in?",
    hint: "This helps select relevant operating patterns.",
    placeholder: "e.g. SaaS, logistics, banking, manufacturing",
    type: "text",
  },
  {
    key: "companySize",
    label: "How large is the organisation?",
    hint: "Give an employee count, revenue range, or a simple description.",
    placeholder: "e.g. 80 people across Europe",
    type: "text",
  },
  {
    key: "systems",
    label: "Which systems run the business today?",
    hint: "Separate systems with commas: CRM, ERP, Jira, warehouse, spreadsheets, and so on.",
    placeholder: "e.g. Salesforce, NetSuite, Jira, Snowflake",
    type: "textarea",
  },
  {
    key: "processes",
    label: "Which important process would you most like to understand or improve?",
    hint: "Describe the flow, not just the department.",
    placeholder: "e.g. project delivery from estimate to customer handover",
    type: "textarea",
  },
  {
    key: "painPoints",
    label: "Where does the operation lose time, money, or confidence?",
    hint: "What is currently hard to predict or coordinate?",
    placeholder: "e.g. deadlines move late and capacity problems are discovered too late",
    type: "textarea",
  },
  {
    key: "decisions",
    label: "Which recurring decision would benefit from better foresight?",
    hint: "World-model candidates involve actions and downstream consequences.",
    placeholder: "e.g. whether to add capacity, reduce scope, or move a deadline",
    type: "textarea",
  },
  {
    key: "dataAndGoals",
    label: "What data do you have, and what outcome matters most?",
    hint: "Include data quality, compliance, budget, or timeline if known.",
    placeholder: "e.g. Jira and CRM data is available; we want fewer delivery surprises in six months",
    type: "textarea",
  },
];

const FIELD_KEYS = new Set(CONSULTANT_FIELDS.map((field) => field.key));

const INDUSTRY_PATTERNS = [
  {
    key: "project_delivery",
    title: "Project Delivery World Model",
    description: "Represent projects, tasks, dependencies, teams and releases so delivery interventions can be compared before execution.",
    signals: ["project", "delivery", "jira", "software", "engineering", "release", "deadline", "capacity", "sprint"],
    entities: ["project", "task", "team", "dependency", "release", "customer"],
    actions: ["reassign capacity", "reduce scope", "move a deadline", "split a release"],
    outcomes: ["delivery date", "cost", "defect rate", "customer satisfaction"],
    base: { businessValue: 8, decisionFrequency: 8, dataReadiness: 6, simulationValue: 9, strategicFit: 8, timeToValue: 7, implementationComplexity: 6, regulatoryRisk: 2 },
  },
  {
    key: "customer_operations",
    title: "Customer Operations World Model",
    description: "Connect customer signals, service work and commercial decisions to anticipate friction and test the next best intervention.",
    signals: ["customer", "crm", "support", "renewal", "sales", "service", "churn", "account"],
    entities: ["customer", "account", "case", "contract", "team", "interaction"],
    actions: ["route an account", "change service capacity", "prioritise an intervention", "adjust an offer"],
    outcomes: ["response time", "retention", "customer satisfaction", "revenue"],
    base: { businessValue: 8, decisionFrequency: 8, dataReadiness: 6, simulationValue: 8, strategicFit: 8, timeToValue: 7, implementationComplexity: 6, regulatoryRisk: 3 },
  },
  {
    key: "supply_chain",
    title: "Supply Chain and Capacity World Model",
    description: "Model demand, inventory, suppliers and constraints so operational choices can be evaluated against likely downstream effects.",
    signals: ["supply", "inventory", "warehouse", "logistics", "manufacturing", "supplier", "fleet", "demand"],
    entities: ["order", "inventory", "supplier", "warehouse", "route", "capacity"],
    actions: ["reallocate stock", "change a route", "add capacity", "change a supplier"],
    outcomes: ["service level", "lead time", "cost", "waste"],
    base: { businessValue: 9, decisionFrequency: 8, dataReadiness: 5, simulationValue: 9, strategicFit: 8, timeToValue: 6, implementationComplexity: 7, regulatoryRisk: 3 },
  },
  {
    key: "risk_and_compliance",
    title: "Risk and Compliance World Model",
    description: "Represent controls, evidence, decisions and obligations so teams can see how operational changes affect risk before acting.",
    signals: ["risk", "compliance", "audit", "banking", "insurance", "regulatory", "control", "policy"],
    entities: ["obligation", "control", "case", "decision", "evidence", "owner"],
    actions: ["prioritise a control", "assign an owner", "change a process", "request evidence"],
    outcomes: ["risk exposure", "control coverage", "audit effort", "incident rate"],
    base: { businessValue: 8, decisionFrequency: 7, dataReadiness: 5, simulationValue: 7, strategicFit: 8, timeToValue: 5, implementationComplexity: 7, regulatoryRisk: 8 },
  },
];

function clean(value, max = 1200) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function splitList(value, max = 12) {
  return clean(value, 1200)
    .split(/[,;\n]/)
    .map((entry) => clean(entry, 160))
    .filter(Boolean)
    .slice(0, max);
}

export function createEmptyConsultantProfile() {
  return {
    companyName: "",
    industry: "",
    companySize: "",
    markets: [],
    businessModel: [],
    productsServices: [],
    systems: [],
    currentAiCapabilities: [],
    processes: [],
    painPoints: [],
    decisions: [],
    goals: [],
    complianceRequirements: [],
    dataSources: [],
    dataMaturity: "unknown",
    budgetRange: "",
    timeline: "",
    dataAndGoals: "",
    confidenceScore: 0,
  };
}

export function normalizeConsultantProfile(input = {}) {
  const profile = createEmptyConsultantProfile();
  profile.companyName = clean(input.companyName, 160);
  profile.industry = clean(input.industry, 160);
  profile.companySize = clean(input.companySize, 160);
  profile.systems = Array.isArray(input.systems) ? input.systems.map((x) => clean(x, 120)).filter(Boolean).slice(0, 20) : splitList(input.systems);
  profile.processes = Array.isArray(input.processes) ? input.processes.map((x) => clean(x, 500)).filter(Boolean).slice(0, 12) : splitList(input.processes, 8);
  profile.painPoints = Array.isArray(input.painPoints) ? input.painPoints.map((x) => clean(x, 500)).filter(Boolean).slice(0, 12) : splitList(input.painPoints, 8);
  profile.decisions = Array.isArray(input.decisions) ? input.decisions.map((x) => clean(x, 500)).filter(Boolean).slice(0, 12) : splitList(input.decisions, 8);
  profile.dataAndGoals = clean(input.dataAndGoals, 1200);
  profile.dataSources = Array.isArray(input.dataSources) ? input.dataSources.map((x) => clean(x, 120)).filter(Boolean).slice(0, 20) : [];
  profile.goals = Array.isArray(input.goals) ? input.goals.map((x) => clean(x, 240)).filter(Boolean).slice(0, 12) : [];
  profile.markets = Array.isArray(input.markets) ? input.markets.map((x) => clean(x, 120)).filter(Boolean).slice(0, 12) : [];
  profile.businessModel = Array.isArray(input.businessModel) ? input.businessModel.map((x) => clean(x, 120)).filter(Boolean).slice(0, 12) : [];
  profile.productsServices = Array.isArray(input.productsServices) ? input.productsServices.map((x) => clean(x, 240)).filter(Boolean).slice(0, 12) : [];
  profile.currentAiCapabilities = Array.isArray(input.currentAiCapabilities) ? input.currentAiCapabilities.map((x) => clean(x, 160)).filter(Boolean).slice(0, 12) : [];
  profile.complianceRequirements = Array.isArray(input.complianceRequirements) ? input.complianceRequirements.map((x) => clean(x, 160)).filter(Boolean).slice(0, 12) : [];
  profile.dataMaturity = clean(input.dataMaturity || "unknown", 40).toLowerCase() || "unknown";
  profile.budgetRange = clean(input.budgetRange, 120);
  profile.timeline = clean(input.timeline, 120);
  profile.confidenceScore = Number.isFinite(Number(input.confidenceScore)) ? Math.max(0, Math.min(1, Number(input.confidenceScore))) : 0;
  return profile;
}

export function applyConsultantAnswer(profile, field, answer) {
  if (!FIELD_KEYS.has(field)) throw new Error("Unsupported consultant field");
  const next = normalizeConsultantProfile(profile);
  const value = clean(answer, 1600);
  if (field === "systems") next.systems = splitList(value, 20);
  else if (field === "processes") next.processes = value ? [value] : [];
  else if (field === "painPoints") next.painPoints = value ? [value] : [];
  else if (field === "decisions") next.decisions = value ? [value] : [];
  else if (field === "dataAndGoals") next.dataAndGoals = value;
  else next[field] = value;
  const answered = CONSULTANT_FIELDS.filter((item) => isConsultantFieldAnswered(next, item.key)).length;
  next.confidenceScore = Math.round((answered / CONSULTANT_FIELDS.length) * 100) / 100;
  return next;
}

export function isConsultantFieldAnswered(profile, field) {
  const value = profile?.[field];
  return Array.isArray(value) ? value.length > 0 : Boolean(clean(value));
}

export function getNextConsultantField(profile) {
  const normalized = normalizeConsultantProfile(profile);
  return CONSULTANT_FIELDS.find((field) => !isConsultantFieldAnswered(normalized, field.key)) || null;
}

function includesSignal(profileText, signals) {
  return signals.some((signal) => profileText.includes(signal));
}

function scoreMaturity(profile) {
  const text = JSON.stringify(profile).toLowerCase();
  let score = 25;
  if (profile.systems.length >= 2) score += 15;
  if (profile.systems.length >= 5) score += 10;
  if (profile.processes.length) score += 12;
  if (profile.decisions.length) score += 12;
  if (profile.painPoints.length) score += 8;
  if (profile.dataAndGoals.length > 80) score += 8;
  if (includesSignal(text, ["warehouse", "database", "snowflake", "bigquery", "data lake", "api"])) score += 10;
  if (includesSignal(text, ["ai", "machine learning", "model", "automation"])) score += 8;
  return Math.max(0, Math.min(100, score));
}

function scoreOpportunity(pattern, profile, maturity) {
  const text = JSON.stringify(profile).toLowerCase();
  const signalBoost = pattern.signals.filter((signal) => text.includes(signal)).length;
  const readiness = Math.min(10, pattern.base.dataReadiness + Math.round(maturity / 25) + Math.min(2, signalBoost));
  const factors = { ...pattern.base, dataReadiness: readiness };
  const score = (
    factors.businessValue * 0.25 +
    factors.decisionFrequency * 0.10 +
    factors.dataReadiness * 0.15 +
    factors.simulationValue * 0.15 +
    factors.strategicFit * 0.15 +
    factors.timeToValue * 0.10 -
    factors.implementationComplexity * 0.05 -
    factors.regulatoryRisk * 0.05 +
    Math.min(1.2, signalBoost * 0.25)
  );
  return {
    key: pattern.key,
    title: pattern.title,
    description: pattern.description,
    score: Math.round(score * 10) / 10,
    scoreOutOf10: Math.round(Math.max(0, Math.min(10, score)) * 10) / 10,
    factors,
    evidence: [
      signalBoost ? `Matched ${signalBoost} operating signal${signalBoost === 1 ? "" : "s"} in the discovery answers.` : "This is a general candidate pending more evidence.",
      profile.decisions[0] ? `Decision context: ${profile.decisions[0]}` : "A recurring decision has not yet been fully specified.",
    ],
    assumptions: ["Data access and ownership must be confirmed before implementation.", "Value is directional until baseline KPIs and historical outcomes are validated."],
    confidence: Math.round(Math.min(0.92, 0.42 + signalBoost * 0.08 + maturity / 500) * 100) / 100,
    worldModelFit: {
      changingState: true,
      connectedEntities: pattern.entities,
      actions: pattern.actions,
      measurableOutcomes: pattern.outcomes,
    },
  };
}

export function analyzeConsultantProfile(input = {}) {
  const profile = normalizeConsultantProfile(input);
  const maturityScore = scoreMaturity(profile);
  const opportunities = INDUSTRY_PATTERNS
    .map((pattern) => scoreOpportunity(pattern, profile, maturityScore))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const top = opportunities[0];
  return {
    version: CONSULTANT_VERSION,
    generatedAt: new Date().toISOString(),
    profile,
    maturity: {
      score: maturityScore,
      label: maturityScore >= 70 ? "Ready to shape a pilot" : maturityScore >= 45 ? "Foundations are forming" : "Discovery is the first priority",
      evidence: [
        `${profile.systems.length} system${profile.systems.length === 1 ? "" : "s"} named`,
        `${profile.processes.length} important process${profile.processes.length === 1 ? "" : "es"} described`,
        `${profile.decisions.length} recurring decision${profile.decisions.length === 1 ? "" : "s"} described`,
      ],
    },
    opportunities,
    priorityPilot: top ? {
      title: top.title,
      whyNow: "Start with one repeatable decision where state, actions and outcomes can be observed.",
      scope: top.worldModelFit,
      confidence: top.confidence,
    } : null,
    dataGaps: [
      profile.systems.length ? "Confirm system ownership and extraction access." : "Map the systems and spreadsheets that contain operational state.",
      profile.decisions.length ? "Define the baseline KPI and outcome window for the priority decision." : "Name one decision that has a measurable downstream outcome.",
      "Validate historical events, timestamps, and data quality before simulating interventions.",
    ],
    nextStep: "Validate the priority decision, baseline its outcome, and design a bounded pilot with human approval before execution.",
    disclaimer: "This assessment is directional. It is not an ROI guarantee or a claim that the current site is already an enterprise world-model platform.",
  };
}

export function validateConsultantProfile(input = {}) {
  const profile = normalizeConsultantProfile(input);
  const missing = CONSULTANT_FIELDS.filter((field) => !isConsultantFieldAnswered(profile, field.key)).map((field) => field.key);
  return { valid: missing.length === 0, missing, profile };
}
