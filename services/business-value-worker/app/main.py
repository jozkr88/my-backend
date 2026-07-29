from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from .extraction import extract_document
from .models import (
    DiagnosticResponse,
    DiagnosticRunRequest,
    DocumentExtractRequest,
    EvidenceReviewRequest,
    ExtractResponse,
    ExtractedDocument,
)
from .workflow import DiagnosticWorkflow

workflow = DiagnosticWorkflow(
    os.getenv("BUSINESS_VALUE_DATABASE_URL"),
    require_database=os.getenv("BUSINESS_VALUE_REQUIRE_DATABASE", "false").lower() == "true",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    workflow.close()


app = FastAPI(title="Joz Business Value Diagnostic Worker", version="0.1.0", lifespan=lifespan)


def require_worker_auth(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("BUSINESS_VALUE_WORKER_TOKEN", "").strip()
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Worker authentication required")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "workflowRuntime": workflow.runtime}


@app.post("/v1/evidence/extract", response_model=ExtractResponse, dependencies=[Depends(require_worker_auth)])
def extract_evidence(request: DocumentExtractRequest):
    try:
        document, candidates = extract_document(request)
    except (ValueError, KeyError, UnicodeError, OSError, EOFError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"document": ExtractedDocument(**document), "candidates": candidates}


@app.post("/v1/diagnostics/{case_id}/run", response_model=DiagnosticResponse, dependencies=[Depends(require_worker_auth)])
def run_diagnostic(case_id: str, request: DiagnosticRunRequest):
    state = workflow.run(request.model_dump(), thread_id=case_id)
    return {"caseId": case_id, "state": state, "execution": {"workflowRuntime": workflow.runtime, "durableCheckpoint": workflow.durable_checkpoint}}


@app.post("/v1/diagnostics/{case_id}/review", response_model=DiagnosticResponse, dependencies=[Depends(require_worker_auth)])
def review_diagnostic(case_id: str, request: EvidenceReviewRequest):
    records = [item.model_dump() for item in request.evidenceRecords]
    reviewed = next((item for item in records if item["evidenceKey"] == request.evidenceKey), None)
    if reviewed is None:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    reviewed["verificationStatus"] = request.verificationStatus
    state = workflow.run({
        "input": "",
        "messages": [],
        "currentMesh": request.currentMesh or reviewed["node"],
        "evidenceRecords": records,
        "reviewApproved": request.verificationStatus == "verified",
        "priorState": request.priorState,
    }, thread_id=case_id)
    return {"caseId": case_id, "state": state, "execution": {"workflowRuntime": workflow.runtime, "durableCheckpoint": workflow.durable_checkpoint, "reviewedEvidenceKey": request.evidenceKey}}
