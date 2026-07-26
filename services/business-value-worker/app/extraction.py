from __future__ import annotations

import base64
import hashlib
import io
import re
import zipfile
from datetime import datetime, timezone
from typing import Any

from .diagnostic import NODE_DEFINITIONS

MAX_FILE_BYTES = 8 * 1024 * 1024


def _decode_pdf_fallback(raw: bytes) -> str:
    text = raw.decode("latin1", errors="ignore")
    values = re.findall(r"\(((?:\\.|[^\\)])*)\)\s*Tj", text)
    return " ".join(value.replace(r"\(", "(").replace(r"\)", ")") for value in values)


def extract_text(file_name: str, mime_type: str, encoded: str) -> tuple[str, str, int]:
    payload = encoded.split(",", 1)[-1]
    raw = base64.b64decode(payload, validate=True)
    if not raw or len(raw) > MAX_FILE_BYTES:
        raise ValueError(f"File must be between 1 byte and {MAX_FILE_BYTES} bytes")
    extension = file_name.lower().rsplit(".", 1)[-1] if "." in file_name else ""
    if extension in {"txt", "md", "markdown", "csv", "json"} or mime_type.startswith("text/"):
        return raw.decode("utf-8", errors="replace").strip(), "text", len(raw)
    if extension == "docx" or "wordprocessingml" in mime_type:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        paragraphs = []
        for paragraph in re.split(r"<w:p(?:\s[^>]*)?>", xml, flags=re.I)[1:]:
            values = re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", paragraph, flags=re.I | re.S)
            value = re.sub(r"<[^>]+>", "", "".join(values)).strip()
            if value:
                paragraphs.append(value)
        return "\n".join(paragraphs), "docx", len(raw)
    if extension == "pdf" or mime_type == "application/pdf":
        try:
            from pypdf import PdfReader

            pages = PdfReader(io.BytesIO(raw)).pages
            content = "\n".join(page.extract_text() or "" for page in pages).strip()
        except ImportError:
            content = _decode_pdf_fallback(raw)
        return content, "pdf", len(raw)
    raise ValueError("Supported evidence files are TXT, Markdown, CSV, JSON, PDF, and DOCX")


def extract_document(request: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    content, document_format, byte_count = extract_text(request.fileName, request.mimeType, request.data)
    if not content:
        raise ValueError(f"No readable text was extracted from {request.fileName}")
    if len(content) > 200_000:
        raise ValueError("Extracted document exceeds 200000 characters")
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    document_id = f"bvd-{content_hash[:24]}"
    ingested_at = datetime.now(timezone.utc).isoformat()
    candidates = []
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", content) if part.strip()]
    normalized = content.lower()
    for node, definition in NODE_DEFINITIONS.items():
        for evidence_id, label, terms in definition["evidence"]:
            snippets = [sentence for sentence in sentences if any(term.lower() in sentence.lower() for term in terms)][:3]
            if snippets:
                candidates.append({
                    "evidenceKey": f"{node}.{evidence_id}",
                    "node": node,
                    "label": label,
                    "value": {"documentId": document_id, "title": request.fileName, "snippets": snippets, "extraction": "python_term_match"},
                    "sourceType": "uploaded_file",
                    "sourceRef": request.sourceRef or request.fileName,
                    "verificationStatus": "unverified",
                    "collectedAt": ingested_at,
                })
    return {
        "documentId": document_id,
        "fileName": request.fileName,
        "mimeType": request.mimeType,
        "title": request.fileName,
        "sourceType": "uploaded_file",
        "sourceRef": request.sourceRef or request.fileName,
        "companyKey": request.companyKey,
        "contentHash": content_hash,
        "characterCount": len(content),
        "byteCount": byte_count,
        "format": document_format,
        "ingestedAt": ingested_at,
        "verificationStatus": "unverified",
    }, candidates
