from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(default="", max_length=200_000)


class EvidenceRecord(BaseModel):
    evidenceKey: str
    node: Literal["data", "control", "oversight", "adoption"]
    label: str | None = None
    value: dict[str, Any] = Field(default_factory=dict)
    sourceType: str = "company_document"
    sourceRef: str | None = None
    verificationStatus: Literal["unverified", "claimed", "corroborated", "verified", "rejected"] = "unverified"


class DocumentExtractRequest(BaseModel):
    fileName: str = Field(default="uploaded-document", max_length=240)
    mimeType: str = "application/octet-stream"
    data: str = Field(min_length=1)
    sourceRef: str | None = Field(default=None, max_length=500)
    companyKey: str | None = Field(default=None, max_length=200)


class DiagnosticRunRequest(BaseModel):
    input: str = Field(default="", max_length=200_000)
    messages: list[Message] = Field(default_factory=list)
    currentMesh: str | None = None
    evidenceRecords: list[EvidenceRecord] = Field(default_factory=list)
    reviewApproved: bool = False
    priorState: dict[str, Any] | None = None


class EvidenceReviewRequest(BaseModel):
    evidenceRecords: list[EvidenceRecord] = Field(default_factory=list)
    evidenceKey: str
    verificationStatus: Literal["claimed", "corroborated", "verified", "rejected"] = "verified"
    currentMesh: str | None = None
    priorState: dict[str, Any] | None = None


class ExtractedDocument(BaseModel):
    documentId: str
    fileName: str
    mimeType: str
    format: Literal["text", "pdf", "docx"]
    title: str
    sourceType: str
    sourceRef: str | None = None
    companyKey: str | None = None
    contentHash: str
    byteCount: int
    characterCount: int
    ingestedAt: str
    verificationStatus: str = "unverified"


class EvidenceCandidate(EvidenceRecord):
    collectedAt: str | None = None


class ExtractResponse(BaseModel):
    document: ExtractedDocument
    candidates: list[EvidenceCandidate]


class DiagnosticResponse(BaseModel):
    caseId: str
    state: dict[str, Any]
    execution: dict[str, Any]
