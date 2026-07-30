import { useEffect, useMemo, useState } from "react";

import { apiUrl, fetchJson } from "../../utils/api";
import {
  buildPlacementObservedState,
  getPlacementEntities,
  planWorldPlacement,
} from "../../world-model/placement";
import {
  getOfferSpatialAssetUrls,
  normalizeSpatialEntitySet,
  resolveSpatialOffer,
  spatialEntitySlug,
} from "../../world-model/spatialOffer";
import { launchMaxxAr } from "../maxx/ar";

const ENTITY_LABELS = {
  joz_neurons: "Joz’s neurons",
  joz_skills: "Joz’s skills",
  joz_works: "Joz’s works",
};

function readQuery() {
  if (typeof window === "undefined") return { mode: "virtual", offer: "" };
  const query = new URLSearchParams(window.location.search);
  return {
    mode: query.get("mode") === "ar" ? "ar" : "virtual",
    offer: query.get("offer") || "",
  };
}

export function SpatialExperiencePage({ entitySet: rawEntitySet }) {
  const entitySet = normalizeSpatialEntitySet(rawEntitySet);
  const query = useMemo(readQuery, []);
  const [status, setStatus] = useState("");
  const [started, setStarted] = useState(false);
  const [offer, setOffer] = useState(null);
  const [offerError, setOfferError] = useState("");

  const plan = useMemo(() => {
    if (!entitySet) return null;
    return planWorldPlacement({
      request: {
        action: "experience_spatially",
        entitySet,
        entityLabel: ENTITY_LABELS[entitySet],
        targetMode: query.mode,
        layout: "radial",
        anchorId: query.mode === "ar" ? "current_ar_anchor" : "current_world",
        requiresApproval: true,
      },
      sceneSnapshot: {
        sceneState: { sceneId: `spatial-offer:${entitySet}` },
        arMetadata: { anchorIds: [] },
      },
    });
  }, [entitySet, query.mode]);

  useEffect(() => {
    document.title = plan ? `${ENTITY_LABELS[entitySet]} · Joz Spatial Experience` : "Joz Spatial Experience";
    return () => {
      document.title = "Joz MAXX";
    };
  }, [entitySet, plan]);

  useEffect(() => {
    if (!query.offer) return;
    let cancelled = false;
    setOffer(null);
    setOfferError("");
    resolveSpatialOffer(query.offer)
      .then((resolvedOffer) => {
        if (!cancelled) setOffer(resolvedOffer);
      })
      .catch((error) => {
        if (!cancelled) {
          setOfferError(error?.message || "Spatial offer unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query.offer]);

  const entities = useMemo(
    () => (entitySet ? getPlacementEntities(entitySet) : []),
    [entitySet]
  );

  const startExperience = async () => {
    if (!plan || started) return;
    setStarted(true);
    setStatus("Preparing the safe spatial experience…");
    const offerAssets = getOfferSpatialAssetUrls(offer);
    if (query.mode === "ar" && offerAssets?.glb) {
      launchMaxxAr({ arUsdzUrl: offerAssets.usdz, arGlbUrl: offerAssets.glb });
    }

    const before = {
      portal: "spatial-experience",
      currentStateKey: `offer:${entitySet}`,
      focusedEntityId: entitySet,
    };
    const observedState = buildPlacementObservedState({
      plan,
      previousState: before,
    });
    const action = {
      type: "experience_spatially",
      entitySet,
      targetMode: query.mode,
      anchorId: plan.anchorId,
      layout: plan.layout,
      offerId: query.offer || null,
    };
    const effects = [{
      type: "place_entity_set",
      entitySet,
      targetMode: query.mode,
      instanceIds: plan.instances.map((instance) => instance.instanceId),
    }];

    window.__worldPlacementState = {
      revision: observedState.worldRevision,
      ...observedState.placement,
      instances: plan.instances,
    };

    try {
      const recorded = await fetchJson(apiUrl("/api/world-model/trajectories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trajectoryId: `spatial-offer-${entitySet}-${Date.now()}`,
          traceId: `spatial-offer-${entitySet}`,
          stateBefore: before,
          proposedAction: action,
          symbolicPrediction: {
            actions: [action],
            predictedState: observedState,
            expectedEffects: effects,
            confidence: 0.95,
            score: { total: 0.95, risk: 0 },
          },
          expectedEffects: effects,
          observedState,
          observedEffects: effects,
          observationDifference: {
            matches: true,
            differences: [],
            metrics: { mismatchCount: 0, criticalMismatchCount: 0 },
          },
          intent: "spatial_placement",
          goal: "experience_spatially",
          interactionChannel: "qr_offer",
          offerId: query.offer || null,
          success: true,
          modelVersion: "placement-symbolic-v1",
          transitionRuleVersion: "placement-rules-v1",
          sampled: true,
          observedAt: new Date().toISOString(),
        }),
      });
      setStatus(
        `${plan.instances.length} entities ready · ${recorded?.mode || "recorded"}`
      );
    } catch (error) {
      setStatus("Preview ready; trajectory recording is temporarily unavailable.");
      console.warn("Spatial offer trajectory recording failed:", error?.message || error);
    }
  };

  if (!plan) {
    return (
      <main className="spatial-experience-page">
        <section className="spatial-experience-card">
          <p className="spatial-experience-kicker">JOZ SPATIAL EXPERIENCE</p>
          <h1>That spatial offer is not available.</h1>
          <a href="/" className="spatial-experience-link">Open meetjoz.com</a>
        </section>
      </main>
    );
  }

  return (
    <main className="spatial-experience-page">
      <section className="spatial-experience-card" aria-label="Joz spatial experience">
        <div className="spatial-experience-topline">
          <span>JOZ SPATIAL EXPERIENCE</span>
          <span className="spatial-experience-offer">{query.offer ? `OFFER ${query.offer}` : "DIRECT LINK"}</span>
        </div>
        <p className="spatial-experience-kicker">SAFE SPATIAL OFFER</p>
        <h1>{ENTITY_LABELS[entitySet]}</h1>
        <p className="spatial-experience-description">
          {offerError
            ? "This spatial offer is unavailable or expired."
            : query.mode === "ar"
            ? "AR requested. Start the experience to create a safe spatial preview on this device."
            : "A deterministic spatial preview of Joz’s knowledge layer."}
        </p>
        <div className="spatial-experience-stage" aria-label={`${ENTITY_LABELS[entitySet]} spatial preview`}>
          <div className="spatial-experience-orbit spatial-experience-orbit--outer" />
          <div className="spatial-experience-orbit spatial-experience-orbit--inner" />
          <div className="spatial-experience-core">JOZ<br /><span>MAXX</span></div>
          {plan.instances.map((instance) => (
            <div
              className={`spatial-experience-node spatial-experience-node--${instance.kind}`}
              key={instance.instanceId}
              style={{ left: `${instance.transform.x}%`, top: `${instance.transform.y}%` }}
            >
              {instance.label}
            </div>
          ))}
        </div>
        <div className="spatial-experience-meta">
          <span>{entities.length} entities</span>
          <span>{query.mode === "ar" ? "AR requested" : "Virtual world"}</span>
          <span>Radial layout</span>
        </div>
        <button
          type="button"
          className="spatial-experience-start"
          onClick={startExperience}
          disabled={started || Boolean(offerError)}
        >
          {started ? "Experience started" : "Start spatial experience"}
        </button>
        <p className="spatial-experience-status" aria-live="polite">
          {offerError || status || (query.offer && !offer ? "Resolving spatial offer..." : "Your phone remains in control. Confirm before any placement is recorded.")}
        </p>
        <a href="/" className="spatial-experience-link">Return to meetjoz.com</a>
      </section>
    </main>
  );
}

export function spatialRouteSlug(entitySet) {
  return spatialEntitySlug(entitySet);
}
