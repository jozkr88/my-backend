import test from "node:test";
import assert from "node:assert/strict";

import {
  buildJozRouteTrace,
  composeJozLlmRouteReply,
  resolveUnknownJozReply,
  routeJozLlmQuery,
} from "./shared/jozLlmRouter.js";
import { validateAppContext } from "./shared/meetJozWorld.js";

function buildContexts(context = {}) {
  const legacyContext = {
    currentPortal: context.currentPortal || "root",
    currentMesh: context.currentMesh || null,
    currentMeshStage: context.currentMeshStage || null,
  };

  return {
    legacyContext,
    appContext: validateAppContext({}, legacyContext).value,
  };
}

test("routes identity profile queries ahead of assistant fallback", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Who is Joz?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Who is Joz?",
    appContext,
    legacyContext,
  });
  const trace = buildJozRouteTrace(route, resolution);

  assert.equal(route.selectedRoute, "identity_profile");
  assert.equal(trace.fallbackUsed, false);
  assert.match(resolution.reply, /Joz Krupa is an Agentic AI Architecture and Innovation Leader/i);
  assert.doesNotMatch(resolution.reply, /Joz LLM can explain/i);
});

test("routes education queries to factual profile education", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Where did Joz study?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Where did Joz study?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "factual_profile");
  assert.equal(route.detectedSubIntent, "education");
  assert.match(resolution.reply, /University of Central Lancashire/i);
});

test("routes Gold Pill queries to canonical world concept before world awareness", () => {
  const { appContext, legacyContext } = buildContexts({
    currentPortal: "root",
    currentMesh: "ball",
  });
  const route = routeJozLlmQuery({
    input: "What is the Gold Pill?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "canonical_world_concept");
  assert.equal(route.detectedConcept, "gold_pill");
});

test("routes deep skills queries to skills and returns technical depth reply", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const route = routeJozLlmQuery({
    input: "What are deep skills of Joz?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "What are deep skills of Joz?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "capabilities_overview");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Agentic AI|agentic AI/i);
  assert.match(resolution.reply, /context engineering/i);
  assert.match(resolution.reply, /decision intelligence/i);
  assert.match(resolution.reply, /multimodal|spatial/i);
  assert.match(resolution.reply, /retrieval|orchestration|memory|verification|observability/i);
  assert.match(resolution.reply, /Python backend systems/i);
  assert.match(resolution.reply, /enterprise architecture|enterprise/i);
  assert.doesNotMatch(resolution.reply, /Slovak|EU national|\bEP\b|\bPEP\b|work authorization/i);
  assert.equal(Array.isArray(resolution.actions) ? resolution.actions.length : 0, 0);
});

test("routes agentic architecture prompts to the dedicated architecture approach answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "What agentic architecture does Joz do?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "agentic_architecture_approach");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /separation of responsibilities/i);
  assert.match(resolution.reply, /API intake, orchestration, specialist agents, tool and service layers, memory and retrieval, policy and risk gates, execution services, and verification/i);
  assert.match(resolution.reply, /thin orchestrator|typed state|scoped tools|approval boundaries/i);
  assert.match(resolution.reply, /verification outside the agent|authoritative systems/i);
  assert.doesNotMatch(resolution.reply, /Joz Krupa is an Agentic AI Architecture and Innovation leader/i);
});

test("routes how-and-why agentic AI prompts to the dedicated architecture approach answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const prompt of [
    "How does Joz architect agentic AI?",
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, "skills");
    assert.equal(route.detectedSubIntent, "agentic_architecture_approach");
    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, /separation of responsibilities/i);
    assert.match(resolution.reply, /multi-step reasoning, tool use, workflow coordination, and controlled execution/i);
    assert.doesNotMatch(resolution.reply, /Joz Krupa is an Agentic AI Architecture and Innovation leader/i);
  }
});

test("routes broader agent-architecture phrasing to the dedicated architecture approach answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const prompt of [
    "What is Joz's agent architecture approach?",
    "How would Joz structure an agent system?",
    "What architecture pattern would Joz use for agents in production?",
    "How does Joz separate policy from execution?",
    "Why keep policy outside the agent?",
    "Why keep verification outside the agent?",
    "Why separate policy from execution?",
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, "skills");
    assert.equal(route.detectedSubIntent, "agentic_architecture_approach");
    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, /separation of responsibilities|thin orchestrator|policy before action/i);
    assert.doesNotMatch(resolution.reply, /Joz Krupa is an Agentic AI Architecture and Innovation leader/i);
  }
});

test("routes why-agentic-AI phrasing to the dedicated motivation answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "Why does Joz do agentic AI?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "agentic_architecture_why");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /more than one-shot generation|multi-step reasoning|tool use/i);
  assert.match(resolution.reply, /controlled execution|better decisions|safer actions/i);
  assert.doesNotMatch(resolution.reply, /clear separation of responsibilities: API intake/i);
});

test("factual profile degree phrasing resolves without falling to fallback", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "What is Joz's degree?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "factual_profile");
  assert.equal(route.detectedSubIntent, "degree");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /MSc in Strategy and Innovation/i);
});

test("routes single-agent versus multi-agent platform questions to the dedicated tradeoff answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "You need to build an autonomous trading platform. Would Joz use a single agent or multiple agents? Explain the tradeoffs, architecture, risks, failure modes, and when he would switch from one approach to the other.";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "single_agent_tradeoffs");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /start with one orchestrator agent|single agent/i);
  assert.match(resolution.reply, /autonomous trading platform/i);
  assert.match(resolution.reply, /research, portfolio reasoning, risk, compliance, execution, and verification/i);
  assert.match(resolution.reply, /coordination overhead|state-sync risk|deadlocks|failure paths/i);
  assert.match(resolution.reply, /typed shared state|policy|risk gates|verification/i);
  assert.doesNotMatch(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("routes general agent-scope tradeoff questions to the dedicated scope answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const prompt of [
    "Why would Joz use multiple agents instead of one?",
    "When should an agent stay simple and when should it become a system?",
    "Should Joz use one brain or many brains for an agent system?",
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, "skills");
    assert.equal(route.detectedSubIntent, "agent_scope_tradeoffs");
    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, /keep an agent simple|turn it into a broader system/i);
    assert.match(resolution.reply, /one orchestrator|specialist workers|coordination overhead|state-sync/i);
  }
});

test("routes portfolio verification questions to the dedicated verification architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "An agent proposes selling 20% of a portfolio. Design a verification architecture that guarantees the portfolio actually changed as expected.";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "verification_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /execution-to-state reconciliation architecture/i);
  assert.match(resolution.reply, /controlled execution service|broker|venue acknowledgement/i);
  assert.match(resolution.reply, /authoritative portfolio source of truth/i);
  assert.match(resolution.reply, /expected delta|actual post-trade state/i);
  assert.match(resolution.reply, /idempotent order keys|immutable audit logs|bounded retries|human escalation/i);
  assert.doesNotMatch(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("routes general agent-action verification questions to the dedicated verification architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "How would Joz design a verification layer for agents that can take actions?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "verification_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Proposal -> Risk and Policy -> Execution -> Event Capture -> Verification -> Reconciliation/i);
  assert.match(resolution.reply, /reconciliation architecture|authoritative portfolio source of truth|expected state/i);
});

test("routes natural completion-check phrasing to the dedicated verification architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "If an agent says it finished the job, how would Joz check that it really did?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "verification_architecture");
  assert.match(resolution.reply, /Execution|Verification|Reconciliation|authoritative/i);
});

test("routes FastAPI scale-up questions to the dedicated scaling architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "A FastAPI service currently handles 100 users. It now needs to handle 100,000 users. How would Joz scale the architecture?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "scale_fastapi_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /stateless FastAPI replicas|API layer should stay stateless/i);
  assert.match(resolution.reply, /load balancer/i);
  assert.match(resolution.reply, /Redis/i);
  assert.match(resolution.reply, /PostgreSQL/i);
  assert.match(resolution.reply, /queues and workers|caching/i);
  assert.match(resolution.reply, /autoscaling|rate limits|bounded concurrency|database scaling/i);
  assert.doesNotMatch(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("routes natural FastAPI growth phrasing to the dedicated scaling answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "How would Joz scale a FastAPI service from 100 users to 100,000?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "scale_fastapi_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Stateless FastAPI Replicas|API layer should stay stateless/i);
});

test("technical stack definition prompts use direct technical answers instead of the generic stack summary", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const [prompt, expected] of [
    ["What is the difference between Docker and Kubernetes?", /Docker packages a service|Kubernetes deploys, scales, restarts/i],
    ["What is the difference between PostgreSQL and Redis?", /PostgreSQL stores durable application state|Redis stores cache and short-lived state/i],
    ["How would Joz protect secrets in an AI system?", /Vault|KMS|managed secret store|must not be stored in source code/i],
    ["What is the safest way for an AI system to use secrets?", /Vault|KMS|managed secret store|scoped tools/i],
    ["What is the difference between a tool and an agent?", /tool executes a capability|agent decides/i],
    ["What breaks first when agent systems scale?", /queue depth|latency|tool bottlenecks|verification backlog|scaled independently/i],
    ["How would Joz wire Redis and PostgreSQL together in a real system?", /PostgreSQL.*source of truth|Redis.*cache|ephemeral state/i],
    ["What is a Kubernetes pod?", /smallest deployable unit|pod/i],
    ["How would Joz scale an agent platform under high concurrency?", /separating API intake, reasoning workers, tool services|bottleneck/i],
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, "skills");
    assert.equal(route.detectedSubIntent, "technical_stack");
    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, expected);
    assert.doesNotMatch(resolution.reply, /Joz's core stack spans agentic AI architecture and product engineering/i);
  }
});

test("routes fail-safe platform prompts to the dedicated safe-architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "How would Joz design an AI platform that can fail safely?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "safe_architecture_design");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /fail safely|policy|verification|human approval|graceful degradation/i);
  assert.doesNotMatch(resolution.reply, /Leo Burnett|Publicis|Luxury commerce/i);
});

test("routes production-stupidity and approval-rollback phrasing to safer routes", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const [prompt, expectedRoute] of [
    ["How would Joz stop an AI from doing something stupid in production?", "systems_mindset"],
    ["How would Joz structure approvals, escalation, and rollback?", "skills"],
    ["Why not let agents just deploy code themselves?", "systems_mindset"],
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, expectedRoute);
    assert.equal(resolution.fallbackUsed, false);
  }
});

test("production-stupidity and deploy-themselves prompts use direct guardrail answers", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const [prompt, expected] of [
    ["How would Joz stop an AI from doing something stupid in production?", /policy|approval|verification|stops or escalates/i],
    ["Why not let agents just deploy code themselves?", /should not deploy code by themselves|explicit approval|rollback/i],
    ["How would Joz structure approvals, escalation, and rollback?", /Policy Gate -> Approval Step -> Execution -> Verification -> Rollback or Escalation/i],
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, expected);
  }
});

test("routes broad human-approval prompts to the explicit guardrail answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "What should always require human approval?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "systems_mindset");
  assert.equal(route.detectedSubIntent, "thinking_model");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /database migrations|security changes|infrastructure changes|production deployments|code merges/i);
  assert.doesNotMatch(resolution.reply, /challenge is deciding/i);
});

test("routes full financial platform design prompts to the dedicated platform architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "Design an AI-native financial intelligence platform from scratch. Include APIs, agents, risk, verification, memory, databases, event streaming, infrastructure, observability, and security. Explain the role of each component.";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "financial_intelligence_platform_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /layered financial intelligence platform/i);
  assert.match(resolution.reply, /API Gateway|Stateless FastAPI Services|Orchestrator Agent/i);
  assert.match(resolution.reply, /research, signal generation, portfolio reasoning, risk review, execution planning, and post-trade verification/i);
  assert.match(resolution.reply, /PostgreSQL|pgvector|Redis|object storage/i);
  assert.match(resolution.reply, /Event streaming carries market updates, portfolio changes, execution events/i);
  assert.match(resolution.reply, /Observability must cover traces, metrics, logs, workflow history, model calls, tool usage, cost, latency, and verification failures/i);
  assert.match(resolution.reply, /least privilege|workload identity|secret isolation|human approval/i);
  assert.doesNotMatch(resolution.reply, /architecture problem, not a profile summary/i);
});

test("routes prompt injection defense questions to the dedicated systems answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "An agent reads a Telegram channel containing prompt injection attacks. How would Joz prevent the agent from executing malicious instructions?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "systems_mindset");
  assert.equal(route.detectedSubIntent, "prompt_injection_defense");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Telegram channel as external data|untrusted content/i);
  assert.match(resolution.reply, /data, not instructions|separate from retrieved content/i);
  assert.match(resolution.reply, /system policy outside the model|block tool execution/i);
  assert.match(resolution.reply, /strict tool allowlists|ACL-aware retrieval|human approval/i);
  assert.doesNotMatch(resolution.reply, /Start with one orchestrator agent/i);
});

test("systems safety prompts use direct technical answers instead of the generic systems-mindset summary", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });

  for (const [prompt, expected] of [
    ["Can agents deploy directly to production?", /must not deploy directly to production|explicit human approval/i],
    ["What actions should require human approval?", /database migrations|security changes|production deployments|code merges/i],
  ]) {
    const route = routeJozLlmQuery({
      input: prompt,
      appContext,
      legacyContext,
    });
    const resolution = composeJozLlmRouteReply({
      route,
      input: prompt,
      appContext,
      legacyContext,
    });

    assert.equal(route.selectedRoute, "systems_mindset");
    assert.equal(resolution.fallbackUsed, false);
    assert.match(resolution.reply, expected);
    assert.doesNotMatch(resolution.reply, /Joz thinks in systems before features/i);
  }
});

test("routes organisational ownership inference questions to the dedicated awareness-layer answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "Two teams disagree about system ownership. How would Joz design an organisational awareness layer to determine ownership automatically?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "organizational_ownership_layer");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /ownership-inference system/i);
  assert.match(resolution.reply, /GitHub, Slack, tickets, docs, architecture records, and on-call data/i);
  assert.match(resolution.reply, /competing ownership claims with confidence and provenance/i);
  assert.match(resolution.reply, /ranked ownership candidates|evidence|confidence|freshness|escalation/i);
  assert.doesNotMatch(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("routes LangGraph plus Temporal questions to the dedicated architecture answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "Why would Joz use LangGraph and Temporal together? Why not use only one?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "langgraph_temporal_architecture");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /LangGraph handles the reasoning graph/i);
  assert.match(resolution.reply, /agent state|branches|loops|handoffs/i);
  assert.match(resolution.reply, /Temporal handles durable workflow execution/i);
  assert.match(resolution.reply, /retries|timers|approvals|crash recovery/i);
  assert.match(resolution.reply, /Using only LangGraph/i);
  assert.match(resolution.reply, /Using only Temporal/i);
  assert.match(resolution.reply, /LangGraph decides, Temporal persists and recovers/i);
  assert.doesNotMatch(resolution.reply, /Ogilvy\/WPP|Singapore Stock Exchange|Banyan Tree|Danone/i);
});

test("broad architecture questions do not fall back to capabilities_overview", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt =
    "How would Joz design a secure workflow architecture for agent execution with policy, verification, and risk controls?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "architecture_reasoning");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /architecture problem, not a profile summary/i);
  assert.match(resolution.reply, /system boundary|authoritative state|control points|execution path|risk gates/i);
  assert.match(resolution.reply, /API, orchestration, execution, data, policy, and verification/i);
  assert.doesNotMatch(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("routes proof-not-buzzwords skills queries to an evidence-first answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const route = routeJozLlmQuery({
    input: "Explain Joz's strongest skills with proof, not buzzwords.",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Explain Joz's strongest skills with proof, not buzzwords.",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "proof_backed_strengths");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /MarketClue/i);
  assert.match(resolution.reply, /20x digital sales growth at Maybank/i);
  assert.match(resolution.reply, /11 Manulife markets/i);
  assert.match(resolution.reply, /30x audience growth at Mediacorp/i);
  assert.match(resolution.reply, /16M\+ customer-scale engineering at Erste Bank/i);
  assert.match(resolution.reply, /Versace\/SOA|ArtKorero/i);
  assert.doesNotMatch(resolution.reply, /FastAPI|PostgreSQL|pgvector|Redis/i);
});

test("routes css design systems motion accessibility queries to dedicated interface proof answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "How strong is Joz in CSS, design systems, motion, and accessibility?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "How strong is Joz in CSS, design systems, motion, and accessibility?",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "ui_ux_css_accessibility");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Mediacorp/i);
  assert.match(resolution.reply, /30\+ products/i);
  assert.match(resolution.reply, /Leo Burnett\/Publicis/i);
  assert.match(resolution.reply, /70%/i);
  assert.match(resolution.reply, /Maybank/i);
  assert.match(resolution.reply, /20x digital sales growth/i);
  assert.match(resolution.reply, /Erste Bank/i);
  assert.match(resolution.reply, /16M\+ customer scale|16M\+ customer-scale/i);
});

test("routes singapore market fit skills queries to singapore-specific proof answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Explain Joz's Singapore market fit.",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Explain Joz's Singapore market fit.",
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "singapore_market_fit");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Maybank-Ageas Etiqa/i);
  assert.match(resolution.reply, /Manulife/i);
  assert.match(resolution.reply, /Mediacorp/i);
  assert.match(resolution.reply, /Singapore Stock Exchange/i);
});

test("routes business value efficiency queries to an efficiency-first answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt =
    "How does Joz create business value through efficiency, lower cost, faster execution, and stronger operational leverage?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "business_need");
  assert.equal(route.detectedSubIntent, "efficiency");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /process cost|lower cost|cost reduction/i);
  assert.match(resolution.reply, /cycle time|faster execution/i);
  assert.match(resolution.reply, /operational leverage/i);
  assert.match(resolution.reply, /finance|ERP|accounting|HR|marketing|operations/i);
  assert.match(resolution.reply, /process redesign/i);
  assert.match(resolution.reply, /retrieval|summarization|classification|recommendation|workflow orchestration/i);
  assert.match(resolution.reply, /Leo Burnett\/Publicis/i);
  assert.match(resolution.reply, /70%/i);
  assert.match(resolution.reply, /Manulife/i);
  assert.doesNotMatch(resolution.reply, /20x digital sales growth/i);
  assert.doesNotMatch(resolution.reply, /30x audience growth/i);
});

test("routes business value growth queries to a growth-first answer with proof", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt =
    "How does Joz use AI systems to support growth, scaling, better decisions, and stronger commercial performance?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "business_need");
  assert.equal(route.detectedSubIntent, "growth");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /growth|scale revenue/i);
  assert.match(resolution.reply, /better decisions|decision speed/i);
  assert.match(resolution.reply, /commercial signal|conversion/i);
  assert.match(resolution.reply, /Maybank-Ageas Etiqa/i);
  assert.match(resolution.reply, /20x digital sales growth/i);
  assert.match(resolution.reply, /Mediacorp/i);
  assert.match(resolution.reply, /30x audience growth/i);
  assert.match(resolution.reply, /Manulife/i);
  assert.match(resolution.reply, /11 APAC markets/i);
});

test("routes business value decision-support queries to an executive clarity answer", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt =
    "How does Joz improve decision support through better signal, prioritization, judgment, and clarity in noisy business environments?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "business_need");
  assert.equal(route.detectedSubIntent, "decision_support");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /decision support|judgment|executive clarity/i);
  assert.match(resolution.reply, /signal|prioritization|prioritisation/i);
  assert.match(resolution.reply, /action|alignment|accountable execution/i);
});

test("routes operating-model business questions to business_need instead of architecture reasoning", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt =
    "How should a company design its operating model to embed Joz and AI systems across workflows, ownership, governance, and execution?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "business_need");
  assert.equal(route.detectedSubIntent, "operating_model");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /operating-model level|where AI should sit|who owns what/i);
  assert.match(resolution.reply, /human approval stays|workflows escalate|outcomes are measured/i);
  assert.doesNotMatch(resolution.reply, /architecture problem, not a profile summary/i);
});

test("system architecture wording can override the operating-model business route", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "How would Joz design the system architecture behind that operating model?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "architecture_reasoning");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /architecture problem, not a profile summary/i);
});

test("exact Joz experience phrasing stays on capabilities overview", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "What experience does Joz have?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(route.detectedSubIntent, "capabilities_overview");
  assert.equal(resolution.fallbackUsed, false);
  assert.match(resolution.reply, /Joz's deepest skills are in agentic AI architecture/i);
});

test("business value replies stay differentiated across efficiency, growth, roi, and decision support", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompts = {
    efficiency:
      "How does Joz create business value through efficiency, lower cost, faster execution, and stronger operational leverage?",
    growth:
      "How does Joz use AI systems to support growth, scaling, better decisions, and stronger commercial performance?",
    roi: "Where does Joz create the most business value and ROI in AI systems?",
    decisionSupport:
      "How does Joz improve decision support through better signal, prioritization, judgment, and clarity in noisy business environments?",
  };

  const replies = Object.fromEntries(
    Object.entries(prompts).map(([key, prompt]) => {
      const route = routeJozLlmQuery({
        input: prompt,
        appContext,
        legacyContext,
      });
      const resolution = composeJozLlmRouteReply({
        route,
        input: prompt,
        appContext,
        legacyContext,
      });
      return [key, String(resolution.reply || "")];
    })
  );

  assert.notEqual(replies.efficiency, replies.growth);
  assert.notEqual(replies.efficiency, replies.roi);
  assert.notEqual(replies.efficiency, replies.decisionSupport);
  assert.notEqual(replies.growth, replies.roi);
  assert.notEqual(replies.growth, replies.decisionSupport);
  assert.notEqual(replies.roi, replies.decisionSupport);

  assert.match(replies.efficiency, /Leo Burnett\/Publicis|70%/i);
  assert.match(replies.growth, /20x digital sales growth|30x audience growth/i);
  assert.match(replies.roi, /baseline|target metrics|profit|roi/i);
  assert.match(replies.decisionSupport, /signal|prioritization|judgment|executive clarity/i);
});

test("skills route upgrades to retrieved proof when ranked documents are provided", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt = "What are Joz's strongest technical skills?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
    retrievedDocuments: [
      {
        title: "Agentic AI Architecture Proof",
        category: "skills",
        summary:
          "Focused proof of Joz's agentic AI architecture, retrieval, orchestration, and production-minded systems capability.",
        metadata: {
          slug: "2026-07-11-agentic-ai-architecture-proof",
          proof_points: [
            "MarketClue USA work is described as financial AI agents with live data and asset portfolios.",
          ],
        },
      },
      {
        title: "Enterprise Scale Proof",
        category: "proof",
        summary:
          "Highest-priority proof record for brand strength, user scale, enterprise complexity, and measurable impact.",
        metadata: {
          slug: "2026-07-11-enterprise-scale-proof",
          proof_points: [
            "Erste Bank engineering and EU accessibility work serving 16M+ customers.",
          ],
        },
      },
    ],
  });

  assert.equal(route.selectedRoute, "skills");
  assert.equal(resolution.composer, "buildEvidenceBackedRouteReply");
  assert.match(resolution.reply, /MarketClue USA work/i);
  assert.match(resolution.reply, /Erste Bank engineering/i);
  assert.match(
    resolution.answerSource,
    /Agentic AI Architecture Proof \+ Enterprise Scale Proof/i
  );
});

test("business need route upgrades to retrieved proof when ranked documents are provided", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const prompt = "How does Joz create business value?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: prompt,
    appContext,
    legacyContext,
    retrievedDocuments: [
      {
        title: "Business Value Proof at Enterprise Scale",
        category: "proof",
        summary:
          "Proof of measurable business value at enterprise scale.",
        metadata: {
          slug: "business-need-enterprise-proof",
          proof_points: [
            "Maybank-Ageas Etiqa 20x digital-sales growth and 3,000+ wealth pilots.",
          ],
        },
      },
      {
        title: "Joz Turns Complexity into Business Value",
        category: "business_need",
        summary:
          "Joz turns complexity into business value through decision intelligence and governance-minded delivery.",
        metadata: {
          slug: "business-need-hero-value",
          proof_points: [
            "Mediacorp / CNA delivered roughly 30x MAU audience growth through mobile-first transformation.",
          ],
        },
      },
    ],
  });

  assert.equal(route.selectedRoute, "business_need");
  assert.equal(resolution.composer, "buildEvidenceBackedRouteReply");
  assert.match(resolution.reply, /Maybank-Ageas Etiqa 20x digital-sales growth/i);
  assert.match(resolution.reply, /Mediacorp \/ CNA delivered roughly 30x MAU audience growth/i);
});

test("routes recruiter location queries to deterministic operational answer with actions", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Where is Joz located?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Where is Joz located?",
    appContext,
    legacyContext,
  });
  const trace = buildJozRouteTrace(route, resolution);

  assert.equal(route.detectedIntent, "recruiter_location");
  assert.equal(route.selectedRoute, "joz_knowledge");
  assert.equal(resolution.reply, "Joz operates across Dubai, Singapore, Zurich, Europe, and global markets.");
  assert.equal(resolution.selectedOperationalComposer, "composeLocationAnswer");
  assert.deepEqual(
    resolution.actions.map((action) => action.id),
    ["call_joz", "email_joz"]
  );
  assert.equal(trace.selectedOperationalComposer, "composeLocationAnswer");
  assert.deepEqual(trace.recommendedActionIds, ["call_joz", "email_joz"]);
  assert.equal(trace.validationPassed, true);
  assert.equal(trace.fallbackUsed, false);
});

test("routes recruiter notice period queries to deterministic operational answer with actions", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "What is Joz's notice period?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "What is Joz's notice period?",
    appContext,
    legacyContext,
  });

  assert.equal(route.detectedIntent, "recruiter_notice_period");
  assert.equal(route.selectedRoute, "joz_knowledge");
  assert.equal(
    resolution.reply,
    "Joz's current notice period and earliest start date should be confirmed directly for the specific hiring process."
  );
  assert.equal(resolution.selectedOperationalComposer, "composeNoticePeriodAnswer");
});

test("routes recruiter working model queries to deterministic operational answer with actions", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "root" });
  const route = routeJozLlmQuery({
    input: "Is Joz open to remote, hybrid, or onsite work?",
    appContext,
    legacyContext,
  });
  const resolution = composeJozLlmRouteReply({
    route,
    input: "Is Joz open to remote, hybrid, or onsite work?",
    appContext,
    legacyContext,
  });

  assert.equal(route.detectedIntent, "recruiter_working_model");
  assert.equal(route.selectedRoute, "joz_knowledge");
  assert.match(resolution.reply, /remote, hybrid, or on-site/i);
  assert.equal(resolution.selectedOperationalComposer, "composeWorkingModelAnswer");
});

test("programme employer queries can resolve from retrieved programme records without model fallback", async () => {
  const resolution = await resolveUnknownJozReply({
    input: "What did Joz do at Mediacorp?",
    messages: [{ role: "user", content: "What did Joz do at Mediacorp?" }],
    openai: null,
    roleAwareContext: {
      retrievedDocuments: [
        {
          title: "National Media Platforms and Mobile Transformation — Mediacorp, Singapore",
          category: "project",
          summary:
            "National-scale media, election, news, streaming, CMS, mobile, Apple Watch, and corporate experience architecture across Mediacorp.",
          metadata: {
            companies: ["Mediacorp", "Channel NewsAsia"],
            projects: [
              "Channel NewsAsia iOS and Android apps",
              "Apple Watch app UX for Channel NewsAsia",
              "Toggle/mewatch VoD",
              "Corporate-wide UX Guidelines",
            ],
          },
        },
      ],
    },
  });

  assert.equal(resolution.fallbackUsed, false);
  assert.equal(resolution.composer, "buildProgrammeRecordReply");
  assert.match(resolution.reply, /Mediacorp/i);
  assert.match(resolution.reply, /Apple Watch/i);
  assert.match(resolution.reply, /VoD/i);
  assert.match(resolution.reply, /Corporate-wide UX Guidelines/i);
});

test("unknown definition prompts return a knowledge-gap reply instead of the Joz bio fallback", async () => {
  const expectedTerms = new Map([
    ["What is Paradex?", "Paradex"],
    ["What is DIMA?", "DIMA"],
  ]);

  for (const [prompt, expectedTerm] of expectedTerms.entries()) {
    const resolution = await resolveUnknownJozReply({
      input: prompt,
      messages: [{ role: "user", content: prompt }],
      openai: null,
      roleAwareContext: {
        retrievedDocuments: [],
      },
    });

    assert.equal(resolution.fallbackUsed, false);
    assert.equal(resolution.composer, "buildUnknownDefinitionGapReply");
    assert.equal(resolution.answerSource, "knowledge_gap");
    assert.match(
      resolution.reply,
      new RegExp(`^${expectedTerm} is not in the current Joz knowledge base\\.`, "i")
    );
    assert.doesNotMatch(resolution.reply, /Agentic AI Architecture and Innovation/i);
  }
});

test("unknown definition prompts ignore unrelated retrieved docs and still return a knowledge-gap reply", async () => {
  const unrelatedRetrievedDocuments = [
    {
      title: "Joz Krupa — Agentic AI Architecture and Innovation",
      category: "skills",
      summary:
        "Primary Skills-lane positioning: Agentic AI architecture, enterprise intelligence, governance, context engineering, and multimodal AI orchestration.",
      body:
        "Joz Krupa is an Agentic AI Architecture and Innovation leader with a career spanning enterprise product systems, engineering, data-informed decision design, and AI-enabled transformation.",
      metadata: {
        slug: "skills-hero-agentic-ai",
        tags: ["agentic-ai", "architecture"],
      },
    },
    {
      title: "Designing Inclusive Dubai — Dubai Future Foundation",
      category: "project",
      summary:
        "Inclusive public-service and innovation experience work for Dubai Future Foundation.",
      body:
        "Inclusive public-service and innovation experience work for Dubai Future Foundation.",
      metadata: {
        slug: "dubai-future-foundation-inclusive-design",
        tags: ["government-innovation"],
      },
    },
  ];

  const expectedTerms = new Map([
    ["what is Dima", "Dima"],
    ["what is X?", "X"],
  ]);

  for (const [prompt, expectedTerm] of expectedTerms.entries()) {
    const resolution = await resolveUnknownJozReply({
      input: prompt,
      messages: [{ role: "user", content: prompt }],
      openai: null,
      roleAwareContext: {
        retrievedDocuments: unrelatedRetrievedDocuments,
      },
    });

    assert.equal(resolution.fallbackUsed, false);
    assert.equal(resolution.composer, "buildUnknownDefinitionGapReply");
    assert.equal(resolution.answerSource, "knowledge_gap");
    assert.match(
      resolution.reply,
      new RegExp(`^${expectedTerm} is not in the current Joz knowledge base\\.`, "i")
    );
    assert.doesNotMatch(resolution.reply, /Agentic AI Architecture and Innovation/i);
  }
});

test("common first-word typos still resolve unknown definition prompts to the knowledge-gap reply", async () => {
  const unrelatedRetrievedDocuments = [
    {
      title: "Tools",
      category: "skills",
      summary:
        "Tools are functions, APIs, services, databases, models, or external systems that agents can call.",
      body:
        "Tools are functions, APIs, services, databases, models, or external systems that agents can call. Examples: get_portfolio() get_market_data() search_documents() calculate_risk() create_order() verify_transaction() A tool executes a capability.",
      metadata: {
        slug: "canonical-tooling",
        tags: ["tools", "agents"],
      },
    },
  ];

  const resolution = await resolveUnknownJozReply({
    input: "hat is Paradex?",
    messages: [{ role: "user", content: "hat is Paradex?" }],
    openai: null,
    roleAwareContext: {
      retrievedDocuments: unrelatedRetrievedDocuments,
    },
  });

  assert.equal(resolution.fallbackUsed, false);
  assert.equal(resolution.composer, "buildUnknownDefinitionGapReply");
  assert.equal(resolution.answerSource, "knowledge_gap");
  assert.match(
    resolution.reply,
    /^Paradex is not in the current Joz knowledge base\./i
  );
  assert.doesNotMatch(resolution.reply, /^Tools are functions/i);
});

test("special malformed knowledge-base question returns a clean gap answer", async () => {
  const resolution = await resolveUnknownJozReply({
    input: "What is not in Joz's knowledge base?",
    messages: [{ role: "user", content: "What is not in Joz's knowledge base?" }],
    openai: null,
    roleAwareContext: {
      retrievedDocuments: [],
    },
  });

  assert.equal(resolution.fallbackUsed, false);
  assert.equal(resolution.composer, "buildUnknownDefinitionGapReply");
  assert.match(resolution.reply, /does not define arbitrary external entities/i);
  assert.doesNotMatch(resolution.reply, /^not in Joz's knowledge base is not/i);
});

test("ambiguous follow-up prompts return a clarification guard instead of a random profile answer", async () => {
  const resolution = await resolveUnknownJozReply({
    input: "How does Joz do it?",
    messages: [
      { role: "user", content: "How does Joz do it?" },
    ],
    openai: null,
    roleAwareContext: {
      retrievedDocuments: [],
    },
  });

  assert.equal(resolution.fallbackUsed, false);
  assert.equal(resolution.composer, "buildAmbiguousFollowUpReply");
  assert.equal(resolution.answerSource, "ambiguity_guard");
  assert.match(resolution.reply, /too ambiguous on its own/i);
  assert.match(resolution.reply, /How does Joz architect agentic AI/i);
  assert.doesNotMatch(resolution.reply, /Slovak|British heritage|University of Central Lancashire|MSc/i);
});

test("punctuated ambiguous follow-up prompts still return the clarification guard", async () => {
  for (const prompt of ["How would he do that?", "Why does he do that?"]) {
    const resolution = await resolveUnknownJozReply({
      input: prompt,
      messages: [{ role: "user", content: prompt }],
      openai: null,
      roleAwareContext: {
        retrievedDocuments: [],
      },
    });

    assert.equal(resolution.fallbackUsed, false);
    assert.equal(resolution.composer, "buildAmbiguousFollowUpReply");
    assert.match(resolution.reply, /too ambiguous on its own/i);
  }
});

test("router keeps ambiguous why-do-it follow-ups in unknown fallback so profile lanes cannot hijack them", () => {
  const { appContext, legacyContext } = buildContexts({ currentPortal: "meet-joz", currentMesh: "skills" });
  const prompt = "why does Joz do it?";
  const route = routeJozLlmQuery({
    input: prompt,
    appContext,
    legacyContext,
  });

  assert.equal(route.selectedRoute, "unknown_fallback");
  assert.equal(route.detectedSubIntent, "ambiguous_follow_up");
});
