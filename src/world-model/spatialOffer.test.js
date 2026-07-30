import {
  getOfferSpatialAssetUrls,
  normalizeSpatialEntitySet,
  normalizeSpatialOfferPayload,
  requestSemanticSpatialIntent,
  requestSpatialOffer,
} from "./spatialOffer";

test("normalizes spatial entity aliases", () => {
  expect(normalizeSpatialEntitySet("joz-skills")).toBe("joz_skills");
  expect(normalizeSpatialEntitySet("neurons")).toBe("joz_neurons");
  expect(normalizeSpatialEntitySet("mogg")).toBeNull();
});

test("normalizes backend spatial offer payloads", () => {
  expect(normalizeSpatialOfferPayload({
    persisted: true,
    mode: "database",
    offer: {
      offerId: "offer-1",
      entitySet: "joz-neurons",
      launchUrl: "https://meetjoz.com/space/joz-neurons?mode=ar&offer=offer-1",
      assets: {
        ios: { url: "https://meetjoz.com/neurodesign.usdz" },
        android: { url: "https://meetjoz.com/neurovibes.glb" },
      },
    },
  })).toMatchObject({
    offerId: "offer-1",
    entitySet: "joz_neurons",
    persisted: true,
    storageMode: "database",
  });
});

test("extracts platform asset URLs from an offer", () => {
  expect(getOfferSpatialAssetUrls({
    assets: {
      ios: { url: "https://meetjoz.com/neurodesign.usdz" },
      android: { url: "https://meetjoz.com/neurovibes.glb" },
    },
  })).toEqual({
    usdz: "https://meetjoz.com/neurodesign.usdz",
    glb: "https://meetjoz.com/neurovibes.glb",
  });
});

test("requests a backend-owned spatial offer", async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({
      ok: true,
      persisted: true,
      mode: "database",
      offer: {
        offerId: "offer-2",
        entitySet: "joz_skills",
        launchUrl: "https://meetjoz.com/space/joz-skills?mode=ar&offer=offer-2",
      },
    })),
  });

  try {
    const offer = await requestSpatialOffer({
      entitySet: "skills",
      input: "view skills around me",
    });
    expect(offer).toMatchObject({
      offerId: "offer-2",
      entitySet: "joz_skills",
      persisted: true,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/world-model/spatial-offers"),
      expect.objectContaining({ method: "POST" })
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("requests backend semantic spatial intent", async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({
      ok: true,
      matched: true,
      source: "semantic_model",
      confidence: 0.9,
      placement: {
        action: "experience_spatially",
        entitySet: "joz_neurons",
        entityLabel: "Joz's neurons",
        targetMode: "ar",
      },
    })),
  });

  try {
    const result = await requestSemanticSpatialIntent({
      input: "make this immersive",
      context: { currentPortal: "maxx" },
    });
    expect(result).toMatchObject({
      action: "experience_spatially",
      placement: {
        entitySet: "joz_neurons",
      },
      semanticIntent: {
        source: "semantic_model",
        confidence: 0.9,
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/world-model/spatial-intent"),
      expect.objectContaining({ method: "POST" })
    );
  } finally {
    global.fetch = previousFetch;
  }
});
