import { useEffect, useMemo, useState } from "react";

import { apiUrl, fetchJson } from "../../utils/api";

const INSPECTOR_MODES = new Set(["off", "developer", "showcase"]);
const SENSITIVE_KEYS = /^(input|prompt|messages|content|token|authorization|cookie|headers?|rawheaders?|session(id)?|conversation(id)?|database(id)?|userContext|cameraState|cameraFrame|arMetadata|email|phone|name|audio|image|frame|biometric|physical(room)?|private|secret|system(prompt)?|connection(string|details)?|security(rules?)?)$/i;
const ID_KEYS = /^(session(id)?|conversation(id)?|database(id)?|request(id)?|user(id)?|visitor(id)?)$/i;

export function getWorldModelInspectorMode(env = typeof process !== "undefined" ? process.env : {}) {
  const configured = String(env?.REACT_APP_JOZ_WORLD_MODEL_INSPECTOR || "showcase")
    .trim()
    .toLowerCase();
  if (!INSPECTOR_MODES.has(configured)) return "showcase";
  if (configured === "developer" && env?.NODE_ENV === "production") return "off";
  return configured;
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function redactValue(value, key = "", mode = "showcase", depth = 0) {
  if (depth > 6 || SENSITIVE_KEYS.test(key)) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 24)
      .map((item) => redactValue(item, "", mode, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.slice(0, 180);
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([entryKey]) => !SENSITIVE_KEYS.test(entryKey))
      .filter(([entryKey]) => mode !== "showcase" || !ID_KEYS.test(entryKey))
      .map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey, mode, depth + 1),
      ])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
}

export function redactWorldModelTelemetry(value, mode = "showcase") {
  if (!value || typeof value !== "object") return null;
  const safe = redactValue(clone(value), "", mode);
  return safe && typeof safe === "object" ? safe : null;
}

function readTelemetryFromWindow(mode) {
  if (typeof window === "undefined") return null;
  const prediction = redactWorldModelTelemetry(window.__lastWorldPrediction, mode);
  const observation = redactWorldModelTelemetry(window.__lastWorldObservation, mode);
  if (!prediction?.trajectoryId && !prediction?.traceId) return null;
  return { prediction, observation };
}

function telemetryKey(telemetry) {
  return telemetry?.prediction?.trajectoryId ||
    telemetry?.prediction?.traceId ||
    telemetry?.prediction?.recordedAt ||
    null;
}

export function useWorldModelTelemetry(mode) {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (mode === "off" || typeof window === "undefined") return undefined;

    const update = (detail = null) => {
      const next = detail?.prediction
        ? {
            prediction: redactWorldModelTelemetry(detail.prediction, mode),
            observation: redactWorldModelTelemetry(detail.observation || window.__lastWorldObservation, mode),
          }
        : readTelemetryFromWindow(mode);
      if (!next?.prediction) return;
      setTelemetry(next);
      const key = telemetryKey(next);
      if (!key) return;
      setHistory((current) => {
        const nextHistory = [
          { key, ...next, receivedAt: new Date().toISOString() },
          ...current.filter((item) => item.key !== key),
        ];
        return nextHistory.slice(0, 12);
      });
    };

    update();
    const handleObserved = (event) => update(event.detail);
    window.addEventListener("world-prediction-observed", handleObserved);
    return () => window.removeEventListener("world-prediction-observed", handleObserved);
  }, [mode]);

  useEffect(() => {
    if (mode === "off" || typeof window === "undefined") return undefined;
    let cancelled = false;

    const pollCompletedPrediction = async () => {
      const current = readTelemetryFromWindow(mode);
      const trajectoryId = current?.prediction?.trajectoryId;
      if (!trajectoryId || current?.prediction?.pending !== true) return;

      try {
        const result = await fetchJson(
          apiUrl(`/api/world-model/predictions/${encodeURIComponent(trajectoryId)}`)
        );
        if (cancelled || result?.ready !== true || !result.prediction) return;

        window.__lastWorldPrediction = {
          ...window.__lastWorldPrediction,
          ...result.prediction,
          pending: false,
        };
        window.dispatchEvent(
          new CustomEvent("world-prediction-observed", {
            detail: {
              prediction: window.__lastWorldPrediction,
              observation: window.__lastWorldObservation || null,
            },
          })
        );
      } catch {
        // Shadow telemetry is optional; keep the live interaction unaffected.
      }
    };

    const interval = window.setInterval(pollCompletedPrediction, 250);
    void pollCompletedPrediction();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode]);

  return { telemetry, history };
}

function text(value, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function count(value, fallback = "Unknown") {
  return Array.isArray(value) ? value.length : fallback;
}

function actionLabel(action) {
  if (!action) return "Unknown";
  if (typeof action === "string") return action;
  return action.type || action.action || action.id || "Unknown";
}

function actionTarget(action) {
  if (!action || typeof action === "string") return null;
  return action.target || action.targetRoute || null;
}

function stateFromObservation(observation, prediction) {
  return observation?.symbolicState || prediction?.initialState || {};
}

function verificationState(prediction) {
  if (!prediction) return "Prediction unavailable";
  const difference = prediction.observationDifference || prediction.predictionError;
  if (!difference) return prediction.pending || prediction.observedState || prediction.observedObservation
    ? "Verification pending"
    : "Not yet observed";
  if (difference.success === false || difference.matches === false) return "Observed result differed";
  return "Prediction verified";
}

function confidenceValue(candidate) {
  const value = candidate?.confidence ?? candidate?.score?.confidence;
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : "Unknown";
}

function safeStatus(value) {
  return value === true ? "Match" : value === false ? "Mismatch" : "Pending";
}

function comparisonRows(prediction) {
  const difference = prediction?.observationDifference || prediction?.predictionError;
  const differences = Array.isArray(difference?.differences) ? difference.differences : [];
  const stateBefore = prediction?.selected?.predictedState || {};
  const observed = prediction?.observedState || {};
  const findDifference = (field) => differences.find((item) => String(item.field || "").toLowerCase().includes(field));
  const row = (label, predicted, actual, field) => {
    const mismatch = findDifference(field);
    return {
      label,
      predicted: text(predicted),
      observed: text(actual),
      result: mismatch ? (mismatch.severity === "acceptable_difference" ? "Within tolerance" : "Mismatch") : difference ? "Match" : "Pending",
    };
  };

  return [
    row("Portal", stateBefore.portal, observed.portal, "portal"),
    row("Stage", stateBefore.stage, observed.stage, "stage"),
    row("Focus", stateBefore.focusedEntityId, observed.focusedEntityId, "focus"),
    row("Overlays", stateBefore.environment?.activeOverlays?.join(", "), observed.environment?.activeOverlays?.join(", "), "overlay"),
    row("Visible objects", count(stateBefore.visibleEntityIds), count(observed.visibleEntityIds), "visible"),
  ];
}

function Metric({ label, value }) {
  return (
    <div className="joz-world-inspector__metric">
      <span>{label}</span>
      <strong>{text(value)}</strong>
    </div>
  );
}

function Stage({ name, tone, children }) {
  return (
    <section className={`joz-world-inspector__stage joz-world-inspector__stage--${tone}`}>
      <div className="joz-world-inspector__stage-heading">
        <span className="joz-world-inspector__stage-dot" aria-hidden="true" />
        <h3>{name}</h3>
      </div>
      <div className="joz-world-inspector__stage-body">{children}</div>
    </section>
  );
}

export function WorldModelTraceCard({ telemetry, onOpen }) {
  const prediction = telemetry?.prediction;
  if (!prediction?.trajectoryId && !prediction?.traceId) return null;
  const candidates = Array.isArray(prediction.candidates) ? prediction.candidates : [];
  const selected = prediction.selected;
  const status = verificationState(prediction);
  const confidence = confidenceValue(selected);
  const futureCount = candidates.length || prediction.candidateCount || 0;
  return (
    <button type="button" className="joz-world-trace" onClick={onOpen} aria-label="View World Model trace">
      <span className="joz-world-trace__eyebrow">World Model Trace</span>
      <span className="joz-world-trace__summary">
        {prediction.pending ? "Prediction pending" : `${futureCount} futures simulated`} · {confidence} confidence · {status}
      </span>
      <span className="joz-world-trace__link">View simulation →</span>
    </button>
  );
}

export function WorldModelInspectorView({ telemetry, history = [], mode, onBack }) {
  const prediction = telemetry?.prediction || null;
  const observation = telemetry?.observation || null;
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const observedState = stateFromObservation(observation, prediction);
  const candidates = Array.isArray(prediction?.candidates) ? prediction.candidates : [];
  const probabilisticCandidates = prediction?.probabilistic?.candidates || [];
  const selected = prediction?.selected || null;
  const plannerSelected = prediction?.plannerSelected || null;
  const approvedAction = prediction?.approvedAction || prediction?.deterministicApprovedAction || null;
  const plannerAction = plannerSelected?.actions?.[0] || null;
  const selectedAction = selected?.actions?.[0] || null;
  const agreement = plannerAction && approvedAction
    ? actionLabel(plannerAction) === actionLabel(approvedAction)
    : null;
  const difference = prediction?.observationDifference || prediction?.predictionError;
  const metrics = difference?.metrics || {};
  const candidatesForDisplay = candidates.length ? candidates : probabilisticCandidates;
  const observationTime = prediction?.observedAt || observation?.observedAt || prediction?.recordedAt;
  const verification = verificationState(prediction);

  const historyItems = useMemo(() => history.slice(0, 12), [history]);

  const simulateNextGovernedAction = async () => {
    if (isSimulating || typeof window === "undefined") return;
    setIsSimulating(true);
    setSimulationError("");
    try {
      const appState = window.__appState || {};
      const result = await fetchJson(apiUrl("/api/agentic"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "mogg",
          context: {
            ...appState,
            currentPortal: appState.currentPortal || window.location.pathname,
            worldObservation: window.__lastWorldObservation || null,
          },
        }),
      });
      if (!result?.prediction?.trajectoryId) {
        throw new Error("No shadow prediction was returned");
      }
      window.__lastWorldPrediction = {
        ...result.prediction,
        recordedAt: result.prediction.recordedAt || new Date().toISOString(),
      };
      window.dispatchEvent(
        new CustomEvent("world-prediction-observed", {
          detail: {
            prediction: window.__lastWorldPrediction,
            observation: window.__lastWorldObservation || null,
          },
        })
      );
    } catch (error) {
      setSimulationError(error?.message || "Shadow simulation unavailable");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="joz-world-inspector" aria-label="World Model Inspector">
      <div className="joz-world-inspector__header">
        <div>
          <p className="joz-world-inspector__eyebrow">Governed predictive world model</p>
          <h2>World Model · Shadow</h2>
          <p className="joz-world-inspector__description">
            Simulates possible futures; deterministic guardrails control execution.
          </p>
        </div>
        <button type="button" className="joz-world-inspector__back" onClick={onBack}>
          Ask Joz
        </button>
      </div>

      {!prediction ? (
        <div className="joz-world-inspector__empty" role="status">
          <p>{mode === "developer" ? "No world-model telemetry yet." : "Ask Joz or navigate to create a shadow trace."}</p>
          <button
            type="button"
            className="joz-world-inspector__simulate-button"
            onClick={simulateNextGovernedAction}
            disabled={isSimulating}
          >
            {isSimulating ? "Simulating…" : "Simulate next governed action"}
          </button>
          {simulationError && <p className="joz-world-inspector__error">{simulationError}</p>}
        </div>
      ) : (
        <>
          <div className="joz-world-inspector__progress" aria-label="World Model stages">
            {["Observed", "Simulated", "Selected", "Executed", "Verified"].map((stage) => (
              <span key={stage}>{stage}</span>
            ))}
          </div>

          <Stage name="Observed" tone="observed">
            <div className="joz-world-inspector__metrics">
              <Metric label="Portal" value={observedState.portal} />
              <Metric label="Stage" value={observedState.stage} />
              <Metric label="Focus" value={observedState.focusedEntityId} />
              <Metric label="Visible objects" value={count(observedState.visibleEntityIds)} />
              <Metric label="Overlays" value={count(observedState.environment?.activeOverlays)} />
              <Metric label="Actions" value={count(observedState.availableActionIds)} />
            </div>
            <p className="joz-world-inspector__muted">Observed {text(observationTime, "Not yet observed")}</p>
          </Stage>

          <Stage name="Simulated" tone="simulated">
            <div className="joz-world-inspector__candidate-list">
              {candidatesForDisplay.length ? candidatesForDisplay.map((candidate, index) => {
                const candidateAction = candidate.actions?.[0];
                return (
                  <div className="joz-world-inspector__candidate" key={`${actionLabel(candidateAction)}-${index}`}>
                    <div>
                      <strong>{actionLabel(candidateAction)}</strong>
                      {actionTarget(candidateAction) && <span>{actionTarget(candidateAction)}</span>}
                    </div>
                    <div className="joz-world-inspector__candidate-meta">
                      <span>{confidenceValue(candidate)}</span>
                      <span>{text(candidate.score?.risk ?? candidate.expectedRisk, "Unknown")} risk</span>
                      <span>{text(candidate.score?.total, "Unknown")} score</span>
                      {candidate.valid && <span className="joz-world-inspector__candidate-tag">valid</span>}
                    </div>
                  </div>
                );
              }) : <p className="joz-world-inspector__muted">Prediction unavailable or pending.</p>}
            </div>
            <p className="joz-world-inspector__muted">Rollout depth: {text(prediction.probabilistic?.maxDepth, "Unknown")}</p>
          </Stage>

          <Stage name="Selected" tone="selected">
            <div className="joz-world-inspector__metrics">
              <Metric label="Shadow preference" value={actionLabel(plannerAction)} />
              <Metric label="Approved action" value={actionLabel(approvedAction || selectedAction)} />
              <Metric label="Agreement" value={agreement === null ? "Unknown" : agreement ? "Yes" : "No"} />
              <Metric label="Confidence" value={confidenceValue(selected)} />
            </div>
            <p className="joz-world-inspector__muted">Shadow selection never controls execution.</p>
          </Stage>

          <Stage name="Executed" tone="executed">
            <div className="joz-world-inspector__metrics">
              <Metric label="Approved action" value={actionLabel(approvedAction)} />
              <Metric label="Status" value={prediction.pending ? "Pending" : prediction.observedState ? "Observed" : "Not yet observed"} />
              <Metric label="Duration" value={prediction.transitionDurationMs ? `${prediction.transitionDurationMs} ms` : "Unknown"} />
            </div>
            <p className="joz-world-inspector__muted">Existing deterministic executor remains authoritative.</p>
          </Stage>

          <Stage name="Verified" tone="verified">
            <div className="joz-world-inspector__verification-status" role="status">
              {verification}
            </div>
            <div className="joz-world-inspector__comparison" role="table" aria-label="Predicted versus observed">
              <div className="joz-world-inspector__comparison-row joz-world-inspector__comparison-row--heading" role="row">
                <span>Field</span><span>Predicted</span><span>Observed</span><span>Result</span>
              </div>
              {comparisonRows(prediction).map((item) => (
                <div className="joz-world-inspector__comparison-row" role="row" key={item.label}>
                  <span>{item.label}</span><span>{item.predicted}</span><span>{item.observed}</span><span>{item.result}</span>
                </div>
              ))}
            </div>
            <p className="joz-world-inspector__muted">
              Transforms: {metrics.transformCompared ? "Compared with existing 0.02 tolerance" : "Unknown"} ·
              Relationships: {metrics.spatialRelationshipAccuracy === undefined ? "Unknown" : "Observed"} ·
              Guardrails: {prediction.approvedAction ? "Deterministically approved" : "Unknown"}
            </p>
          </Stage>

          {!!historyItems.length && (
            <details className="joz-world-inspector__history">
              <summary>Recent traces ({historyItems.length})</summary>
              {historyItems.map((item, index) => (
                <div className="joz-world-inspector__history-item" key={item.key || index}>
                  <span>{item.prediction?.approvedAction || actionLabel(item.prediction?.selected?.actions?.[0])}</span>
                  <span>{verificationState(item.prediction)}</span>
                </div>
              ))}
            </details>
          )}

          {mode === "developer" && (
            <details className="joz-world-inspector__diagnostics">
              <summary>Developer diagnostics</summary>
              <pre>{JSON.stringify({
                prediction,
                observation,
                schemaVersion: prediction.version,
                modelVersion: prediction.modelVersion,
                transitionRuleVersion: prediction.transitionRuleVersion,
                shadowLatencyMs: prediction.shadowLatencyMs,
                sampled: prediction.sampled,
                persistenceStatus: prediction.persistenceStatus,
              }, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
