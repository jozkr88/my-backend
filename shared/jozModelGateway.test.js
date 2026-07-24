import test from "node:test";
import assert from "node:assert/strict";
import {
  createJozModelGateway,
  getJozModelRuntimeDescriptor,
} from "./jozModelGateway.js";

test("routes OpenAI-compatible calls through the hosted client", async () => {
  const calls = [];
  const gateway = createJozModelGateway({
    provider: "openai",
    apiKey: "test-key",
    model: "test-hosted-model",
    client: {
      chat: {
        completions: {
          create: async (request) => {
            calls.push(request);
            return { choices: [{ message: { content: "ok" } }] };
          },
        },
      },
    },
  });

  const result = await gateway.chat.completions.create({
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(result.choices[0].message.content, "ok");
  assert.equal(calls[0].model, "test-hosted-model");
  assert.equal(gateway.describe().architecture, "decoder-only-transformer");
  assert.equal(gateway.describe().dataBoundary, "joz-control-plane");
});

test("routes self-hosted transformer calls through an OpenAI-compatible endpoint", async () => {
  const calls = [];
  const gateway = createJozModelGateway({
    provider: "transformers",
    baseUrl: "http://transformer.internal/v1",
    apiKey: "local-key",
    model: "qwen-test",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "local response" } }] }),
      };
    },
  });

  const result = await gateway.complete({
    temperature: 0,
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(result.choices[0].message.content, "local response");
  assert.equal(calls[0].url, "http://transformer.internal/v1/chat/completions");
  assert.equal(JSON.parse(calls[0].options.body).model, "qwen-test");
  assert.equal(calls[0].options.headers.Authorization, "Bearer local-key");
  assert.equal(getJozModelRuntimeDescriptor(gateway).provider, "self_hosted_transformer");
});

test("does not claim a transformer provider is available without an endpoint", () => {
  const gateway = createJozModelGateway({ provider: "transformers", model: "qwen-test" });
  assert.equal(gateway.isAvailable(), false);
  assert.equal(gateway.describe().available, false);
});

