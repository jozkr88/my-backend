import test from "node:test";
import assert from "node:assert/strict";
import { classifyJozAudience } from "./shared/jozAudienceClassifier.js";

test("classifies the five audience agents and knowledge levels", () => {
  const business = classifyJozAudience({ input: "I run a business and need better ROI" });
  assert.equal(business.persona.id, "business_owner");
  assert.equal(business.aiKnowledge.id, "business_aware");
  assert.equal(business.audienceAgents.length, 5);
  assert.equal(business.audienceAgents.filter((agent) => agent.selected).length, 1);
  assert.equal(classifyJozAudience({ input: "I am a recruiter building a candidate pipeline" }).persona.id, "recruiter");
  assert.equal(classifyJozAudience({ input: "My team is hiring an AI engineer" }).persona.id, "hiring_manager");
  assert.equal(classifyJozAudience({ input: "How should we evaluate an LLM RAG system?" }).aiKnowledge.id, "ai_specialist");
  assert.equal(classifyJozAudience({ input: "Design an agentic architecture with governance" }).aiKnowledge.id, "ai_architect");
  assert.equal(classifyJozAudience({ input: "Hello" }).persona.id, "random_visitor");
});
