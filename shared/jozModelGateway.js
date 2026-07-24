const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_PROVIDER = "openai";

function normalizeProvider(value) {
  const provider = String(value || DEFAULT_PROVIDER).trim().toLowerCase();
  if (["transformers", "self_hosted_transformer", "self-hosted-transformer", "vllm", "tgi"].includes(provider)) {
    return "self_hosted_transformer";
  }
  return "openai";
}

function normalizeBaseUrl(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveConfig(overrides = {}) {
  const provider = normalizeProvider(overrides.provider || process.env.JOZ_MODEL_PROVIDER);
  const baseUrl = normalizeBaseUrl(
    overrides.baseUrl || process.env.JOZ_TRANSFORMER_BASE_URL || process.env.JOZ_MODEL_BASE_URL
  );
  const model = String(
    overrides.model ||
      (provider === "self_hosted_transformer"
        ? process.env.JOZ_TRANSFORMER_MODEL || process.env.JOZ_MODEL
        : process.env.JOZ_MODEL || process.env.JOZ_LLM_MODEL) ||
      DEFAULT_MODEL
  ).trim();

  return {
    provider,
    model: model || DEFAULT_MODEL,
    baseUrl,
    apiKey: String(
      overrides.apiKey ||
        (provider === "self_hosted_transformer"
          ? process.env.JOZ_TRANSFORMER_API_KEY || process.env.JOZ_MODEL_API_KEY
          : process.env.OPENAI_API_KEY) ||
        ""
    ).trim(),
    architecture: "decoder-only-transformer",
    protocol: provider === "self_hosted_transformer" ? "openai-compatible" : "openai",
  };
}

export function getJozModelRuntimeDescriptor(gateway = null) {
  const config = gateway?.config || resolveConfig();
  const available = typeof gateway?.isAvailable === "function"
    ? gateway.isAvailable()
    : Boolean(config.provider === "openai" ? config.apiKey : config.baseUrl);

  return {
    provider: config.provider,
    model: config.model,
    architecture: config.architecture,
    protocol: config.protocol,
    available,
    dataBoundary: "joz-control-plane",
  };
}

async function requestSelfHostedTransformer({ config, request, fetchImpl }) {
  if (!config.baseUrl) {
    throw new Error("Self-hosted transformer provider requires JOZ_TRANSFORMER_BASE_URL");
  }

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      ...request,
      model: config.model,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || `Transformer gateway returned HTTP ${response.status}`);
  }
  return body;
}

export function createJozModelGateway({ client = null, ...overrides } = {}) {
  const config = resolveConfig(overrides);
  const fetchImpl = overrides.fetchImpl || globalThis.fetch;

  const gateway = {
    config,
    isAvailable() {
      return config.provider === "openai"
        ? Boolean(client && config.apiKey)
        : Boolean(config.baseUrl && typeof fetchImpl === "function");
    },
    describe() {
      return getJozModelRuntimeDescriptor(gateway);
    },
    async complete(request = {}) {
      if (!gateway.isAvailable()) {
        throw new Error(`Joz model gateway is unavailable for provider ${config.provider}`);
      }

      if (config.provider === "self_hosted_transformer") {
        return requestSelfHostedTransformer({ config, request, fetchImpl });
      }

      return client.chat.completions.create({
        ...request,
        model: request.model || config.model,
      });
    },
    // Keep the existing OpenAI-compatible call shape while routing through the
    // selected provider. Existing deterministic/risk code can therefore stay
    // provider-agnostic.
    chat: {
      completions: {
        create: (request) => gateway.complete(request),
      },
    },
  };

  return gateway;
}

export function isJozModelGatewayAvailable(gateway = null) {
  return Boolean(gateway && typeof gateway.isAvailable === "function" && gateway.isAvailable());
}
