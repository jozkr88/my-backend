import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGovernanceMetadata,
  buildSourceRegistry,
  evidenceTierForStatus,
  isDocumentAllowedForTenant,
  sanitizeSourceUri,
} from "./jozDataGovernance.js";
import { isSafeJozFixtureText, redactJozFixtureText } from "./jozPrivacy.js";

test("governance metadata creates a public evidence record without internal paths", () => {
  const metadata = buildGovernanceMetadata({
    body: "A source body",
    sourceFilename: "profile.md",
    sourceUri: "/Users/example/.codex/attachments/secret/pasted-text.txt",
    verificationStatus: "verified",
  });

  assert.equal(metadata.dataset_id, "joz-public-knowledge");
  assert.equal(metadata.tenant_id, "public");
  assert.equal(metadata.classification, "public");
  assert.equal(metadata.visibility, "public");
  assert.equal(metadata.evidence_tier, "verified_fact");
  assert.equal(metadata.source_uri, "source://joz/profile.md");
  assert.match(metadata.source_checksum, /^[a-f0-9]{64}$/);
});

test("evidence tiers distinguish verified facts from framework guidance", () => {
  assert.equal(evidenceTierForStatus("verified"), "verified_fact");
  assert.equal(evidenceTierForStatus("framework_supported"), "framework_guidance");
  assert.equal(evidenceTierForStatus("needs_review"), "unverified");
});

test("retrieval rejects cross-tenant and restricted documents", () => {
  const base = { metadata: { tenant_id: "customer-a", dataset_id: "customer-a-kb", visibility: "public" } };
  assert.equal(isDocumentAllowedForTenant(base, { tenantId: "customer-a", datasetId: "customer-a-kb" }), true);
  assert.equal(isDocumentAllowedForTenant(base, { tenantId: "customer-b", datasetId: "customer-a-kb" }), false);
  assert.equal(isDocumentAllowedForTenant({ ...base, metadata: { ...base.metadata, visibility: "restricted" } }, { tenantId: "customer-a", datasetId: "customer-a-kb" }), false);
});

test("source registry groups records into auditable source entries", () => {
  const records = [
    {
      slug: "one",
      source_type: "paste",
      body: "one",
      metadata: {
        source_filename: "source.md",
        source_uri: "source://joz/source.md",
        dataset_id: "joz-public-knowledge",
        tenant_id: "public",
        evidence_tier: "verified_fact",
        source_checksum: "a",
      },
    },
    {
      slug: "two",
      source_type: "paste",
      body: "two",
      metadata: {
        source_filename: "source.md",
        source_uri: "source://joz/source.md",
        dataset_id: "joz-public-knowledge",
        tenant_id: "public",
        evidence_tier: "framework_guidance",
        source_checksum: "b",
      },
    },
  ];
  const registry = buildSourceRegistry(records);
  assert.equal(registry.length, 1);
  assert.equal(registry[0].record_count, 2);
  assert.equal(registry[0].model_ready_count, 2);
  assert.equal(registry[0].verified_count, 1);
  assert.deepEqual(registry[0].evidence_tiers, ["framework_guidance", "verified_fact"]);
});

test("fixture redaction does not emit replacement-group artifacts", () => {
  const redacted = redactJozFixtureText("My name is Jane Doe. My account ABC12345 has token=secret-value.");
  assert.doesNotMatch(redacted, /\$1/);
  assert.doesNotMatch(redacted, /secret-value/);
  assert.match(redacted, /\[NAME\]/);
  assert.match(redacted, /\[REDACTED\]/);
  assert.match(redacted, /account \[REFERENCE\]/i);
  assert.equal(isSafeJozFixtureText("hello", "hello"), true);
});
