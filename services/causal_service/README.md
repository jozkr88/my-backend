# Joz Causal Decision Service

This service is the causal-analysis boundary for Joz LLM. It keeps graph
storage, causal computation, and language generation separate.

## Local setup

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r services/causal_service/requirements.txt
uvicorn causal_service.app:app --app-dir services --host 127.0.0.1 --port 8010
```

The Node runtime connects only when `JOZ_CAUSAL_MODE` is explicitly set to
`shadow`, `augment`, or `decision_support`. The default is disabled.

## Safety boundary

`causal-learn` and `Tigramite` propose candidate structures. They do not prove
causality. DoWhy-GCM should only run against a versioned dataset, explicit
assumptions, a causal model, and a recorded provenance chain.

## First executable operation

`POST /v1/causal/intervene` accepts a directed acyclic graph, observed tabular
data, an intervention, and a target variable. It fits a DoWhy-GCM structural
causal model and returns a target distribution summary plus its assumptions.

`POST /v1/causal/effect` accepts the same versioned graph/data boundary plus an
explicit treatment, outcome, treatment value, and control value. It returns a
model-based average treatment effect, standard error, distribution summaries,
and assumptions. The result is an estimate, not a production claim; it should
be refuted and reviewed before high-impact use.

`POST /v1/causal/counterfactual` accepts a factual observation and an explicit
intervention. It performs abduction, action, and prediction with an invertible
DoWhy-GCM structural model and returns the factual value, counterfactual value,
delta, and model assumptions. Individual-level uncertainty is identified as
not estimated rather than implied.

`POST /v1/causal/refute` tests the supplied DAG against observed data using
edge-dependence and local-Markov checks with false-discovery-rate adjustment.
It returns `refuted` or `not_refuted`; `not_refuted` means the tested
assumptions were not rejected, not that causality has been proven.

`POST /v1/causal/discover` supports `pc` through causal-learn and `pcmci`
through Tigramite. Those endpoints produce candidate structures with an
explicit `DISCOVERED_ASSOCIATION` status.

This endpoint is not exposed directly to the browser. The Joz Node gateway must
enforce authorization, dataset scope, and approval policy before calling it.
The gateway accepts runtime datasets only through the versioned
`joz.causal-dataset.v1` contract: dataset ID, model version, tenant, an
acyclic graph, and numeric observations are validated and checksummed before
the payload reaches FastAPI.

Datasets can be published to PostgreSQL with:

```text
npm run publish:causal-dataset -- path/to/dataset.json published
```

The publisher supports `draft`, `validated`, `published`, and `deprecated`
states. Computational tools resolve published versions by dataset ID and model
version when no raw dataset is supplied in request context.

Read-only graph exploration tools are kept in the Node application layer so
they can return bounded UI-ready graph data without making the FastAPI service
the source of truth. The current registry provides neighbourhood, causal-path,
claim-inspection, governed effect-estimation, and governed counterfactual
operations, plus governed refutation; the result remains advisory until the
model, data, assumptions, and evidence are reviewed.

## Cloud Run deployment

The service can run separately from the Render Node gateway. Build the existing
Dockerfile from the repository root and deploy the resulting image to Cloud Run:

```bash
export PROJECT_ID="your-gcp-project"
export REGION="europe-west6"
export REPOSITORY="joz"
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/causal-service:latest"

gcloud auth login
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION"
gcloud builds submit --config services/causal_service/cloudbuild.yaml --substitutions=_IMAGE="$IMAGE" .
gcloud run deploy joz-causal-service \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated
```

The API requires `Authorization: Bearer <token>` when `CAUSAL_SERVICE_TOKEN`
is set. Store that value in Google Secret Manager and attach it to Cloud Run,
then set the same token in Render as `JOZ_CAUSAL_SERVICE_TOKEN`. Set the Cloud
Run HTTPS URL as `JOZ_CAUSAL_SERVICE_URL` and set
`JOZ_CAUSAL_MODE=decision_support` in Render.
