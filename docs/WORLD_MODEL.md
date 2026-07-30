# Predictive spatial world model

## Current capability

The application now contains a hybrid neuro-symbolic world-model layer. The symbolic runtime remains authoritative for legal actions, deterministic state transitions, execution, and guardrails. The experience layer observes completed interactions and estimates alternative next states from persisted transition outcomes.

The accurate product description is:

> A governed spatial agent with an explicit world-state model and a shadow probabilistic transition model.

This is not a claim that the application contains a neural foundation model or a generally capable learned world model.

## Runtime flow

```text
current app state
  -> canonical symbolic state
  -> legal candidate actions
  -> deterministic simulation and guardrail approval
  -> queue shadow probabilistic next-state prediction after the response boundary
  -> existing executor performs only the approved action
  -> observation adapter records the result
  -> trajectory reconciliation and experience aggregation
```

The predictive layer never authorizes or executes an action. Its outputs are telemetry and planning evidence until separately validated.

Prediction traces expose both the highest-scoring valid simulated plan (`plannerSelected`) and the deterministic approved plan (`selected`). This makes any difference between model preference and executable action visible without silently changing runtime behavior.

## Implemented components

- `shared/worldSimulator.js`: canonical state, deterministic transitions, symbolic rollouts, plan scoring, and prediction comparison.
- `shared/worldExperience.js`: Laplace-smoothed transition probabilities, symbolic fallback for unseen transitions, multi-step branching rollouts, plan scoring, Brier score, and expected calibration error.
- `shared/worldTrajectory.js`: versioned serializable trajectory records, privacy-safe state serialization, and predicted-versus-observed reconciliation.
- `POST /api/world-model/trajectories`: observation ingestion and persistence.
- `world_model_trajectories`: one record per observed action trajectory.
- `world_transition_experience`: aggregate transition evidence keyed by state, action, and observed outcome.
- `src/state/useAppRuntimeState.js`: frontend observation adapter for portal and stage changes.
- `tools/evaluate-world-model.mjs`: deterministic regression fixture report and persisted-trajectory evaluation.
- `tools/export-world-model-dataset.mjs`: read-only JSONL export with privacy filtering, manifest checksums, and session/journey splits.
- `shared/worldModelControls.js`: sampling, payload, retention, classification, and bot/development controls.
- `shared/learnedWorldModel.js`: a versioned, session-isolated structured transition learner that estimates observed next-state distributions from eligible trajectories, with held-out evaluation and explicit minimum-sample limitations.
- `tools/train-world-model.mjs`: reproducible training/evaluation CLI for privacy-safe trajectory JSONL exports.
- `src/features/voice/worldModelInspector.js`: optional read-only inspector embedded in the existing Joz MAXX popup.

## Learned transition model

The application now has a real trainable model component, but it is deliberately opt-in and shadow-only. `learned-structured-transition-v1` learns a probability distribution for a canonical state/action pair from observed outcomes. It is not a neural network, foundation model, or claim of general physical-world understanding. It is an application-level learned transition model inside the larger hybrid system.

Train it only from privacy-safe observed trajectory exports; synthetic, invalid, unsupported, and explicitly test-labelled rows are excluded by default:

```text
npm run train:world-model -- \
  --input ./world-model-dataset/train.jsonl \
  --output ./data/joz/published/learned-world-model.json
```

The Render blueprint can train directly from the durable `world_model_trajectories` table during a deploy when `JOZ_WORLD_MODEL_LEARNED_ENABLED=true`. It refuses to publish an empty artifact; the source row count, training count, held-out sample count, and evaluation meaningfulness are reported by `/api/world-model/status`.

The trainer writes a model artifact and a held-out evaluation report. Sessions are hashed into train/validation/test partitions so one session cannot leak across splits. The evaluation report remains non-meaningful until the configured minimum test count is reached. A real production claim requires a sufficiently large held-out set, coverage across the deployed state/action space, calibrated probabilities, and repeated prediction-versus-observation reconciliation.

To load the artifact in shadow mode:

```text
JOZ_WORLD_MODEL_LEARNED_ENABLED=true
JOZ_WORLD_MODEL_ARTIFACT_PATH=data/joz/published/learned-world-model.json
```

When loaded, `/api/world-model/status` reports the learned model version and training counts, and `/api/agentic` exposes its candidates under `prediction.learnedTransitionModel`. The deterministic symbolic simulator, guardrails, approval, and executor remain authoritative. No learned prediction can execute an action.

## Structured scene observation

The browser observer reads only structured application data already present in the runtime:

- React application state and the existing portal/stage/mesh globals;
- React Three Fiber scene, named visible objects, local transforms, parent-child links;
- the active Three.js camera pose/projection and renderer viewport dimensions;
- existing overlay and AR support metadata.

`shared/worldObservation.js` defines the versioned serialisable observation schema. `SceneObservationBridge` exposes a bounded snapshot when the scene state changes; it does not capture screenshots, camera imagery, microphone audio, native handles, or continuous sensor streams. Unknown fields are recorded in `missingFields` and never treated as prediction failures.

Predicted observations are derived from the symbolic transition, the current structured observation, and an optional scene manifest. Unsupported portal geometry, AR anchors, physical-world relationships, and hidden objects remain unknown rather than being fabricated.

## Predicted-observation reconciliation

After the existing deterministic action runs, the browser captures a structured observation and posts it with the trajectory. Reconciliation compares:

- portal, stage, focus, overlays, and stable visible-object identifiers;
- object position, rotation, and scale using a tolerance of `0.02` per component;
- normalized parent-child/spatial relationship keys where both sides support them.

Results distinguish exact matches, acceptable differences, unknown/unsupported fields, and genuine errors. Identifier order and `meet_joz`/`meet-joz` aliases are normalized. Reconciliation is telemetry only and cannot block or alter execution.

Experience lookups are parallelized with a 50 ms shadow timeout per request; a timeout or persistence failure falls back to the symbolic model. Shadow computation is deferred after the agentic response is sent, and trajectory persistence is separately bounded by a configurable timeout. Neither can change the approved action or delay the live response. A client observation can arrive before the deferred prediction; the trajectory upsert reconciles the two halves by trajectory ID.

The trajectory schema is extended additively with `observationBefore`, `predictedObservation`, `observedObservation`, `observationDifference`, source versions, planner/approved-action provenance, candidate plans, classification, failure category, persistence status, sampling, and latency fields. Observation payloads are bounded by `JOZ_WORLD_MODEL_MAX_TRAJECTORY_BYTES`; object/relationship collections are capped by the observation adapter.

## Production controls

Conservative defaults are applied in the backend. Local development remains off unless `.env.local` opts into shadow mode. Render/production defaults to shadow mode, and the checked-in Render blueprint sets it explicitly; `JOZ_WORLD_MODEL_MODE=off` remains the rollback switch. Override the controls explicitly in the deployment environment:

```text
JOZ_WORLD_MODEL_MODE=off|shadow
JOZ_WORLD_MODEL_SAMPLE_RATE=0.25
JOZ_WORLD_MODEL_MAX_TRAJECTORY_BYTES=250000
JOZ_WORLD_MODEL_MAX_HISTORY=20
JOZ_WORLD_MODEL_MAX_CANDIDATES=8
JOZ_WORLD_MODEL_MAX_ROLLOUT_DEPTH=4
JOZ_WORLD_MODEL_PERSISTENCE_TIMEOUT_MS=250
JOZ_WORLD_MODEL_RETENTION_DAYS=30
JOZ_WORLD_MODEL_EXCLUDE_DEV=true
JOZ_WORLD_MODEL_SESSION_HASH_SALT=<stable-secret>
REACT_APP_JOZ_WORLD_MODEL_MODE=off|shadow
REACT_APP_JOZ_WORLD_MODEL_INSPECTOR=off|developer|showcase
```

Verify the deployed runtime without a shell:

```text
GET https://<backend-host>/api/world-model/status
```

The response reports mode, model and transition-rule versions, sampling, persistence, observation boundaries, and the execution policy.

Health-check, crawler, bot, preview, and development traffic can be excluded. Session keys are hashed before storage; raw prompts, headers, tokens, email addresses, phone numbers, imagery, audio, biometric data, and camera frames are not trajectory fields. Retention cleanup removes expired trajectories and transition experience rows through the existing maintenance path. `isTest`, `isSynthetic`, unsupported fields, and failed observations remain explicitly classified; unsupported is not treated as model error.

The database migration is additive only: new nullable/defaulted columns and indexes are created after the existing trajectory table. There is no destructive migration and no live-action dependency on the new columns.

## Evaluation and operations

`node tools/evaluate-world-model.mjs` reports symbolic metrics plus structured observation metrics for portal/stage accuracy, visible-object precision/recall/F1, unexpected and missing objects, transforms, relationships, coverage, unknown-field rate, capture failure rate, reconciliation latency, and guardrail violations. Against persisted records, run:

```text
node tools/evaluate-world-model.mjs --input exported-trajectories.jsonl
```

The persisted report includes total/valid/excluded records, sessions, date range, classification/failure counts, portal/stage/next-state accuracy, planner agreement, transform error, prediction coverage, unsupported rate, latencies, payload size, and guardrail counts. Every metric includes sample count, coverage, and a `meaningful` flag. The documented minimum is 10 eligible samples per metric; the production release gate should use a larger agreed threshold per state/action transition. Invalid actions are blocked-action evidence, not successful predictions.

Export a privacy-safe dataset directly from the database with a read-only query:

```text
node tools/export-world-model-dataset.mjs \
  --output ./world-model-dataset \
  --from 2026-07-29T00:00:00Z \
  --to 2026-08-01T00:00:00Z \
  --schema-version 1.0
```

For local fixtures, add `--input tools/fixtures/world-model-trajectories.json`. The exporter writes `train.jsonl`, `validation.jsonl`, `test.jsonl`, and `manifest.json`; a stable session/journey hash keeps one journey in one split and excludes direct identifiers. The controlled synthetic catalogue is separate at `tools/fixtures/world-model-scenarios.json` and must not be mixed into production accuracy claims.

Set both the backend and frontend mode to off for rollback:

```text
JOZ_WORLD_MODEL_MODE=off
REACT_APP_JOZ_WORLD_MODEL_MODE=off
```

In off mode the observer, prediction computation, trajectory endpoint, and new persistence path are disabled. Existing responses, navigation, animations, AR launch behavior, approvals, and guardrails remain on the baseline path. Persistence failures and observer failures are isolated from live execution.

## Configuration

The production execution policy is shadow-only: prediction and plan scoring may run, but deterministic guardrails still approve and execute the live action. To disable it:

```text
JOZ_WORLD_MODEL_MODE=off
```

To disable prediction and trajectory recording while keeping the existing deterministic agent active:

```text
JOZ_WORLD_MODEL_MODE=off
```

No production path currently allows the probabilistic layer to replace deterministic approval. Any future online use must add an explicit rollout gate, compare predictions with observed outcomes, and preserve the existing action allowlist.

## Popup inspector

The inspector is integrated into the existing Joz MAXX popup rather than exposed as a second route or dashboard. It defaults to `showcase`, a privacy-safe view, and can be explicitly disabled with the frontend flag `off`. In `developer` mode it is available only in non-production builds and provides collapsed, redacted diagnostics; `showcase` mode presents only curated privacy-safe fields. The World Model view includes a read-only simulation entry point; it does not execute the selected action.

The popup reuses the existing `world-prediction-observed` browser event and the compatibility globals `window.__lastWorldObservation` and `window.__lastWorldPrediction`. The inspector maintains at most 12 in-memory safe snapshots for the current browser session. It polls only for completion of the read-only shadow prediction, does not execute actions, alter the chat pipeline, or read persisted database history.

The displayed progression is `Observed → Simulated → Selected → Executed → Verified`. Shadow preference and deterministic approved action are shown separately, and verification is only reported after the existing predicted-versus-observed reconciliation is present. Missing or unsupported fields are rendered as `Unknown`, `Not observed`, or `Pending`; they are never converted to zero or treated as success.

To inspect it locally without enabling it publicly:

```text
JOZ_WORLD_MODEL_MODE=shadow JOZ_WORLD_MODEL_SAMPLE_RATE=1 JOZ_WORLD_MODEL_EXCLUDE_DEV=false node index.js
REACT_APP_JOZ_WORLD_MODEL_MODE=shadow REACT_APP_JOZ_WORLD_MODEL_INSPECTOR=developer npm run dev
```

Open the existing Joz MAXX popup at `http://localhost:3000`, trigger a governed navigation, and choose `World Model`. Return to `Ask Joz` to confirm the conversation and input remain intact. The inspector is presentation-only; closing it or disabling the flag leaves chat and deterministic execution unchanged. It respects reduced-motion preferences and uses tab semantics, textual status labels, keyboard-focus states, and touch-sized controls.

## Release and rollback checklist

1. Apply the additive schema through the normal application startup migration or `render-postgres-schema.sql`; verify the new columns and indexes before collection.
2. Set the stable session-hash salt, retention, payload, sampling, timeout, and exclusion environment variables. Do not put secrets in source or frontend variables.
3. Run baseline health, response, navigation, animation, and AR checks with the deterministic path; use `JOZ_WORLD_MODEL_MODE=off` for a strict baseline comparison.
4. Keep Render in `shadow` mode after the baseline is clean. Confirm `/api/world-model/status`, trajectory `persistence_status`, classifications, payload sizes, and latency from logs/database.
5. Run the read-only export and persisted evaluation. Check that no exported record contains direct identifiers, prompts, tokens, or raw media.
6. Release only if baseline behavior is unchanged, persistence is within the timeout budget, payload/retention limits are active, and the evaluation report has sufficient valid coverage. No neural model or online planner activation is a release gate here.

Rollback is: set both mode variables to `off`, redeploy/restart, verify the deterministic baseline, then retain or prune shadow rows according to the retention policy. If schema rollback is required, leave the additive columns in place and roll back application code; do not drop columns during an incident. Export before any manual deletion, and use the retention/prune path rather than broad table deletion.

## Known release risks

- The application process is the current scheduler for retention cleanup; a dedicated scheduled maintenance invocation is preferable on Render.
- In-memory fallback data is bounded and ephemeral, so it is not a durable dataset.
- The dataset is application-level structured state, not a general physical-world model: continuous AR perception, exogenous events, causal interventions, and learned visual dynamics remain out of scope.

Proposed commit message: `Prepare governed spatial world model for shadow trajectory collection`

## Evaluation

Run the baseline fixture report with:

```text
node tools/evaluate-world-model.mjs
```

The report includes next-state accuracy, top-k accuracy, Brier score, expected calibration error, multi-step rollout uncertainty, portal/stage mismatch rate, and guardrail violations. The fixture is a regression check only. Real calibration requires enough persisted trajectories across each state/action/outcome combination.

## Data and privacy boundaries

Trajectory records contain state, action, prediction, expected effects, observed state/effects, timing, and aggregate outcome fields. Raw user input is deliberately not included in the trajectory payload. User context is reduced to non-sensitive intent, goal, and interests fields before serialization.

The current browser observation adapter records portal and stage changes. Camera and AR observations are not yet interpreted as continuous sensor streams. The AR launcher remains an execution surface; it is not itself a learned visual perception model.

## Known limitations and next validation steps

- Experience is observational and count-based; it does not learn a neural dynamics model.
- Sparse transitions use a symbolic fallback with low confidence rather than inventing a future.
- State/action availability after a probabilistic branch is inherited from the symbolic state until the world graph supplies branch-specific legal-action sets.
- Continuous camera/AR perception, exogenous events, counterfactual interventions, and causal discovery are not implemented.
- AR is currently a launcher/native handoff surface; structured anchor and tracking feeds are unsupported unless a future native bridge supplies them explicitly.
- The future neural-model interface is an optional predictor behind the same versioned observation and reconciliation contracts. It must remain shadow-evaluated before any policy can use it.
- Production evaluation should add a held-out trajectory split, per-action confusion matrices, calibration plots, mismatch alerts, and guardrail-violation monitoring.
