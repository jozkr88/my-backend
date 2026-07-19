import {
  JOZ_LLM_CV,
  JOZ_LLM_IDENTITY,
  buildJozLlmFallbackReply,
  buildJozLlmSystemPrompt,
} from "./jozLlmProfile.js";
import {
  buildMeetJozWorldAnswerContext,
  buildMeetJozWorldAwarenessReply,
  buildMeetJozWorldAwarenessResolution,
  resolveMeetJozWorldEntity,
} from "./meetJozWorld.js";

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^waht does\b/g, "what does");
}

const EXCLUDED_COMPANY_PATTERNS = [/\bparadex\b/gi, /\bdime\b/gi, /\bbloomberg\b/gi];

function sanitizeReply(text = "") {
  let value = String(text || "").trim();
  for (const pattern of EXCLUDED_COMPANY_PATTERNS) {
    value = value.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
  }
  return value;
}

function splitIntoSentences(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickLeadingSentences(text = "", maxSentences = 2) {
  return splitIntoSentences(text).slice(0, maxSentences).join(" ").trim();
}

function normalizeDefinitionPromptPrefix(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const typoPrefixRewrites = [
    [/^hat is\b/i, "what is"],
    [/^wat is\b/i, "what is"],
    [/^wht is\b/i, "what is"],
    [/^whats\b/i, "what's"],
  ];

  for (const [pattern, replacement] of typoPrefixRewrites) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, replacement);
    }
  }

  return trimmed;
}

function extractDefinitionTerm(text = "") {
  const match = normalizeDefinitionPromptPrefix(text)
    .match(/^(?:what is|what's|who is|define|explain)\s+(.+?)(?:\?|\.|!)?$/i);
  if (!match) return null;

  const term = String(match[1] || "")
    .trim()
    .replace(/^(?:a|an|the)\s+/i, "")
    .trim();

  return term || null;
}

function retrievedDocsMentionDefinitionTerm(term = "", docs = []) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm || normalizedTerm.length < 2) return false;

  return docs.some((doc) => {
    const haystack = normalizeText(
      [
        doc?.title,
        doc?.summary,
        doc?.body,
        ...(Array.isArray(doc?.metadata?.tags) ? doc.metadata.tags : []),
        ...(Array.isArray(doc?.metadata?.claims) ? doc.metadata.claims : []),
        ...(Array.isArray(doc?.metadata?.proof_points) ? doc.metadata.proof_points : []),
      ]
        .filter(Boolean)
        .join(" ")
    );

    return haystack.includes(normalizedTerm);
  });
}

function buildRetrievedKnowledgeReply(input = "", retrievedDocuments = []) {
  const clean = normalizeText(input);
  if (clean.includes("permissions be enforced before retrieval") || clean.includes("permissions enforced before retrieval")) {
    return "Permissions must be enforced before retrieval. Unauthorized information must never enter the LLM context window.";
  }

  if (
    clean.includes("difference between docker and kubernetes") ||
    clean.includes("docker vs kubernetes") ||
    clean.includes("docker versus kubernetes") ||
    clean.includes("when would joz use docker versus kubernetes") ||
    clean.includes("when would joz use docker vs kubernetes")
  ) {
    return "Docker packages a service and its dependencies into a portable container image. Kubernetes deploys, scales, restarts, and manages containers across machines. Docker packages the service; Kubernetes runs and manages it.";
  }

  if (clean.includes("difference between postgresql and redis")) {
    return "PostgreSQL stores durable application state and remains the source of truth. Redis stores cache and short-lived state for low-latency access. Redis should not be treated as the authoritative source of truth.";
  }

  if (clean.includes("kafka versus nats")) {
    return "Joz would use Kafka for durable event streams, replay, high throughput, and analytics pipelines. He would use NATS for lightweight, low-latency messaging and request-reply patterns.";
  }

  if (clean.includes("difference between logs, metrics, and traces")) {
    return "Logs show what happened in discrete events. Metrics show how the system behaves over time. Traces show how one request moves across services.";
  }

  if (clean.includes("has joz personally operated kubernetes in production")) {
    return "That is not established by approved experience proof here. The infrastructure dataset should be treated as Joz's architectural guidance and implementation approach, not as evidence of a specific personal production deployment.";
  }

  if (clean.includes("prompt injection")) {
    return "Treat all external content as untrusted data. Separate system instructions from retrieved content. Security policy must be enforced outside the model so untrusted text cannot override permissions, approvals, or execution rules.";
  }

  if (clean.includes("doing something stupid in production")) {
    return "Joz would stop that by keeping policy, approval, execution, and verification outside the model. High-risk actions should require deterministic policy checks, scoped tool permissions, bounded retries, human approval where needed, and post-action verification against authoritative state so the system stops or escalates instead of taking unsafe action.";
  }

  if (clean.includes("what is an agent")) {
    return "An agent is an AI worker with a defined responsibility. In Joz's framing: Agent = LLM + instructions + tools + memory + reasoning loop. An agent interprets a goal, selects approved tools, reads relevant context, updates workflow state, and iterates until the task is complete or requires human input.";
  }

  if (clean.includes("what breaks first when agent systems scale")) {
    return "What breaks first is usually not the model itself. It is queue depth, latency, tool bottlenecks, context bloat, retry storms, cache misses, database contention, or verification backlog. Joz scales agent systems by separating API intake, orchestration, tools, retrieval, execution, and verification so each bottleneck can be measured and scaled independently.";
  }

  if (clean.includes("what is docker")) {
    return "Docker packages an application and its dependencies into a portable container image. It solves environment consistency so the same image can run locally, in testing, and in production.";
  }

  if (clean.includes("what is kubernetes")) {
    return "Kubernetes deploys, schedules, scales, restarts, and manages containers across multiple machines. It handles pod scheduling, health checks, self-healing, service discovery, and rolling deployments.";
  }

  if (clean.includes("what is a kubernetes pod")) {
    return "A Kubernetes Pod is the smallest deployable unit in Kubernetes. A pod usually contains one application container, and Kubernetes replaces unhealthy pods automatically.";
  }

  if (clean.includes("what is a kubernetes deployment")) {
    return "A Kubernetes Deployment defines how many copies of a service should run and how updates should be rolled out. It manages replicas, rolling updates, rollback, scaling, and self-healing.";
  }

  if (clean.includes("what is a kubernetes service")) {
    return "A Kubernetes Service gives a stable network address to a changing group of pods. Pods can be replaced or rescheduled, but the service address remains stable.";
  }

  if (clean.includes("what is ingress")) {
    return "Ingress routes external HTTP traffic into Kubernetes services. It is the traffic entry layer into the cluster, while an API gateway adds broader control features like authentication, rate limiting, and policy.";
  }

  if (clean.includes("what does a load balancer do")) {
    return "A load balancer distributes incoming traffic across multiple service instances. It improves availability, horizontal scaling, failure isolation, and resource use.";
  }

  if (clean.includes("what is horizontal scaling")) {
    return "Horizontal scaling means adding more service instances. Modern distributed systems usually use it for stateless APIs and workers.";
  }

  if (clean.includes("what is autoscaling")) {
    return "Autoscaling adjusts compute capacity based on demand signals like CPU, memory, request rate, queue depth, backlog, or latency. In agent systems it should be used carefully because model latency, token usage, and external API limits can create nonlinear load.";
  }

  if (clean.includes("why should apis be stateless")) {
    return "APIs should be stateless because state stored externally is easier to scale, restart, and move across machines. Stateless services are better suited to horizontal scaling and automated recovery.";
  }

  if (clean.includes("what is postgresql used for")) {
    return "PostgreSQL is used for durable application state such as users, permissions, workflow state, agent runs, audit records, configuration, and metadata.";
  }

  if (clean.includes("what is redis used for")) {
    return "Redis is used for low-latency access to cache and short-lived state. Typical uses include caching, sessions, rate limits, distributed locks, short-lived workflow state, queues, and pub/sub.";
  }

  if (clean.includes("wire redis and postgresql together")) {
    return "Joz would keep PostgreSQL as the durable source of truth and use Redis for cache and short-lived coordination. Writes should land in PostgreSQL first or through a controlled workflow, while Redis accelerates repeated reads, sessions, rate limits, locks, and transient state. The rule is simple: durable business state in PostgreSQL, fast ephemeral state in Redis.";
  }

  if (clean.includes("what is kafka")) {
    return "Kafka moves events between services asynchronously and is suited to durable event streams, replay, high throughput, and analytics pipelines.";
  }

  if (clean.includes("what is event-driven architecture")) {
    return "Event-driven architecture lets services publish events instead of calling every downstream service directly. That improves decoupling, scalability, and recoverability.";
  }

  if (clean.includes("what is temporal used for")) {
    return "Temporal is used for durable workflow execution. It handles retries, timeouts, approval waits, long-running workflows, crash recovery, state reconstruction, and compensation logic.";
  }

  if (clean.includes("what is workload identity")) {
    return "Workload identity lets services prove who they are without sharing long-lived static credentials. It is safer than embedding shared secrets in services.";
  }

  if (clean.includes("what is vault") || clean.includes("what is kms")) {
    return "Vault and KMS protect secrets and keys. Secrets must not be stored in source code, images, logs, or plain environment files. Use Vault, KMS, or a managed secret store for API keys, database credentials, signing keys, certificates, and tokens.";
  }

  if (clean.includes("protect secrets") || clean.includes("secrets in an ai system")) {
    return "Joz would protect secrets with Vault, KMS, or a managed secret store plus workload identity and least-privilege access. Secrets must not be stored in source code, container images, logs, prompts, or plain environment files. The model should never receive raw secret material unless a scoped tool needs a derived result rather than the credential itself.";
  }

  if (clean.includes("what is opentelemetry")) {
    return "OpenTelemetry is an open standard for collecting traces, metrics, and logs across services. It acts as the system-wide instrumentation layer.";
  }

  if (clean.includes("what is langsmith")) {
    return "LangSmith provides tracing, evaluation, and debugging for LLM and agent workflows. It does not replace infrastructure observability.";
  }

  if (clean.includes("what is ci/cd")) {
    return "CI/CD automates software integration, testing, security checks, packaging, deployment, and verification. CI means Continuous Integration, and CD means Continuous Delivery or Deployment.";
  }

  if (clean.includes("what is terraform")) {
    return "Terraform defines infrastructure as code through version-controlled configuration. It improves repeatability, reviewability, auditability, environment consistency, and automated provisioning.";
  }

  if (clean.includes("what is gitops")) {
    return "GitOps uses Git as the source of truth for infrastructure and deployment state. Changes are reviewed in Git and then reconciled automatically into the target environment.";
  }

  if (clean.includes("what is a canary deployment")) {
    return "A canary deployment sends a small percentage of traffic to a new version first. It reduces deployment risk and supports safer rollback.";
  }

  if (clean.includes("what is a circuit breaker")) {
    return "A circuit breaker stops repeated calls to an unhealthy dependency. It prevents cascading failures by blocking calls while a dependency is unhealthy and allowing limited recovery checks later.";
  }

  if (clean.includes("what are retries")) {
    return "Retries should use bounded attempts, exponential backoff, and jitter. Unbounded retries can overload failing systems and create cascading failures.";
  }

  if (clean.includes("what is idempotency")) {
    return "Idempotency means repeating the same request still produces one logical result. It is critical for payments, orders, workflow retries, transactions, and webhook processing.";
  }

  if (clean.includes("what is backpressure")) {
    return "Backpressure prevents the system from accepting more work than it can safely process. It protects latency and stability through limits such as queue caps, concurrency caps, rate limits, admission control, and load shedding.";
  }

  if (clean.includes("what is fastapi")) {
    return "FastAPI is a Python framework used as the API entry point for backend services. Joz uses it to receive requests, authenticate users, validate input, call orchestration or agent workflows, and return structured responses.";
  }

  if (clean.includes("what is mcp")) {
    return "MCP means Model Context Protocol. It standardizes how AI clients discover and use tools. MCP is not an agent and not a model; it is the protocol layer connecting them.";
  }

  if (clean.includes("difference between an agent and an api")) {
    return "An agent decides how to achieve a goal. An API or service exposes a capability. Joz treats the API as a tool surface the agent orchestrates, not as the agent itself.";
  }

  if (clean.includes("difference between a tool and an agent")) {
    return "A tool executes a capability such as an API call, query, calculation, or external action. An agent decides what information is needed, which tools to use, and what step should happen next. Joz treats tools as controlled capabilities inside the agent, not as the agent itself.";
  }

  if (clean.includes("difference between an agent and a model")) {
    return "An agent decides how to use instructions, tools, memory, and a reasoning loop to complete a task. A model produces a prediction or representation. Joz treats the model as one component inside the agent, not as the agent itself.";
  }

  if (
    clean.includes("can agents deploy directly to production") ||
    clean.includes("should an ai agent deploy directly to production")
  ) {
    return "No. Autonomous agents must not deploy directly to production, push directly to the main branch, or merge their own pull requests. Production deployments require explicit human approval plus deterministic verification.";
  }

  if (clean.includes("deploy code themselves")) {
    return "Agents should not deploy code by themselves into production. Joz keeps deployment behind explicit approval, deterministic verification, rollback controls, and policy gates so the system cannot silently push unsafe changes.";
  }

  if (clean.includes("what actions should require human approval")) {
    return "High-risk actions require human approval, especially database migrations, security changes, infrastructure changes, production deployments, destructive operations, and code merges. Joz keeps those gates outside the agent so policy validates before execution acts.";
  }

  if (clean.includes("what should always require human approval")) {
    return "High-risk actions require human approval, especially database migrations, security changes, infrastructure changes, production deployments, destructive operations, signing operations, and code merges. Joz keeps those gates outside the agent so policy validates before execution acts.";
  }

  if (clean.includes("approvals, escalation, and rollback") || clean.includes("approvals escalation and rollback")) {
    return "Joz would structure it as Policy Gate -> Approval Step -> Execution -> Verification -> Rollback or Escalation. Low-risk actions can proceed automatically, high-risk actions must stop for human approval, failed verification should trigger rollback where safe, and unresolved failures should escalate with evidence, logs, and the authoritative state attached.";
  }

  if (clean.includes("safest way for an ai system to use secrets")) {
    return "The safest pattern is to keep secrets outside the model and outside source code by using Vault, KMS, or a managed secret store with workload identity and least-privilege access. The model should receive derived results through scoped tools, not raw credentials.";
  }

  if (clean.includes("how should an ai agent interact with blockchain")) {
    return "Joz would route blockchain actions through Agent to Policy to Risk to Approval to Signing Service to Execution to Verification. The agent must never directly control unrestricted private keys, and signing should stay behind scoped policies, simulations, and explicit limits.";
  }

  if (
    clean.includes("how does joz scale an agent platform") ||
    clean.includes("how would joz scale an agent platform") ||
    clean.includes("scale an agent platform under high concurrency")
  ) {
    return "Joz scales an agent platform by separating API intake, reasoning workers, tool services, embedding workers, evaluation workers, execution services, and verification services. He scales each component independently based on its own bottleneck, because reasoning is often limited by model latency and cost while execution is often limited by external systems, consistency, and security.";
  }

  if (clean.includes("how does joz approach disaster recovery")) {
    return "Joz approaches disaster recovery through backups, replication, failover procedures, tested recovery steps, infrastructure as code, and defined RTO and RPO targets. He treats recoverability as part of production design, not as a later operational add-on.";
  }

  if (clean.includes("what is joz's infrastructure philosophy") || clean.includes("what is jozs infrastructure philosophy")) {
    return "Joz approaches infrastructure as the production foundation for scalable, secure, observable, resilient, and repeatable AI systems. He prefers simple infrastructure first, then adds Kubernetes, event streaming, service meshes, and advanced automation only when scale, risk, or operational complexity justify them.";
  }

  const docs = normalizeRetrievedDocuments(retrievedDocuments).slice(0, 3);
  if (!docs.length) return null;

  const definitionTerm = extractDefinitionTerm(clean);
  if (definitionTerm && !retrievedDocsMentionDefinitionTerm(definitionTerm, docs)) {
    return null;
  }

  const lead = docs[0];
  const leadText = pickLeadingSentences(lead.body || lead.summary || "", 2);

  if (!leadText) return null;

  if (clean.includes("how would joz build")) {
    const follow = docs[1] ? pickLeadingSentences(docs[1].body || docs[1].summary || "", 1) : "";
    return sanitizeReply([leadText, follow].filter(Boolean).join(" "));
  }

  return sanitizeReply(leadText);
}

function includesAny(text, patterns = []) {
  return patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern))
  );
}

function includesWholeWord(text, words = []) {
  return words.some((word) => new RegExp(`\\b${String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

const JOZ_OPERATIONAL_ACTIONS = [
  {
    id: "call_joz",
    label: "Call Joz",
    type: "tel",
    href: "tel:+6531072412",
  },
  {
    id: "email_joz",
    label: "Email Joz",
    type: "mailto",
    href: "mailto:joz@meetjoz.com",
  },
];

function buildOperationalActions() {
  return JOZ_OPERATIONAL_ACTIONS.map((action) => ({ ...action }));
}

function validateOperationalReply(intent, reply = "", actions = []) {
  const cleanReply = normalizeText(reply);
  const actionIds = actions.map((action) => action.id);
  const hasRequiredActions =
    actionIds.includes("call_joz") && actionIds.includes("email_joz");

  if (!hasRequiredActions) return false;

  if (intent === "recruiter_location") {
    return ["dubai", "singapore", "zurich", "europe", "global markets"].every((term) =>
      cleanReply.includes(term)
    );
  }

  if (intent === "recruiter_compensation") {
    return !/\b(?:usd|sgd|eur|gbp|aed|chf|\$|€|£)\s*\d/i.test(reply);
  }

  if (intent === "recruiter_work_authorization") {
    return !/\bcurrent(?:ly)?\s+(?:has|holds)\b.*\b(ep|pep|work pass|work authorization)\b/i.test(reply);
  }

  return true;
}

function composeLocationAnswer(subIntent = "positioning") {
  if (subIntent === "residence") {
    return "Joz's current residence or legal address should be confirmed directly for the specific hiring process.";
  }
  return "Joz operates across Dubai, Singapore, Zurich, Europe, and global markets.";
}

function composeAvailabilityAnswer() {
  return "Joz is open to discussing suitable opportunities. Availability depends on the role, location, scope, and start-date requirements.";
}

function composeNoticePeriodAnswer() {
  return "Joz's current notice period and earliest start date should be confirmed directly for the specific hiring process.";
}

function composeCompensationAnswer() {
  return "Compensation depends on the role scope, location, seniority, responsibilities, and overall package. The best next step is a direct conversation with Joz.";
}

function composeSingaporeCompensationAnswer() {
  return "Compensation for a Singapore role depends on scope, seniority, responsibilities, and the overall package. The best next step is a direct discussion with Joz using the specific Singapore role context.";
}

function composeWorkingModelAnswer() {
  return "Joz is open to remote, hybrid, or on-site arrangements depending on the role, team, and location requirements. The specific working model should be confirmed directly with Joz.";
}

function composeHiringAnswer() {
  return "Joz is open to discussing suitable international opportunities across regulated, enterprise, and product-led environments.";
}

function composeRelocationAnswer() {
  return "Joz is open to discussing suitable international relocation where the role, location, and overall fit make sense.";
}

function composeWorkAuthorizationAnswer(subIntent = "generic") {
  if (subIntent === "singapore_specific") {
    return "Joz is Slovak and an EU national. Current Singapore work authorization, EP, PEP, or sponsorship requirements should be confirmed directly for the specific hiring process rather than assumed.";
  }
  return "Joz is Slovak and an EU national. Work authorization, visa, or sponsorship requirements for any specific country should be confirmed directly for the hiring process.";
}

function composeSingaporeFitAnswer() {
  return "Joz is a strong fit for Singapore recruiter conversations because the proof is already Singapore-relevant: 20x digital sales growth at Maybank-Ageas Etiqa, a Lean ML UX practice across 11 APAC markets at Manulife, 30x audience growth and a global experience language across 30+ products at Mediacorp, Singapore Stock Exchange portal re-engineering, and Apple/Pixar-adjacent Python USD(z) and computer-vision workflows in Singapore.";
}

function composeContactAnswer() {
  return "You can contact Joz by phone at +65 3107 2412 or by email at joz@meetjoz.com.";
}

function buildRecruiterOperationalResolution(route = {}) {
  const actions = buildOperationalActions();
  let reply = "";
  let selectedOperationalComposer = "";

  switch (route?.detectedIntent) {
    case "recruiter_location":
      reply = composeLocationAnswer(route.detectedSubIntent);
      selectedOperationalComposer = "composeLocationAnswer";
      break;
    case "recruiter_availability":
      reply = composeAvailabilityAnswer();
      selectedOperationalComposer = "composeAvailabilityAnswer";
      break;
    case "recruiter_notice_period":
      reply = composeNoticePeriodAnswer();
      selectedOperationalComposer = "composeNoticePeriodAnswer";
      break;
    case "recruiter_compensation":
      reply =
        route.detectedSubIntent === "singapore_specific"
          ? composeSingaporeCompensationAnswer()
          : composeCompensationAnswer();
      selectedOperationalComposer =
        route.detectedSubIntent === "singapore_specific"
          ? "composeSingaporeCompensationAnswer"
          : "composeCompensationAnswer";
      break;
    case "recruiter_working_model":
      reply = composeWorkingModelAnswer();
      selectedOperationalComposer = "composeWorkingModelAnswer";
      break;
    case "recruiter_hiring":
      reply = composeHiringAnswer();
      selectedOperationalComposer = "composeHiringAnswer";
      break;
    case "recruiter_relocation":
      reply = composeRelocationAnswer();
      selectedOperationalComposer = "composeRelocationAnswer";
      break;
    case "recruiter_work_authorization":
      reply = composeWorkAuthorizationAnswer(route.detectedSubIntent);
      selectedOperationalComposer = "composeWorkAuthorizationAnswer";
      break;
    case "recruiter_singapore_fit":
      reply = composeSingaporeFitAnswer();
      selectedOperationalComposer = "composeSingaporeFitAnswer";
      break;
    case "recruiter_contact":
      reply = composeContactAnswer();
      selectedOperationalComposer = "composeContactAnswer";
      break;
    default:
      return null;
  }

  return {
    reply,
    answerSource: "deterministic_recruiter_operational",
    composer: selectedOperationalComposer,
    selectedOperationalComposer,
    actions,
    recommendedActionIds: actions.map((action) => action.id),
    validationPassed: validateOperationalReply(route.detectedIntent, reply, actions),
    fallbackUsed: false,
    intentMode: "booking",
    retrievedCategories: [],
  };
}

function buildCanonicalWorldConceptReply({ concept, appContext, legacyContext, input }) {
  if (concept === "gold_pill") {
    return buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext });
  }

  if (concept === "neo_maxx") {
    return [
      "neoMAXX is a concept created by Joz Krupa.",
      "It combines human judgment, AI capability, design, engineering, and execution into a higher-order innovation system.",
      "In the sequence, neoMAXX frames the intelligence world, while MeetJoz shows the applied human proof, business value, systems mindset, and deeper skills around it.",
    ].join(" ");
  }

  return "";
}

function composeIdentityProfileReply() {
  return [
    "Joz Krupa is an Agentic AI Architecture and Innovation Leader with experience across Singapore, Dubai, Europe, and global markets.",
    "Joz combines AI architecture, systems thinking, product strategy, design, engineering, and enterprise transformation to turn complexity into measurable business outcomes.",
    "Joz's work includes Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, Apple/Pixar-related spatial computing work, and current Agentic AI initiatives.",
    "MeetJoz is Joz's interactive spatial experience for exploring Business Value, Systems Mindset, Skills, and neoMAXX concepts.",
  ].join(" ");
}

function composeFactualProfileReply(subIntent) {
  if (subIntent === "education") {
    return "Joz holds an MSc in Strategy and Innovation from the University of Central Lancashire in the United Kingdom and also held an Innovation Strategist university appointment there.";
  }

  if (subIntent === "degree") {
    return "Joz's degree is an MSc in Strategy and Innovation from the University of Central Lancashire in the United Kingdom.";
  }

  if (subIntent === "certifications") {
    return "Joz's certifications and advanced training include MIT/IDEO Design Thinking, HPI d.school prototyping labs, and Apple Design Labs plus Apple Engineering Labs and WWDC programs focused on AI and spatial computing.";
  }

  if (subIntent === "location") {
    return "Joz operates across Bratislava, Slovakia, Singapore, Dubai, Zurich, Europe, and global markets.";
  }

  if (subIntent === "contact") {
    return `Joz can be reached at ${JOZ_LLM_IDENTITY.email}, ${JOZ_LLM_IDENTITY.phone}, and ${JOZ_LLM_IDENTITY.website}.`;
  }

  if (subIntent === "nationality") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.nationality;
  }

  if (subIntent === "availability") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.availability;
  }

  if (subIntent === "experience") {
    return JOZ_LLM_IDENTITY.recruiterAnswers.experience;
  }

  return "";
}

function composeBusinessNeedReply(subIntent = "hire_value") {
  if (subIntent === "business_diagnosis") {
    return "Start with one decision or workflow where bad data and slow decisions are creating measurable cost, delay, or risk. Joz would map the current process, identify the authoritative sources and data owners, establish a baseline, and separate a quick enablement win from deeper data and systems work. Then pilot a bounded use case with grounded retrieval, human approval, and outcome metrics before expanding into broader automation or agents.";
  }

  if (subIntent === "business_value_definition") {
    return "Business value is the measurable improvement AI creates in revenue, margin, cost, speed, risk, or decision quality. For Joz, that means lower friction, faster execution, stronger management leverage, and clearer commercial outcomes, not feature theater. The test is simple: what changed operationally, financially, or strategically because the system works better?";
  }

  if (subIntent === "efficiency") {
    return "Joz creates business value through efficiency by cutting manual work, process cost, and cycle time across finance, ERP, accounting, HR, marketing, and operations. The lever is process redesign: use retrieval, summarization, classification, and workflow orchestration to remove friction while keeping human approval on critical decisions. That creates stronger operational leverage, backed by 70% lower handoff friction at Leo Burnett/Publicis and regional ML execution scale at Manulife.";
  }

  if (subIntent === "processes") {
    return "Joz creates value through process redesign by turning fragmented workflows into clearer AI-supported operating flows. That means better routing, fewer exception delays, faster approvals, and more reusable knowledge across ERP, finance, HR, marketing, and operations. The goal is not generic automation. It is clearer ownership, stronger control, faster throughput, and workflows redesigned around better intelligence with humans still accountable for the critical decisions. The operating proof behind that approach includes 70% lower handoff friction at Leo Burnett/Publicis and regional ML execution design at Manulife.";
  }

  if (subIntent === "function_processes") {
    return "Joz redesigns business processes by starting at the operating work itself: map where ERP, accounting, HR, marketing, and operations lose time, create duplicate effort, or hide decisions, then insert AI only where it improves flow without removing control. That means clearer routing, approval checkpoints, exception handling, and auditability by function. The result is not one generic automation layer. It is function-specific workflow redesign with better signal, retained accountability, and less management fog. The proof is practical: handoff friction reduction at Leo Burnett/Publicis and ML-supported operating design at Manulife show the method works in real organizations.";
  }

  if (subIntent === "growth") {
    return "Joz supports growth by improving decision speed, commercial signal quality, and execution capacity without scaling overhead at the same rate as complexity. That means stronger conversion support, faster go-to-market coordination, and better decisions with less noise. The proof is commercial and real: 20x digital sales growth at Maybank-Ageas Etiqa, 30x audience growth at Mediacorp, and Lean ML execution across 11 APAC markets at Manulife.";
  }

  if (subIntent === "roi") {
    return "The strongest ROI comes from cost reduction, faster decisions, productivity gains, lower friction, and revenue growth. Joz is strongest where AI removes repeated manual work, improves workflow throughput, and gives leadership clearer decision support across business functions. ROI should be tied to a baseline, target metrics, governance, and proof, not sold as vague upside or generic innovation language.";
  }

  if (subIntent === "functions") {
    return "Joz creates business value across functions by mapping AI into real operating areas, not abstract categories. In finance and accounting that includes AP, AR, close support, forecasting, and anomaly detection. In ERP and operations it includes planning and exception handling. In HR, marketing, sales, and leadership it improves knowledge reuse, reporting clarity, workflow support, and decision signal leaders can act on. The point is function-specific leverage, not one broad AI layer imposed on everyone the same way.";
  }

  if (subIntent === "operating_model") {
    return "Joz creates value at the operating-model level by helping a company decide where AI should sit, who owns what, where human approval stays, how workflows escalate, and how outcomes are measured. That matters because isolated AI features do not scale without governance and execution design. The result is stronger adoption, clearer accountability, and AI embedded into real operations rather than sitting beside them. The pattern is to combine workflow design, approval checkpoints, role clarity, and measurable business outcomes before scaling autonomy.";
  }

  if (subIntent === "decision_support") {
    return "Joz creates business value through decision support by improving signal, prioritization, and executive clarity in noisy environments. That means helping teams see what changed, why it matters, what action is recommended, and what outcome should be measured. The value is not just automation. It is better judgment, faster alignment, and more accountable execution across leadership and operating teams when complexity is high. The strongest proof is commercial and operational: 20x digital sales growth at Maybank-Ageas Etiqa, 30x audience growth at Mediacorp, and Lean ML execution across 11 APAC markets at Manulife all depended on clearer signal and better decisions, not just more tooling.";
  }

  return "Joz is worth hiring because the proof is enterprise-scale and measurable: 20x digital sales growth at Maybank-Ageas Etiqa, Lean ML transformation across 11 APAC markets at Manulife, 30x audience growth at Mediacorp, and 16M+ customer-scale engineering at Erste Bank. Under that proof layer, Joz brings agentic AI architecture, decision intelligence, context engineering, and governance-minded delivery.";
}

function composeSystemsMindsetReply(subIntent = "thinking_model") {
  if (subIntent === "prompt_injection_defense") {
    return "Untrusted Content -> Sanitization and Classification -> Retrieval Boundary -> LLM -> Policy Gate -> Scoped Tools. Joz would treat the Telegram channel as external data, not instructions. System policy stays outside the model, system instructions stay separate from retrieved content, and the platform must block tool execution unless deterministic policy checks pass. Tool access must use least privilege and allowlisted interfaces, inputs must pass schema validation, the agent should stay sandboxed, secrets must never appear in the context window, and high-risk actions must stop for human approval.";
  }

  return "Joz thinks in systems before features: isolate signal from noise, map feedback loops, make decision paths explicit, and keep human accountability in the loop. In AI work, Joz biases toward trust, source provenance, verification, governance, and interfaces that turn ambiguity into clear action.";
}

function composeSkillsReply(subIntent = "capabilities_overview") {
  if (subIntent === "safe_architecture_design") {
    return "Joz would design an AI platform to fail safely by separating decision-making, policy, execution, and verification so one bad model output cannot directly cause uncontrolled change. The control flow is: Policy Gate -> Approval Step -> Execution -> Verification -> Rollback or Escalation. In practice that means API boundary -> typed orchestration state -> scoped tools -> deterministic policy gates -> idempotent execution -> post-action verification -> audit trail and escalation. High-risk actions should require human approval, retries must be bounded, external dependencies need timeouts and circuit breakers, and authoritative state must stay in durable systems rather than inside the model. The goal is graceful degradation: if the model is wrong or a dependency fails, the platform slows down, stops, or escalates instead of silently taking unsafe action.";
  }

  if (subIntent === "financial_intelligence_platform_architecture") {
    return "Joz would design it as a layered financial intelligence platform: Client and External APIs -> API Gateway -> Stateless FastAPI Services -> Orchestrator Agent -> Specialist Agents -> Policy, Risk, and Verification Gates -> Execution and Data Services -> Event Streaming -> Durable Storage -> Observability and Security Controls. APIs are the controlled entry points for market data, portfolio data, user commands, admin workflows, and external integrations. Agents are separated by responsibility such as research, signal generation, portfolio reasoning, risk review, execution planning, and post-trade verification so each step has a clear boundary. Risk sits outside the agent as deterministic policy, exposure checks, limits, approvals, and circuit breakers before any high-impact action. Verification confirms that expected state changes actually happened by reconciling execution events, portfolio state, balances, and downstream records against the authoritative source of truth. Memory stores task state, prior decisions, retrieved research, and working context, but authoritative financial state stays in durable systems rather than agent memory. Databases should separate concerns: PostgreSQL for durable workflow and portfolio state, pgvector or search indexes for retrieval, Redis for cache and short-lived coordination, and object storage for documents and event archives. Event streaming carries market updates, portfolio changes, execution events, telemetry, and workflow notifications asynchronously so services stay decoupled and replay is possible. Infrastructure should start with containers, stateless services, worker pools, queues, and Kubernetes only when scaling and isolation justify it. Observability must cover traces, metrics, logs, workflow history, model calls, tool usage, cost, latency, and verification failures. Security must enforce least privilege, workload identity, secret isolation, signed actions, audit trails, human approval for high-risk operations, and strict separation between untrusted external content and system policy.";
  }

  if (subIntent === "architecture_reasoning") {
    return "Joz would design this as a governed layered platform, not a single prompt loop: API intake -> typed orchestration state -> durable workflow engine for retries, approvals, timers, and recovery -> retrieval and ACL boundary -> specialist agents and scoped tools -> policy and risk gates -> controlled execution -> verification and reconciliation -> observability. Memory should hold conversation, task, and working context while authoritative business state remains in durable systems. Retrieval should preserve provenance and permissions, and verification should compare expected versus actual state before the workflow completes. The first step is still to identify the system boundary, authoritative state, control points, execution path, risk gates, and bottleneck before selecting tools or topology.";
  }

  if (subIntent === "langgraph_temporal_architecture") {
    return "LangGraph handles the reasoning graph: agent state, branches, loops, handoffs, and tool-selection flow. Temporal handles durable workflow execution: retries, timers, approvals, crash recovery, and long-running business actions. Joz would use both when agent reasoning triggers high-value actions that must survive failure and resume safely. Using only LangGraph is weaker for durable business execution, and using only Temporal does not provide agent reasoning semantics. The pattern is: LangGraph decides, Temporal persists and recovers.";
  }

  if (subIntent === "organizational_ownership_layer") {
    return "Joz would design the organisational awareness layer as an ownership-inference system, not a simple lookup table. Connectors ingest GitHub, Slack, tickets, docs, architecture records, and on-call data; processing extracts entities, services, domains, approvers, historical decisions, and recency; the knowledge layer stores competing ownership claims with confidence and provenance; and ACL-aware retrieval resolves the likely owner from code boundaries, incident history, runbooks, approver patterns, and org metadata. If two teams conflict, the system should return ranked ownership candidates with evidence, confidence, freshness, and escalation rules rather than pretending certainty.";
  }

  if (subIntent === "scale_fastapi_architecture") {
    return "Load Balancer -> Stateless FastAPI Replicas -> Queue and Workers -> Redis -> PostgreSQL -> Observability. Joz would first identify the bottleneck before scaling, because at 100,000 users the constraint may be CPU, connection pressure, queue buildup, cache miss rate, or database contention. The API layer should stay stateless for horizontal scaling, reads that repeat should use caching, slow or bursty work should move to async workers and queues, Redis should handle short-lived coordination and cache, PostgreSQL should remain the durable source of truth with database scaling where needed, and rate limits plus backpressure should protect the system. Kubernetes and autoscaling help only after the service boundaries and bottleneck visibility are clear.";
  }

  if (subIntent === "verification_architecture") {
    return "Proposal -> Risk and Policy -> Execution -> Event Capture -> Verification -> Reconciliation. Joz would verify this through an execution-to-state reconciliation architecture, not by trusting the agent's claim. Define the expected state and expected delta first, send the trade through a controlled execution service with an execution ID and idempotent order keys, capture order and fill events, re-read the ledger or authoritative portfolio source of truth, then compare expected versus actual post-trade state across holdings, cash, fees, and margin. The design must handle partial fills, bounded retries, retry and reconciliation logic, immutable audit trails, and human escalation before treating the portfolio as verified.";
  }

  if (subIntent === "single_agent_tradeoffs") {
    return "Joz would start with one orchestrator agent, not many. For an autonomous trading platform, a single agent is easier to verify, cheaper to run, simpler to observe, and less likely to hide coordination failures. He would switch to multiple agents only when research, portfolio reasoning, risk, compliance, execution, and verification have clearly separate responsibilities, tools, latency needs, or approval boundaries. The tradeoff is specialization and isolation versus higher coordination overhead, more state-sync risk, duplicated reasoning, deadlocks, and more failure paths. In practice the safe pattern is supervisor plus typed shared state plus explicit policy, risk gates, and verification outside the agents themselves.";
  }

  if (subIntent === "agent_scope_tradeoffs") {
    return "Joz would keep an agent simple while one worker can still hold the state, tools, and decision path clearly enough to stay observable and easy to verify. He would turn it into a broader system only when responsibilities split naturally, such as planning versus execution, research versus verification, or low-risk assistance versus high-risk action. Multiple agents make sense when boundaries, tools, latency, and approval paths are genuinely different; otherwise they often add coordination overhead, state-sync bugs, and hidden failure modes. The practical rule is: start with one orchestrator, add specialist workers only when the separation reduces risk or complexity more than it increases it.";
  }

  if (subIntent === "singapore_market_fit") {
    return "Joz is strong for Singapore-market roles because the proof is already Singapore-specific and enterprise-scale. At Maybank-Ageas Etiqa, Joz helped drive 20x digital sales growth through conversational and ML-led UX. At Manulife, Joz established a Lean ML UX practice across 11 APAC markets and launched first-in-market ML UX solutions from Singapore. At Mediacorp, Joz contributed to 30x audience growth and built a global experience language across 30+ products. Joz also re-engineered Singapore Stock Exchange portals and developed Apple/Pixar-adjacent Python USD(z) and computer-vision workflows in Singapore.";
  }

  if (subIntent === "ui_ux_css_accessibility") {
    return "Joz is strong in CSS, design systems, motion, and accessibility because the work shows both interface judgment and production execution. At Mediacorp, Joz built a global experience language across 30+ products, which is strong proof of design-systems thinking. At Leo Burnett/Publicis, Joz reduced handoff friction by 70% through code-based prototyping, which supports frontend and implementation depth. At Maybank, Joz helped drive 20x digital sales growth through conversational and ML-led UX, showing that interface quality translated into measurable business impact. At Erste Bank, Joz worked on engineering and accessibility at 16M+ customer scale, which is the clearest accessibility proof.";
  }

  if (subIntent === "proof_backed_strengths") {
    return "Joz is strongest where AI, product, and execution have to work together under real constraints. The core strengths are agentic AI architecture, multimodal and spatial UX, and end-to-end product engineering. The proof is concrete: MarketClue financial AI agents with live portfolio context, 20x digital sales growth at Maybank, a Lean ML UX practice across 11 Manulife markets, 30x audience growth at Mediacorp, 16M+ customer-scale engineering at Erste Bank, and spatial AI work for Versace/SOA and ArtKorero in Dubai. The differentiator is not a long tool list. It is the ability to turn complex systems into working intelligent products people can trust, use, and scale.";
  }

  if (subIntent === "technical_stack") {
    return "Joz's core stack spans agentic AI architecture and product engineering: LLM orchestration, RAG, embeddings, vector search, knowledge graphs, agent memory, ACL-aware retrieval, verification, observability, Python, FastAPI, PostgreSQL, pgvector, Redis, WebGL, spatial computing, and computer vision. That stack matters because it supports enterprise retrieval, multimodal interfaces, and measurable product delivery rather than existing as tooling in isolation.";
  }

  if (subIntent === "agentic_architecture_approach") {
    return "Joz's agentic architecture is built around a clear separation of responsibilities: API intake, orchestration, specialist agents, tool and service layers, memory and retrieval, policy and risk gates, execution services, and verification. He prefers a thin orchestrator with typed state, scoped tools, deterministic approval boundaries, and verification outside the agent so the system can scale, stay observable, and fail safely. He uses agentic AI where multi-step reasoning, tool use, workflow coordination, and controlled execution create more value than a single prompt-response model. In practice that means retrieval for context, workflows for coordination, durable state outside the model, policy before action, and post-action verification against authoritative systems rather than trusting the model's own claim.";
  }

  if (subIntent === "agentic_architecture_why") {
    return "Joz uses agentic AI when a problem needs more than one-shot generation: multi-step reasoning, tool use, workflow coordination, approval boundaries, and verification against real systems. The point is not to make the model feel autonomous. The point is to turn intelligence into controlled execution that can retrieve context, call tools, follow policy, and prove what actually happened. He uses it where that structure creates better decisions, safer actions, and stronger operational leverage than a single prompt-response flow.";
  }

  if (subIntent === "capabilities_overview") {
    return "Joz's deepest skills are in agentic AI architecture, decision intelligence, context engineering, multimodal and spatial interaction, and enterprise product engineering. The technical layer includes retrieval, orchestration, memory, verification, observability, Python backend systems, and 3D or spatial interface delivery. The differentiator is combining that technical depth with enterprise architecture, human adoption, and measurable outcomes across Maybank, Manulife, Mediacorp, Erste Bank, Dubai Future Foundation, and MarketClue.";
  }

  return "Joz's core skills combine agentic AI architecture, orchestration, retrieval systems, signal reasoning, and production-grade delivery in enterprise environments.";
}

function composeMixedReply({ worldReply }) {
  const suffix =
    "If you want the human proof behind this layer, ask about Joz's Business Value, Systems Mindset, or Skills.";
  return [worldReply || "", suffix].filter(Boolean).join(" ");
}

function detectProgrammeQuery(clean = "") {
  if (!clean) return false;
  return [
    "what did joz do at",
    "what did joz do for",
    "what projects did joz do at",
    "what private banking work did joz do at",
    "what cms projects did joz do at",
    "what healthcare platforms did joz work on",
  ].some((pattern) => clean.includes(pattern));
}

function buildUnknownDefinitionGapReply(clean = "") {
  const normalized = normalizeText(clean).replace(/[?!.,]+$/g, "");
  if (normalized === "what is not in joz's knowledge base" || normalized === "what is not in jozs knowledge base") {
    return "The current Joz knowledge base does not define arbitrary external entities. Ask about Joz's background, business value, systems mindset, skills, infrastructure, or agent architecture.";
  }
  const term = extractDefinitionTerm(clean);
  if (!term) return null;
  return `${term} is not in the current Joz knowledge base. Ask about Joz's background, business value, systems mindset, skills, infrastructure, or agent architecture.`;
}

function buildAmbiguousFollowUpReply(clean = "") {
  if (!clean) return null;
  const normalized = String(clean).replace(/[?!.,]+$/g, "");

  const ambiguousShortFollowUps = [
    "how does joz do it",
    "how would joz do it",
    "why does joz do it",
    "why would joz do it",
    "what does joz mean by that",
    "how does he do it",
    "how would he do it",
    "why does he do it",
    "why would he do it",
    "how does joz do that",
    "how would joz do that",
    "why does joz do that",
    "why would joz do that",
    "how would he do that",
    "why does he do that",
  ];

  if (includesAny(normalized, ambiguousShortFollowUps)) {
    return "That follow-up is too ambiguous on its own. Ask the same question with the topic included, for example: How does Joz architect agentic AI? or How would Joz design that workflow?";
  }

  return null;
}

function isAmbiguousFollowUp(clean = "") {
  return Boolean(buildAmbiguousFollowUpReply(clean));
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function normalizeRetrievedDocuments(retrievedDocuments = []) {
  return Array.isArray(retrievedDocuments)
    ? retrievedDocuments.filter(Boolean).map((doc) => ({
        ...doc,
        metadata: doc?.metadata || {},
      }))
    : [];
}

function takeLeadingSentences(text = "", count = 2) {
  const sentences = String(text || "")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!sentences.length) return "";
  return sentences.slice(0, count).join(" ");
}

function extractRetrievedEvidencePoint(doc = {}) {
  const metadata = doc?.metadata || {};
  const proofPoints = normalizeList(metadata.proof_points);
  const claims = normalizeList(metadata.claims);
  const summary = String(doc.summary || "").trim();

  return proofPoints[0] || claims[0] || summary || "";
}

function buildRetrievedDocumentBrief(doc = {}) {
  const metadata = doc?.metadata || {};
  return {
    title: doc?.title || null,
    category: doc?.category || null,
    slug: metadata.slug || null,
    lane: metadata.lane || null,
    companies: normalizeList(metadata.companies).slice(0, 5),
    tags: normalizeList(metadata.tags).slice(0, 6),
    claims: normalizeList(metadata.claims).slice(0, 2),
    proofPoints: normalizeList(metadata.proof_points).slice(0, 2),
    verificationStatus:
      metadata.verification_status || metadata.verification?.status || null,
  };
}

function buildEvidenceSourceLabel(documents = []) {
  const labels = documents
    .map((doc) => doc?.title || doc?.metadata?.slug || null)
    .filter(Boolean)
    .slice(0, 2);

  return labels.join(" + ");
}

function selectEvidenceDocumentsForRoute(route = {}, retrievedDocuments = []) {
  const normalizedDocs = normalizeRetrievedDocuments(retrievedDocuments);
  if (!normalizedDocs.length) return [];

  const preferredCategoriesByRoute = {
    business_need: new Set(["business_need", "proof", "faq", "skills"]),
    skills: new Set(["skills", "proof", "faq", "bio"]),
    systems_mindset: new Set(["systems_mindset", "proof", "skills", "faq"]),
  };
  const preferredCategories =
    preferredCategoriesByRoute[route?.selectedRoute] || new Set();

  const categorized = normalizedDocs.filter((doc) =>
    preferredCategories.size ? preferredCategories.has(doc?.category) : true
  );

  return (categorized.length ? categorized : normalizedDocs).slice(0, 3);
}

function buildEvidenceBackedRouteReply({
  route = {},
  baseReply = "",
  input = "",
  retrievedDocuments = [],
} = {}) {
  if (!["business_need", "skills", "systems_mindset"].includes(route?.selectedRoute)) {
    return null;
  }

  if (
    route?.selectedRoute === "business_need" &&
    [
      "efficiency",
      "growth",
      "roi",
      "processes",
      "function_processes",
      "functions",
      "operating_model",
      "decision_support",
    ].includes(route?.detectedSubIntent)
  ) {
    return null;
  }

  if (
    route?.selectedRoute === "skills" &&
    [
      "financial_intelligence_platform_architecture",
      "architecture_reasoning",
      "safe_architecture_design",
      "agent_scope_tradeoffs",
      "agentic_architecture_why",
      "single_agent_tradeoffs",
      "verification_architecture",
      "scale_fastapi_architecture",
      "organizational_ownership_layer",
      "langgraph_temporal_architecture",
    ].includes(route?.detectedSubIntent)
  ) {
    return null;
  }

  if (route?.selectedRoute === "systems_mindset" && route?.detectedSubIntent === "prompt_injection_defense") {
    return null;
  }

  const evidenceDocs = selectEvidenceDocumentsForRoute(route, retrievedDocuments);
  if (!evidenceDocs.length) return null;
  const cleanInput = normalizeText(input);
  const specialRetrievedKnowledgeReply = buildRetrievedKnowledgeReply(input, evidenceDocs);
  const definitionLikeQuery =
    /^(what is|what's|how does|how should|why must|what role|when would|can agents|what actions|how are|how would)/.test(
      cleanInput
    );

  if (route?.selectedRoute === "business_need" && route?.detectedSubIntent === "business_value_definition") {
    return {
      reply:
        "Business value is measurable improvement in revenue, margin, cost, speed, risk, or decision quality. For Joz, AI matters only when it improves operations, management leverage, or commercial outcomes.",
      answerSource: buildEvidenceSourceLabel(evidenceDocs),
      composer: "buildEvidenceBackedRouteReply",
      evidenceDocs,
    };
  }

  if (
    specialRetrievedKnowledgeReply &&
    includesAny(cleanInput, [
      "what is an agent",
      "what is mcp",
      "what is fastapi",
      "what is langsmith",
      "what is vault",
      "what is kms",
      "how does joz defend against prompt injection",
      "permissions be enforced before retrieval",
      "permissions enforced before retrieval",
      "what role does a knowledge graph play",
      "when would joz use python versus golang",
      "difference between an agent and an api",
      "difference between an agent and a model",
      "can agents deploy directly to production",
      "what actions should require human approval",
      "how should an ai agent interact with blockchain",
    ])
  ) {
    return {
      reply: specialRetrievedKnowledgeReply,
      answerSource: buildEvidenceSourceLabel(evidenceDocs),
      composer: "buildEvidenceBackedRouteReply",
      evidenceDocs,
    };
  }

  if (definitionLikeQuery && evidenceDocs[0]?.metadata?.canonical_record) {
    const primary = takeLeadingSentences(
      evidenceDocs[0].body || evidenceDocs[0].summary || "",
      2
    );
    const secondary =
      cleanInput.startsWith("how would") && evidenceDocs[1]
        ? takeLeadingSentences(evidenceDocs[1].body || evidenceDocs[1].summary || "", 1)
        : "";

    if (primary) {
      return {
        reply: [primary, secondary].filter(Boolean).join(" ").trim(),
        answerSource: buildEvidenceSourceLabel(evidenceDocs),
        composer: "buildEvidenceBackedRouteReply",
        evidenceDocs,
      };
    }
  }

  const leadSentenceCount = route.selectedRoute === "systems_mindset" ? 1 : 2;
  const lead = takeLeadingSentences(baseReply, leadSentenceCount);
  const evidencePoints = [
    ...new Set(
      evidenceDocs
        .map((doc) => extractRetrievedEvidencePoint(doc))
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 2);

  if (!lead || !evidencePoints.length) return null;

  const bridge =
    route.selectedRoute === "systems_mindset"
      ? "That discipline shows up in"
      : "Proof:";
  const proof = evidencePoints.join(" ");

  return {
    reply: `${lead} ${bridge} ${proof}`.trim(),
    answerSource: buildEvidenceSourceLabel(evidenceDocs),
    composer: "buildEvidenceBackedRouteReply",
    evidenceDocs,
  };
}

function buildProgrammeRecordReply(record = {}) {
  const metadata = record?.metadata || {};
  const companies = normalizeList(metadata.companies);
  const projects = normalizeList(metadata.projects);
  const summary = String(record.summary || "").trim();
  const body = String(record.body || "").trim();
  const firstParagraph = body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)[0] || "";

  const companyText = companies.length ? ` for ${companies.join(", ")}` : "";
  const projectText = projects.length
    ? ` Included projects: ${projects.join("; ")}.`
    : "";
  const summaryText = summary || firstParagraph || "This programme record captures the main work, themes, and delivery context.";

  return `${summaryText}${projectText} This is the grouped programme record${companyText}, so it should be read as one retrieval unit rather than a claim that every sub-project produced the same outcome.`.trim();
}

function mapRouteToIntentMode(route) {
  if (route === "business_need") return "business_need";
  if (route === "systems_mindset") return "systems_mindset";
  if (route === "skills") return "skills";
  if (route === "booking") return "booking";
  return "skills";
}

function detectCanonicalWorldConcept(clean) {
  const isDefinitionPrompt =
    /^(what is|what's|explain|tell me about|define)\b/.test(clean) ||
    clean === "gold pill" ||
    clean === "pill" ||
    clean === "capsule" ||
    clean === "neomaxxing" ||
    clean === "neomaxx" ||
    clean === "neomaxx." ||
    clean === "neo maxx" ||
    clean === "neo/maxx" ||
    clean === "neo maxx." ||
    clean === "neo/maxx." ||
    clean === "neomaxx?" ||
    clean === "neo maxx?" ||
    clean === "neo/maxx?" ||
    clean === "neo maxx" ||
    clean === "neo/maxx" ||
    clean === "maxx";

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["gold pill", " pill", "pill ", "capsule"])
  ) {
    return { detectedSubIntent: "gold_pill", detectedConcept: "gold_pill" };
  }

  if (
    isDefinitionPrompt &&
    includesAny(clean, ["neomaxxing", "neomaxx", "neo/maxx", "neo maxx", "neomaxx concept", "maxx concept", "what is maxx", "define maxx", "tell me about maxx", "explain maxx"])
  ) {
    return { detectedSubIntent: "neo_maxx", detectedConcept: "neo_maxx" };
  }

  return null;
}

function detectIdentityProfile(clean) {
  if (
    includesAny(clean, [
      /^who is joz\b/,
      "tell me about joz",
      "introduce joz",
      "who is behind meetjoz",
      "who is behind meet joz",
      "who created neo/maxx",
      "who created neo maxx",
      "who built this experience",
      "who built meetjoz",
      "who built meet joz",
      "who created this experience",
    ])
  ) {
    return { detectedSubIntent: "overview", detectedConcept: "joz_identity" };
  }

  return null;
}

function detectFactualProfile(clean) {
  if (
    includesAny(clean, [
      "where did joz study",
      "where did he study",
      "where did joz go to school",
      "what did joz study",
      "education",
      "studied",
      "university",
      "school",
    ])
  ) {
    return { detectedSubIntent: "education", detectedConcept: "education" };
  }

  if (includesAny(clean, ["what degree does joz have", "what is joz's degree", "what is jozs degree", "what degree", "msc"])) {
    return { detectedSubIntent: "degree", detectedConcept: "degree" };
  }

  if (
    includesAny(clean, [
      "what certifications does joz have",
      "certification",
      "certifications",
      "mit/ideo",
      "hpi",
      "wwdc",
      "apple design labs",
    ])
  ) {
    return { detectedSubIntent: "certifications", detectedConcept: "certifications" };
  }

  if (includesAny(clean, ["where is joz based", "where is joz located", "location", "based in"])) {
    return { detectedSubIntent: "location", detectedConcept: "location" };
  }

  if (
    includesAny(clean, [
      "how can i contact joz",
      "contact joz",
      "email joz",
      "phone joz",
      "reach joz",
      "contact details",
    ])
  ) {
    return { detectedSubIntent: "contact", detectedConcept: "contact" };
  }

  if (
    includesAny(clean, [
      "nationality",
      "citizenship",
      "work authorization",
      "singapore status",
      /\bpep\b/,
      /\bep\b/,
    ])
  ) {
    return { detectedSubIntent: "nationality", detectedConcept: "nationality" };
  }

  if (includesAny(clean, ["availability", "start date", "notice period", "when can joz start"])) {
    return { detectedSubIntent: "availability", detectedConcept: "availability" };
  }

  if (includesAny(clean, ["years of experience", "how many years", "experience overall", "years in ai"])) {
    return { detectedSubIntent: "experience", detectedConcept: "experience" };
  }

  return null;
}

function detectRecruiterOperational(clean) {
  const explicitResidence = includesAny(clean, [
    "where does joz currently live",
    "what is joz's current residence",
    "what is jozs current residence",
    "what is joz's legal address",
    "what is jozs legal address",
  ]);
  if (explicitResidence) {
    return {
      detectedIntent: "recruiter_location",
      detectedSubIntent: "residence",
      detectedConcept: "recruiter_location",
    };
  }

  if (
    includesAny(clean, [
      "does joz have an ep",
      "does joz have a pep",
      "does joz have a singapore work pass",
      "does joz need singapore sponsorship",
      "can joz legally work in singapore",
      "what is joz's visa status",
      "what is jozs visa status",
      "does joz have a singapore ep",
      "visa",
      "work pass",
      "authorization",
      "eligible to work",
      /\bep\b/,
      /\bpep\b/,
    ])
  ) {
    return {
      detectedIntent: "recruiter_work_authorization",
      detectedSubIntent: includesAny(clean, ["singapore", "work pass", /\bep\b/, /\bpep\b/])
        ? "singapore_specific"
        : "work_authorization",
      detectedConcept: "recruiter_work_authorization",
    };
  }

  if (
    includesAny(clean, [
      "what is joz's notice period",
      "what is jozs notice period",
      "what is joz's earliest start date",
      "what is jozs earliest start date",
      "notice period",
      "earliest start date",
      "joining date",
      "when can joz join",
    ])
  ) {
    return {
      detectedIntent: "recruiter_notice_period",
      detectedSubIntent: "notice_period",
      detectedConcept: "recruiter_notice_period",
    };
  }

  if (
    includesAny(clean, [
      "how can i contact joz",
      "call joz",
      "email joz",
      "what is joz's phone number",
      "what is jozs phone number",
      "what is joz's email",
      "what is jozs email",
      "contact",
      "phone",
      "email",
      "reach joz",
    ])
  ) {
    return {
      detectedIntent: "recruiter_contact",
      detectedSubIntent: "contact",
      detectedConcept: "recruiter_contact",
    };
  }

  if (
    includesAny(clean, [
      "what salary does joz want",
      "what are joz's salary expectations",
      "what are jozs salary expectations",
      "what compensation is joz looking for",
      "what salary range is joz targeting",
      "what compensation range is joz targeting",
      "salary in singapore",
      "compensation in singapore",
      "sgd",
      "what package does joz expect",
      "what is joz's rate",
      "what is jozs rate",
      "how much does joz charge",
    ])
      || includesWholeWord(clean, ["salary", "compensation", "package", "rate", "pay", "expectations"])
  ) {
    return {
      detectedIntent: "recruiter_compensation",
      detectedSubIntent: includesAny(clean, ["singapore", "sgd"]) ? "singapore_specific" : "compensation",
      detectedConcept: "recruiter_compensation",
    };
  }

  if (
    includesAny(clean, [
      "is joz available",
      "what is joz's availability",
      "what is jozs availability",
      "can joz start soon",
      "is joz open to opportunities",
      "available",
      "availability",
      "open to opportunities",
      "start soon",
    ])
  ) {
    return {
      detectedIntent: "recruiter_availability",
      detectedSubIntent: "availability",
      detectedConcept: "recruiter_availability",
    };
  }

  if (
    includesAny(clean, [
      "is joz open to relocation",
      "is joz available for singapore",
      "is joz open to relocating to singapore",
      "is joz open to singapore relocation",
      "is joz open to dubai",
      "is joz interested in zurich",
      "relocate",
      "relocation",
    ])
  ) {
    return {
      detectedIntent: "recruiter_relocation",
      detectedSubIntent: "relocation",
      detectedConcept: "recruiter_relocation",
    };
  }

  if (
    includesAny(clean, [
      "remote or hybrid",
      "remote, hybrid, or onsite",
      "remote hybrid or onsite",
      "working model",
      "remote work",
      "hybrid",
      "on-site",
      "onsite",
    ])
  ) {
    return {
      detectedIntent: "recruiter_working_model",
      detectedSubIntent: "working_model",
      detectedConcept: "recruiter_working_model",
    };
  }

  if (
    includesAny(clean, [
      "why is joz a fit for singapore",
      "why is joz relevant for singapore",
      "what is joz's strongest singapore proof",
      "what is jozs strongest singapore proof",
      "is joz a fit for singapore recruiters",
      "singapore recruiter fit",
    ])
  ) {
    return {
      detectedIntent: "recruiter_singapore_fit",
      detectedSubIntent: "singapore_fit",
      detectedConcept: "recruiter_singapore_fit",
    };
  }

  if (
    includesAny(clean, [
      "can we hire joz",
      "how do we discuss a role with joz",
      "hiring",
      "opportunity",
      "discuss a role",
    ])
  ) {
    return {
      detectedIntent: "recruiter_hiring",
      detectedSubIntent: "hiring",
      detectedConcept: "recruiter_hiring",
    };
  }

  if (
    includesAny(clean, [
      "where is joz located",
      "where is joz based",
      "where does joz operate",
      "what markets does joz work across",
      "located",
      "based",
      "operates",
      "markets",
      "regions",
    ])
  ) {
    return {
      detectedIntent: "recruiter_location",
      detectedSubIntent: "positioning",
      detectedConcept: "recruiter_location",
    };
  }

  return null;
}

function detectBusinessNeed(clean) {
  if (
    includesAny(clean, [
      "i am a business owner with bad data",
      "i'm a business owner with bad data",
      "business owner with bad data",
      "business owner with slow decisions",
    ]) &&
    includesAny(clean, ["slow decisions", "what should i do first", "where should we start"])
  ) {
    return { detectedSubIntent: "business_diagnosis", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "autonomous execution layer",
      "organisational knowledge improve autonomous execution",
      "organizational knowledge improve autonomous execution",
      "how would joz build an agentic platform",
    ])
  ) {
    return { detectedSubIntent: "operating_model", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "process redesign",
      "redesign business processes",
      "redesign processes",
      "business processes",
    ]) &&
    includesAny(clean, [
      "finance",
      "erp",
      "accounting",
      /\bhr\b/,
      "marketing",
      "operations",
    ])
  ) {
    return { detectedSubIntent: "function_processes", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "what is business value",
      "define business value",
      "what does business value mean",
      "meaning of business value",
    ])
  ) {
    return { detectedSubIntent: "business_value_definition", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "efficiency",
      "lower cost",
      "cost reduction",
      "faster execution",
      "operational leverage",
      "productivity gains",
    ])
  ) {
    return { detectedSubIntent: "efficiency", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "processes",
      "process redesign",
      "workflow redesign",
      "operating workflows",
      "manual handoffs",
    ])
  ) {
    return { detectedSubIntent: "processes", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "growth",
      "scaling",
      "scale the business",
      "commercial performance",
      "revenue growth",
    ])
  ) {
    return { detectedSubIntent: "growth", detectedConcept: "business_value" };
  }

  if (includesAny(clean, ["where is the roi", "roi"])) {
    return { detectedSubIntent: "roi", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "decision support",
      "better signal",
      "prioritization",
      "prioritisation",
      "executive clarity",
      "judgment",
      "clarity",
    ])
  ) {
    return { detectedSubIntent: "decision_support", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "functions",
      "finance",
      "erp",
      "accounting",
      /\bhr\b/,
      "marketing",
      "operations",
      "sales",
      "by function",
    ])
  ) {
    return { detectedSubIntent: "functions", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "operating model",
      "ownership",
      "governance",
      "workflow ownership",
      "governance and execution",
      "embed joz",
      "embed ai",
    ]) &&
    !includesAny(clean, [
      "system architecture",
      "technical architecture",
      "architecture behind",
      "underlying architecture",
    ])
  ) {
    return { detectedSubIntent: "operating_model", detectedConcept: "business_value" };
  }

  if (
    includesAny(clean, [
      "why should we hire joz",
      "why should a hiring manager hire joz",
      "why would a hiring manager hire joz",
      "hiring manager hire joz",
      "why hire joz",
      "business value",
      "where is the roi",
      "what problems can joz solve",
      "why is joz relevant now",
      "why now",
      "measurable outcomes",
      "business outcomes",
      "what value does joz bring",
    ])
  ) {
    return { detectedSubIntent: "hire_value", detectedConcept: "business_value" };
  }

  return null;
}

function detectSystemsMindset(clean) {
  if (
    includesAny(clean, [
      "what should always require human approval",
      "always require human approval",
      "require human approval",
      "deploy code themselves",
      "deploy code itself",
      "let agents deploy code themselves",
      "something stupid in production",
    ])
  ) {
    return { detectedSubIntent: "thinking_model", detectedConcept: "systems_mindset" };
  }

  if (
    includesAny(clean, [
      "prompt injection",
      "malicious instructions",
      "telegram channel",
      "untrusted input",
    ]) &&
    includesAny(clean, [
      "prevent the agent from executing",
      "prevent the agent from",
      "how would joz prevent",
      "executing malicious instructions",
    ])
  ) {
    return { detectedSubIntent: "prompt_injection_defense", detectedConcept: "systems_mindset" };
  }

  if (
    includesAny(clean, [
      "how does joz think",
      "systems mindset",
      "systems thinking",
      "decision-making",
      "decision making",
      "signal over noise",
      "feedback loops",
      "governance mindset",
      "agentic ai judgment",
      "risk and verification",
      "prompt injection",
      "unauthorized information",
      "unauthorised information",
      "human approval",
      "high-risk actions",
      "high risk actions",
      "protected signing keys",
      "signing keys protected",
      "verify autonomous code changes",
      "verification fails",
      "docker sandboxes",
      "deploy directly to production",
      "should an ai agent deploy directly to production",
      "production deployment",
      "merge their own pull requests",
    ])
  ) {
    return { detectedSubIntent: "thinking_model", detectedConcept: "systems_mindset" };
  }

  return null;
}

function detectSkills(clean) {
  if (
    includesAny(clean, [
      "design a governed agentic ai platform",
      "durable workflows, retrieval, memory, and verification",
    ]) &&
    includesAny(clean, ["platform", "architecture", "verification", "workflows"])
  ) {
    return { detectedSubIntent: "architecture_reasoning", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "how would joz design an ai platform that can fail safely",
      "design an ai platform that can fail safely",
      "stop an ai from doing something stupid in production",
      "doing something stupid in production",
      "approvals, escalation, and rollback",
      "approvals escalation and rollback",
      "fail safely",
      "fail safe",
      "fail-safe",
      "fail safely architecture",
    ]) &&
    includesAny(clean, [
      "platform",
      "architecture",
      "agent",
      "ai",
      "system",
      "approval",
      "rollback",
    ])
  ) {
    return { detectedSubIntent: "safe_architecture_design", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "multiple agents instead of one",
      "one brain or many brains",
      "one brain or many",
      "many brains",
      "use multiple agents instead of one",
      "when should an agent stay simple",
      "when should it become a system",
      "agent stay simple",
      "become a system",
      "single agent versus a system",
      "one agent versus many",
    ])
  ) {
    return { detectedSubIntent: "agent_scope_tradeoffs", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "why would joz use langgraph and temporal together",
      "use langgraph and temporal together",
      "langgraph and temporal together",
      "why not use only one",
    ]) &&
    includesAny(clean, ["langgraph", "temporal"])
  ) {
    return { detectedSubIntent: "langgraph_temporal_architecture", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "organisational awareness layer",
      "organizational awareness layer",
      "determine ownership automatically",
      "ownership automatically",
      "ownership inference",
    ]) &&
    includesAny(clean, [
      "two teams disagree",
      "system ownership",
      "ownership",
    ])
  ) {
    return { detectedSubIntent: "organizational_ownership_layer", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "fastapi service currently handles 100 users",
      "fastapi service from 100 users to 100,000",
      "fastapi service from 100 users to 100000",
      "from 100 users to 100,000",
      "from 100 users to 100000",
      "needs to handle 100,000 users",
      "needs to handle 100000 users",
      "scale the architecture",
    ]) &&
    includesAny(clean, ["fastapi", "100,000 users", "100000 users"])
  ) {
    return { detectedSubIntent: "scale_fastapi_architecture", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "design a verification architecture",
      "verification architecture",
      "design a verification layer",
      "verification layer",
      "finished the job",
      "check that it really did",
      "really did",
      "agents that can take actions",
      "agent that can take actions",
      "agents can take actions",
      "agent can take actions",
      "guarantees the portfolio actually changed",
      "portfolio actually changed as expected",
      "post-trade state",
      "post trade state",
      "expected delta",
      "actual holdings",
      "execution receipt",
      "reconciliation architecture",
    ]) &&
    includesAny(clean, [
      "portfolio",
      "sell 20%",
      "selling 20%",
      "agent proposes",
      "agent",
      "agents",
      "actions",
      "trade",
      "holdings",
    ])
  ) {
    return { detectedSubIntent: "verification_architecture", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "single agent or multiple agents",
      "single agent or multi agent",
      "single-agent or multi-agent",
      "single agent versus multiple agents",
      "single agent vs multiple agents",
      "single agent vs multi agent",
      "single-agent vs multi-agent",
      "multiple agents",
      "multi-agent",
    ]) &&
    includesAny(clean, [
      "tradeoffs",
      "trade-offs",
      "architecture",
      "failure modes",
      "risks",
      "switch from one approach to the other",
      "when he would switch",
      "when would joz switch",
      "autonomous trading platform",
      "trading platform",
    ])
  ) {
    return { detectedSubIntent: "single_agent_tradeoffs", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "design an ai-native financial intelligence platform from scratch",
      "design a financial intelligence platform from scratch",
      "financial intelligence platform from scratch",
      "include: apis",
      "include: agents",
      "include: risk",
      "include: verification",
      "include: memory",
      "include: databases",
      "include: event streaming",
      "include: infrastructure",
      "include: observability",
      "include: security",
    ]) &&
    includesAny(clean, [
      "financial intelligence platform",
      "from scratch",
      "apis",
      "agents",
      "risk",
      "verification",
      "memory",
      "databases",
      "event streaming",
      "observability",
      "security",
    ])
  ) {
    return { detectedSubIntent: "financial_intelligence_platform_architecture", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "what agentic architecture does joz do",
      "what agentic architecture does joz use",
      "what agentic architecture does joz build",
      "what is joz's agent architecture approach",
      "what is jozs agent architecture approach",
      "what agent architecture does joz do",
      "what agent architecture does joz use",
      "what agent architecture does joz build",
      "how does joz architect agentic ai",
      "how does joz do agentic ai architecture",
      "how does joz build agentic ai",
      "how would joz structure an agent system",
      "what architecture pattern would joz use for agents in production",
      "how does joz separate policy from execution",
      "why keep policy outside the agent",
      "why keep verification outside the agent",
      "why separate policy from execution",
      "joz agentic architecture",
      "joz agent architecture",
    ])
  ) {
    return { detectedSubIntent: "agentic_architecture_approach", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "why does joz do agentic ai",
      "why does joz use agentic ai",
      "why does joz build agentic ai",
      "why agentic ai",
    ])
  ) {
    return { detectedSubIntent: "agentic_architecture_why", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "protect secrets",
      "secrets in an ai system",
      "safest way for an ai system to use secrets",
      "what is the safest way for an ai system to use secrets",
      "secret management",
      "vault or kms",
    ])
  ) {
    return { detectedSubIntent: "technical_stack", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "what is an agent",
      "what is agent orchestration",
      "difference between a tool and an agent",
      "difference between an agent and an api",
      "difference between an agent and a model",
      "what is langgraph",
      "what is temporal",
      "what is fastapi",
      "what is fastapi used for",
      "what is mcp",
      "what is docker",
      "when would joz use docker versus kubernetes",
      "when would joz use docker vs kubernetes",
      "docker versus kubernetes",
      "docker and kubernetes",
      "what is kubernetes",
      "kubernetes pod",
      "kubernetes deployment",
      "kubernetes service",
      "what is ingress",
      "load balancer",
      "horizontal scaling",
      "autoscaling",
      "stateless",
      "what is postgresql",
      "what is redis",
      "difference between postgresql and redis",
      "postgresql and redis",
      "kafka",
      "nats",
      "event-driven architecture",
      "queues and workers",
      "what is temporal used for",
      "workload identity",
      "vault",
      "kms",
      "what is opentelemetry",
      "what is langsmith",
      "prometheus",
      "grafana",
      "langsmith",
      "what is ci/cd",
      "what is terraform",
      "what is gitops",
      "canary deployment",
      "what are retries",
      "circuit breaker",
      "idempotency",
      "backpressure",
      "disaster recovery",
      "infrastructure philosophy",
      "cloud infrastructure",
      "organisational awareness layer",
      "organizational awareness layer",
      "organisational brain",
      "organizational brain",
      "permissions be enforced before retrieval",
      "permissions enforced before retrieval",
      "acl-aware retrieval",
      "acl aware retrieval",
      "what is hybrid retrieval",
      "what role does a knowledge graph play",
      "when would joz use python versus golang",
      "python versus golang",
      "how would joz scale an agent platform",
      "how does joz scale an agent platform",
      "what breaks first when agent systems scale",
      "wire redis and postgresql together",
      "redis and postgresql together",
      "what is joz's infrastructure approach",
      "what is jozs infrastructure approach",
      "how should an ai agent interact with blockchain",
      "blockchain",
      "defi",
      "wallet",
      "smart contract",
    ])
  ) {
    return { detectedSubIntent: "technical_stack", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "singapore recruiter",
      "singapore market fit",
      "fit for singapore",
      "strongest singapore proof",
      "why is joz a fit for singapore",
      "why is joz relevant for singapore",
      "singapore roles",
    ])
  ) {
    return { detectedSubIntent: "singapore_market_fit", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "css",
      "design systems",
      "design system",
      "motion",
      "accessibility",
      "frontend",
      "front end",
      "ui and ux",
      "ui/ux",
    ])
  ) {
    return { detectedSubIntent: "ui_ux_css_accessibility", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "how would joz",
      "design",
      "why would joz use",
      "what happens if",
      "how does joz prevent",
      "how would joz scale",
      "explain the tradeoffs",
      "compare",
      "protect secrets",
      "wire",
    ]) &&
    includesAny(clean, [
      "architecture",
      "system",
      "platform",
      "workflow",
      "scale",
      "verification",
      "security",
      "agent",
      "api",
      "infrastructure",
      "risk",
      "execution",
      "secrets",
      "approval",
      "rollback",
      "redis",
      "postgresql",
    ])
  ) {
    return { detectedSubIntent: "architecture_reasoning", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "proof, not buzzwords",
      "proof not buzzwords",
      "with proof",
      "not buzzwords",
      "strongest skills",
      "strongest technical skills",
      "explain joz's strongest skills",
      "explain jozs strongest skills",
    ])
  ) {
    return { detectedSubIntent: "proof_backed_strengths", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "what is joz's ai stack",
      "what is jozs ai stack",
      "technical stack",
      "ai stack",
      "tool stack",
    ])
  ) {
    return { detectedSubIntent: "technical_stack", detectedConcept: "skills" };
  }

  if (
    includesAny(clean, [
      "deep skills",
      "deepest skills",
      "joz's skills",
      "what are joz's skills",
      "what is joz good at",
      "what experience does joz have",
      "what are his capabilities",
      "what experience does he have",
      "technical depth",
      "core capabilities",
      "technical skills",
      "ai skills",
      "engineering skills",
      "what can joz do",
      "what does joz do",
    ]) &&
    !includesAny(clean, [
      "architecture",
      "agentic architecture",
      "agent architecture",
      "system design",
      "platform design",
      "workflow design",
      "orchestration",
      "retrieval",
      "verification",
      "risk",
      "infrastructure",
    ])
  ) {
    return { detectedSubIntent: "capabilities_overview", detectedConcept: "skills" };
  }

  return null;
}

export function routeJozLlmQuery({ input = "", appContext = {}, legacyContext = {} } = {}) {
  const clean = normalizeText(input);
  const worldContext = buildMeetJozWorldAnswerContext({ input, appContext, legacyContext });
  const worldEntity = resolveMeetJozWorldEntity({ input, appContext, legacyContext });
  const preWorldBusinessNeed = detectBusinessNeed(clean);
  const preWorldSystemsMindset = detectSystemsMindset(clean);
  const preWorldSkills = detectSkills(clean);

  if (
    preWorldBusinessNeed &&
    ["business_diagnosis", "hire_value"].includes(preWorldBusinessNeed.detectedSubIntent)
  ) {
    return {
      detectedIntent: "business_need",
      detectedSubIntent: preWorldBusinessNeed.detectedSubIntent,
      detectedConcept: preWorldBusinessNeed.detectedConcept,
      selectedRoute: "business_need",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (isAmbiguousFollowUp(clean)) {
    return {
      detectedIntent: "unknown_fallback",
      detectedSubIntent: "ambiguous_follow_up",
      detectedConcept: null,
      selectedRoute: "unknown_fallback",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (preWorldSystemsMindset?.detectedSubIntent === "prompt_injection_defense") {
    return {
      detectedIntent: "systems_mindset",
      detectedSubIntent: preWorldSystemsMindset.detectedSubIntent,
      detectedConcept: preWorldSystemsMindset.detectedConcept,
      selectedRoute: "systems_mindset",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (
    preWorldSkills &&
    ["organizational_ownership_layer", "scale_fastapi_architecture", "langgraph_temporal_architecture", "verification_architecture", "single_agent_tradeoffs"].includes(
      preWorldSkills.detectedSubIntent
    )
  ) {
    return {
      detectedIntent: "skills",
      detectedSubIntent: preWorldSkills.detectedSubIntent,
      detectedConcept: preWorldSkills.detectedConcept,
      selectedRoute: "skills",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (preWorldBusinessNeed?.detectedSubIntent === "operating_model") {
    return {
      detectedIntent: "business_need",
      detectedSubIntent: preWorldBusinessNeed.detectedSubIntent,
      detectedConcept: preWorldBusinessNeed.detectedConcept,
      selectedRoute: "business_need",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const canonical = detectCanonicalWorldConcept(clean);
  if (canonical) {
    return {
      detectedIntent: "canonical_world_concept",
      detectedSubIntent: canonical.detectedSubIntent,
      detectedConcept: canonical.detectedConcept,
      selectedRoute: "canonical_world_concept",
      selectedWorldRecord:
        canonical.detectedConcept === "gold_pill" ? worldEntity.worldRecord || "root_gold_pill / gold_pill concept" : null,
      worldContext,
      worldEntity,
    };
  }

  if (worldContext.route === "world_awareness") {
    return {
      detectedIntent: "world_awareness",
      detectedSubIntent: "spatial_context",
      detectedConcept: worldEntity.entity || null,
      selectedRoute: "world_awareness",
      selectedWorldRecord: worldEntity.worldRecord || null,
      worldContext,
      worldEntity,
    };
  }

  const identity = detectIdentityProfile(clean);
  if (identity) {
    return {
      detectedIntent: "identity_profile",
      detectedSubIntent: identity.detectedSubIntent,
      detectedConcept: identity.detectedConcept,
      selectedRoute: "identity_profile",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const recruiterOperational = detectRecruiterOperational(clean);
  if (recruiterOperational) {
    return {
      detectedIntent: recruiterOperational.detectedIntent,
      detectedSubIntent: recruiterOperational.detectedSubIntent,
      detectedConcept: recruiterOperational.detectedConcept,
      selectedRoute: "joz_knowledge",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const factual = detectFactualProfile(clean);
  if (factual) {
    return {
      detectedIntent: "factual_profile",
      detectedSubIntent: factual.detectedSubIntent,
      detectedConcept: factual.detectedConcept,
      selectedRoute: "factual_profile",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const businessNeed = preWorldBusinessNeed || detectBusinessNeed(clean);
  if (businessNeed) {
    return {
      detectedIntent: "business_need",
      detectedSubIntent: businessNeed.detectedSubIntent,
      detectedConcept: businessNeed.detectedConcept,
      selectedRoute: "business_need",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const systemsMindset = detectSystemsMindset(clean);
  if (systemsMindset) {
    return {
      detectedIntent: "systems_mindset",
      detectedSubIntent: systemsMindset.detectedSubIntent,
      detectedConcept: systemsMindset.detectedConcept,
      selectedRoute: "systems_mindset",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  const skills = detectSkills(clean);
  if (skills) {
    return {
      detectedIntent: "skills",
      detectedSubIntent: skills.detectedSubIntent,
      detectedConcept: skills.detectedConcept,
      selectedRoute: "skills",
      selectedWorldRecord: null,
      worldContext,
      worldEntity,
    };
  }

  if (worldContext.route === "mixed") {
    return {
      detectedIntent: "mixed",
      detectedSubIntent: "world_and_profile",
      detectedConcept: worldEntity.entity || null,
      selectedRoute: "mixed",
      selectedWorldRecord: worldEntity.worldRecord || null,
      worldContext,
      worldEntity,
    };
  }

  return {
    detectedIntent: "unknown_fallback",
    detectedSubIntent: "general",
    detectedConcept: null,
    selectedRoute: "unknown_fallback",
    selectedWorldRecord: null,
    worldContext,
    worldEntity,
  };
}

export function composeJozLlmRouteReply({
  route,
  input = "",
  appContext = {},
  legacyContext = {},
  retrievedDocuments = [],
} = {}) {
  const recruiterOperationalResolution = buildRecruiterOperationalResolution(route);
  if (recruiterOperationalResolution) {
    return recruiterOperationalResolution;
  }

  if (route?.selectedRoute === "canonical_world_concept") {
    return {
      reply: buildCanonicalWorldConceptReply({
        concept: route.detectedConcept,
        appContext,
        legacyContext,
        input,
      }),
      answerSource:
        route.detectedConcept === "gold_pill"
          ? route.selectedWorldRecord || "root_gold_pill / gold_pill concept"
          : "JOZ_LLM_CV.headline",
      composer: "composeCanonicalWorldConceptReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: [],
    };
  }

  if (route?.selectedRoute === "world_awareness") {
    const worldResolution = buildMeetJozWorldAwarenessResolution({
      input,
      appContext,
      legacyContext,
    });
    return {
      reply: worldResolution.reply || buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext }) || "",
      answerSource: worldResolution.answerSource || route.selectedWorldRecord || "world_awareness",
      composer: worldResolution.composer || "buildMeetJozWorldAwarenessReply",
      fallbackUsed: Boolean(worldResolution.fallbackUsed),
      validationPassed: worldResolution.validationPassed !== false,
      responseMode: worldResolution.responseMode || null,
      intentMode: "skills",
      retrievedCategories: [],
    };
  }

  if (route?.selectedRoute === "identity_profile") {
    return {
      reply: composeIdentityProfileReply(),
      answerSource: "JOZ_LLM_CV + JOZ_LLM_IDENTITY",
      composer: "composeIdentityProfileReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["bio", "proof"],
    };
  }

  if (route?.selectedRoute === "factual_profile") {
    return {
      reply: composeFactualProfileReply(route.detectedSubIntent),
      answerSource:
        route.detectedSubIntent === "contact" || route.detectedSubIntent === "nationality" || route.detectedSubIntent === "availability"
          ? "JOZ_LLM_IDENTITY.recruiterAnswers"
          : "JOZ_LLM_CV.education + JOZ_LLM_IDENTITY",
      composer: "composeFactualProfileReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["faq", "bio"],
    };
  }

  if (route?.selectedRoute === "business_need") {
    const cleanInput = normalizeText(input);
    const preferBusinessNeedBaseTrace =
      route.detectedSubIntent === "business_diagnosis" ||
      (route.detectedSubIntent === "hire_value" &&
        includesAny(cleanInput, ["why should we hire", "why hire", "why is joz relevant", "why joz now"]));
    const baseReply = composeBusinessNeedReply(route.detectedSubIntent);
    const evidenceReply = buildEvidenceBackedRouteReply({
      route,
      baseReply,
      input,
      retrievedDocuments,
    });
    return {
      reply: evidenceReply?.reply || baseReply,
      answerSource:
        preferBusinessNeedBaseTrace
          ? "JOZ_LLM_CV.experience"
          : evidenceReply?.answerSource || "JOZ_LLM_CV.experience",
      composer:
        preferBusinessNeedBaseTrace
          ? "composeBusinessNeedReply"
          : evidenceReply?.composer || "composeBusinessNeedReply",
      fallbackUsed: false,
      intentMode: "business_need",
      retrievedCategories:
        evidenceReply?.evidenceDocs?.map((doc) => doc.category) || ["business_need", "proof"],
    };
  }

  if (route?.selectedRoute === "systems_mindset") {
    const directKnowledgeReply =
      route.detectedSubIntent === "thinking_model" ? buildRetrievedKnowledgeReply(input, retrievedDocuments) : null;
    const baseReply = composeSystemsMindsetReply(route.detectedSubIntent);
    const evidenceReply = buildEvidenceBackedRouteReply({
      route,
      baseReply,
      input,
      retrievedDocuments,
    });
    return {
      reply: directKnowledgeReply || evidenceReply?.reply || baseReply,
      answerSource:
        ["thinking_model", "prompt_injection_defense"].includes(route.detectedSubIntent)
          ? directKnowledgeReply
            ? "retrieved_knowledge"
            : "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience"
          : evidenceReply?.answerSource ||
            "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer:
        ["thinking_model", "prompt_injection_defense"].includes(route.detectedSubIntent)
          ? directKnowledgeReply
            ? "buildRetrievedKnowledgeReply"
            : "composeSystemsMindsetReply"
          : evidenceReply?.composer || "composeSystemsMindsetReply",
      fallbackUsed: false,
      intentMode: "systems_mindset",
      retrievedCategories:
        evidenceReply?.evidenceDocs?.map((doc) => doc.category) || ["systems_mindset", "proof"],
    };
  }

  if (route?.selectedRoute === "skills") {
    const directKnowledgeReply =
      route.detectedSubIntent === "technical_stack" ? buildRetrievedKnowledgeReply(input, retrievedDocuments) : null;
    const baseReply = composeSkillsReply(route.detectedSubIntent);
    const evidenceReply = buildEvidenceBackedRouteReply({
      route,
      baseReply,
      input,
      retrievedDocuments,
    });
    return {
      reply: directKnowledgeReply || evidenceReply?.reply || baseReply,
      answerSource:
        route.detectedSubIntent === "capabilities_overview"
          ? "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience"
          : directKnowledgeReply
            ? "retrieved_knowledge"
          : evidenceReply?.answerSource ||
            "JOZ_LLM_CV.appliedAiSkills + JOZ_LLM_CV.experience",
      composer:
        route.detectedSubIntent === "capabilities_overview"
          ? "composeSkillsReply"
          : directKnowledgeReply
            ? "buildRetrievedKnowledgeReply"
          : evidenceReply?.composer || "composeSkillsReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories:
        evidenceReply?.evidenceDocs?.map((doc) => doc.category) || ["skills", "proof"],
    };
  }

  if (route?.selectedRoute === "mixed") {
    return {
      reply: composeMixedReply({
        worldReply: buildMeetJozWorldAwarenessReply({ input, appContext, legacyContext }),
      }),
      answerSource: "world_awareness + JOZ_LLM_CV",
      composer: "composeMixedReply",
      fallbackUsed: false,
      intentMode: "skills",
      retrievedCategories: ["bio", "proof"],
    };
  }

  return null;
}

export async function resolveUnknownJozReply({
  input = "",
  messages = [],
  openai = null,
  roleAwareContext = {},
} = {}) {
  const clean = normalizeText(input);
  const retrievedDocuments = Array.isArray(roleAwareContext?.retrievedDocuments)
    ? roleAwareContext.retrievedDocuments
    : [];
  const topProgrammeRecord = retrievedDocuments.find((doc) => doc?.category === "project");

  if (detectProgrammeQuery(clean) && topProgrammeRecord) {
    return {
      reply: buildProgrammeRecordReply(topProgrammeRecord),
      answerSource: topProgrammeRecord.title || topProgrammeRecord.metadata?.source_filename || "retrieved_programme_record",
      composer: "buildProgrammeRecordReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode("skills"),
      retrievedCategories: ["skills", "proof"],
    };
  }

  const ambiguousFollowUpReply = buildAmbiguousFollowUpReply(clean);
  if (ambiguousFollowUpReply) {
    return {
      reply: ambiguousFollowUpReply,
      answerSource: "ambiguity_guard",
      composer: "buildAmbiguousFollowUpReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode("unknown_fallback"),
      retrievedCategories: [],
    };
  }

  const unknownDefinitionGapReply = buildUnknownDefinitionGapReply(input);
  if (unknownDefinitionGapReply) {
    return {
      reply: unknownDefinitionGapReply,
      answerSource: "knowledge_gap",
      composer: "buildUnknownDefinitionGapReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode("unknown_fallback"),
      retrievedCategories: [],
    };
  }

  const retrievedKnowledgeReply = buildRetrievedKnowledgeReply(input, retrievedDocuments);
  if (retrievedKnowledgeReply) {
    return {
      reply: retrievedKnowledgeReply,
      answerSource:
        topProgrammeRecord?.title ||
        retrievedDocuments[0]?.title ||
        retrievedDocuments[0]?.metadata?.canonical_record_title ||
        "retrieved_knowledge",
      composer: "buildRetrievedKnowledgeReply",
      fallbackUsed: false,
      intentMode: mapRouteToIntentMode("skills"),
      retrievedCategories: retrievedDocuments
        .slice(0, 3)
        .map((doc) => doc.category)
        .filter(Boolean),
    };
  }

  let reply = "";
  let answerSource = "llm_fallback";
  let composer = "buildJozLlmFallbackReply";
  let fallbackUsed = true;

  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 90,
        messages: [
          {
            role: "system",
            content: buildJozLlmSystemPrompt(),
          },
          {
            role: "system",
            content: JSON.stringify(roleAwareContext),
          },
          ...messages.slice(-8).map((entry) => ({
            role: entry.role === "assistant" ? "assistant" : "user",
            content: String(entry.content || ""),
          })),
        ],
      });

      reply = String(response.choices?.[0]?.message?.content || "").trim();
      if (reply) {
        answerSource = "openai_model";
        composer = "openai.chat.completions.create";
        fallbackUsed = false;
      }
    } catch (error) {
      console.error("⚠️ /api/joz-llm model call failed:", error?.message || error);
    }
  }

  if (!reply) {
    reply = buildJozLlmFallbackReply(input);
  }

  return {
    reply: sanitizeReply(reply),
    answerSource,
    composer,
    fallbackUsed,
    intentMode: mapRouteToIntentMode("unknown_fallback"),
    retrievedCategories: [],
  };
}

export function assertNoFallbackHijack(route, resolution) {
  if (route?.selectedRoute !== "unknown_fallback" && resolution?.fallbackUsed) {
    throw new Error(`Fallback hijack detected for route ${route.selectedRoute}`);
  }
}

export function buildJozRouteTrace(route, resolution) {
  return {
    detectedIntent: route?.detectedIntent || "unknown_fallback",
    detectedSubIntent: route?.detectedSubIntent || null,
    detectedConcept: route?.detectedConcept || null,
    selectedRoute: route?.selectedRoute || "unknown_fallback",
    selectedWorldRecord: route?.selectedWorldRecord || null,
    answerSource: resolution?.answerSource || null,
    responseMode: resolution?.responseMode || null,
    composer: resolution?.composer || null,
    selectedOperationalComposer: resolution?.selectedOperationalComposer || null,
    recommendedActionIds: resolution?.recommendedActionIds || [],
    fallbackUsed: Boolean(resolution?.fallbackUsed),
    validationPassed: resolution?.validationPassed !== false,
  };
}

export function buildRoleAwareJozContext({
  buildJozLlmContext,
  profile,
  context = {},
  intentMode = "skills",
  retrievedDocuments = [],
} = {}) {
  return {
    ...buildJozLlmContext(),
    runtime: {
      currentPortal: context?.currentPortal || "root",
      currentMesh: context?.currentMesh || null,
      currentMeshStage: context?.currentMeshStage || null,
      targetRole: context?.targetRole || "Advanced Data Scientist",
      intentMode,
    },
    profile,
    retrievedDocuments,
    retrievalSummary: normalizeRetrievedDocuments(retrievedDocuments).map((doc) =>
      buildRetrievedDocumentBrief(doc)
    ),
    cv: JOZ_LLM_CV,
    identity: JOZ_LLM_IDENTITY,
  };
}
