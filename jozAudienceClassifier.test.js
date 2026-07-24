import test from "node:test";
import assert from "node:assert/strict";
import { classifyJozAudience } from "./shared/jozAudienceClassifier.js";

test("classifies business owners without changing answer routing", () => {
  const profile = classifyJozAudience({ input: "I run a retail business and need to reduce operating costs" });
  assert.equal(profile.persona.id, "business_owner");
  assert.equal(profile.aiKnowledge.id, "business_aware");
  assert.equal(profile.audienceAgents.length, 5);
  assert.equal(profile.audienceAgents.filter((agent) => agent.selected).length, 1);
  assert.ok(profile.persona.confidence > 0.5);
});

test("classifies recruiters and hiring managers separately", () => {
  assert.equal(
    classifyJozAudience({ input: "I am a recruiter building a candidate pipeline" }).persona.id,
    "recruiter"
  );
  assert.equal(
    classifyJozAudience({ input: "My team is hiring an AI engineer" }).persona.id,
    "hiring_manager"
  );
});

test("classifies technical AI language at specialist or architect level", () => {
  const specialist = classifyJozAudience({ input: "How should we evaluate an LLM RAG system with vector retrieval?" });
  assert.equal(specialist.persona.id, "ai_specialist");
  assert.equal(specialist.aiKnowledge.id, "ai_specialist");

  const architect = classifyJozAudience({ input: "Design an agentic architecture with governance and human-in-the-loop execution" });
  assert.equal(architect.aiKnowledge.id, "ai_architect");
});

test("defaults unknown short questions to a random visitor with curious knowledge level", () => {
  const profile = classifyJozAudience({ input: "Hello" });
  assert.equal(profile.persona.id, "random_visitor");
  assert.equal(profile.aiKnowledge.id, "curious");
});
