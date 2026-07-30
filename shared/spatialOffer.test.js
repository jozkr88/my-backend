import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSpatialAssetManifest,
  buildSpatialLaunchUrl,
  getSpatialOfferDefinition,
  normalizeSpatialEntitySet,
  publicSpatialOffer,
} from "./spatialOffer.js";

test("normalizes supported spatial entity set aliases", () => {
  assert.equal(normalizeSpatialEntitySet("neurons"), "joz_neurons");
  assert.equal(normalizeSpatialEntitySet("joz-skills"), "joz_skills");
  assert.equal(normalizeSpatialEntitySet("work"), "joz_works");
  assert.equal(normalizeSpatialEntitySet("mogg"), null);
});

test("builds canonical expiring offer launch URLs", () => {
  assert.equal(
    buildSpatialLaunchUrl({
      entitySet: "neurons",
      offerId: "offer-1",
      origin: "https://meetjoz.com/",
    }),
    "https://meetjoz.com/space/joz-neurons?mode=ar&offer=offer-1"
  );
});

test("builds a platform asset manifest from the server registry", () => {
  const manifest = buildSpatialAssetManifest({
    entitySet: "joz_neurons",
    offerId: "offer-2",
    origin: "https://meetjoz.com",
  });

  assert.equal(manifest.entitySet, "joz_neurons");
  assert.equal(manifest.assets.ios.format, "usdz");
  assert.equal(manifest.assets.android.format, "glb");
  assert.equal(manifest.entities.length, 4);
});

test("public offer response strips storage-only fields", () => {
  const definition = getSpatialOfferDefinition("skills");
  const offer = publicSpatialOffer({
    offer_id: "offer-3",
    entity_set: definition.entitySet,
    mode: "ar",
    asset_manifest: buildSpatialAssetManifest({
      entitySet: definition.entitySet,
      offerId: "offer-3",
    }),
    graph_evidence: { sourcePaths: ["data/joz/inbox/skills-agentic-ai-architecture.md"] },
    metadata: { internal: true },
    expires_at: "2026-07-31T00:00:00.000Z",
  });

  assert.equal(offer.offerId, "offer-3");
  assert.equal(offer.metadata, undefined);
  assert.deepEqual(offer.graphEvidence.sourcePaths, [
    "data/joz/inbox/skills-agentic-ai-architecture.md",
  ]);
});

