import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJozCausalToolSelectionPrompt,
  isLikelyJozCausalToolRequest,
  selectJozCausalTool,
} from "./jozCausalToolSelection.js";

test("causal tool selection is gated to causal questions", async () => {
  let called = false;
  const result = await selectJozCausalTool({
    model: { isAvailable: () => { called = true; return true; } },
    input: "Tell me about Joz's career.",
  });
  assert.equal(result.status, "not_applicable");
  assert.equal(called, false);
  assert.equal(isLikelyJozCausalToolRequest("What evidence supports this causal relationship?"), true);
});

test("LLM causal tool calls are schema-bound and independently validated", async () => {
  let request;
  const result = await selectJozCausalTool({
    model: {
      isAvailable: () => true,
      chat: {
        completions: {
          create: async (value) => {
            request = value;
            return {
              choices: [{
                message: {
                  tool_calls: [{
                    function: {
                      name: "inspect_causal_claim",
                      arguments: JSON.stringify({ relationship_id: "semantic-graph-causal-engine-separation" }),
                    },
                  }],
                },
              }],
            };
          },
        },
      },
    },
    input: "What evidence supports this causal relationship?",
  });
  assert.equal(result.status, "selected");
  assert.equal(result.toolName, "inspect_causal_claim");
  assert.equal(result.args.relationship_id, "semantic-graph-causal-engine-separation");
  assert.equal(request.tool_choice, "auto");
  assert.ok(request.tools.some((tool) => tool.function.name === "inspect_causal_claim"));
  assert.match(buildJozCausalToolSelectionPrompt(), /independently validate/i);
});

test("malformed or unknown model tool calls are rejected before execution", async () => {
  const result = await selectJozCausalTool({
    model: {
      isAvailable: () => true,
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { tool_calls: [{ function: { name: "run_cypher", arguments: "{}" } }] } }],
          }),
        },
      },
    },
    input: "What causal evidence supports this?",
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.errorCode, "UNKNOWN_CAUSAL_TOOL");
});
