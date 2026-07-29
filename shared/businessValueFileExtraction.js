import crypto from "node:crypto";
import zlib from "node:zlib";

export const MAX_BUSINESS_VALUE_FILE_BYTES = 8 * 1024 * 1024;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function decodeBase64(value = "") {
  const encoded = String(value || "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!encoded || !/^[a-z\d+/]+=*$/i.test(encoded)) throw new Error("Invalid base64 file payload");
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length) throw new Error("Uploaded file is empty");
  if (buffer.length > MAX_BUSINESS_VALUE_FILE_BYTES) {
    throw new Error(`File exceeds ${MAX_BUSINESS_VALUE_FILE_BYTES} bytes`);
  }
  return buffer;
}

function readZipEntry(buffer, wantedName) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid DOCX container");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  let cursor = centralOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (buffer.readUInt32LE(cursor) !== centralSignature) throw new Error("Invalid DOCX directory");
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);
    cursor += 46 + fileNameLength + extraLength + commentLength;
    if (name !== wantedName) continue;
    if (buffer.readUInt32LE(localOffset) !== localSignature) throw new Error("Invalid DOCX entry");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    if (compression === 0) return compressed;
    if (compression === 8) return zlib.inflateRawSync(compressed);
    throw new Error("Unsupported DOCX compression");
  }
  throw new Error("DOCX document.xml was not found");
}

function extractDocxText(buffer) {
  const xml = readZipEntry(buffer, "word/document.xml").toString("utf8");
  const paragraphs = xml
    .split(/<w:p(?:\s[^>]*)?>/i)
    .slice(1)
    .map((paragraph) => {
      const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi)]
        .map((match) => decodeEntities(match[1]))
        .join("");
      return clean(text);
    })
    .filter(Boolean);
  return paragraphs.join("\n");
}

function decodePdfString(value = "") {
  return String(value || "")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractPdfText(buffer) {
  const pieces = [];
  const streamPattern = /stream\r?\n/g;
  let match;
  while ((match = streamPattern.exec(buffer.toString("latin1")))) {
    const start = match.index + match[0].length;
    const end = buffer.indexOf(Buffer.from("endstream"), start);
    if (end < 0) break;
    const raw = buffer.subarray(start, end);
    const header = buffer.toString("latin1", Math.max(0, match.index - 240), match.index);
    let stream = raw;
    if (/\/FlateDecode/.test(header)) {
      try {
        stream = zlib.inflateSync(raw);
      } catch {
        stream = null;
      }
    }
    if (stream) {
      const text = stream.toString("latin1");
      for (const textMatch of text.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
        pieces.push(decodePdfString(textMatch[1]));
      }
      for (const arrayMatch of text.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
        for (const stringMatch of arrayMatch[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
          pieces.push(decodePdfString(stringMatch[1]));
        }
      }
    }
    streamPattern.lastIndex = end + 9;
  }
  return pieces.map(clean).filter(Boolean).join(" ");
}

export function extractBusinessValueFile({
  fileName = "uploaded-document",
  mimeType = "application/octet-stream",
  data = "",
} = {}) {
  const buffer = decodeBase64(data);
  const normalizedName = String(fileName || "uploaded-document").trim().slice(0, 240);
  const extension = normalizedName.toLowerCase().split(".").pop();
  let content;
  let format;
  if (["txt", "md", "markdown", "csv", "json"].includes(extension) || /^text\//i.test(mimeType)) {
    content = buffer.toString("utf8");
    format = "text";
  } else if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    content = extractDocxText(buffer);
    format = "docx";
  } else if (extension === "pdf" || mimeType === "application/pdf") {
    content = extractPdfText(buffer);
    format = "pdf";
  } else {
    throw new Error("Supported evidence files are TXT, Markdown, CSV, JSON, PDF, and DOCX");
  }
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) throw new Error(`No readable text was extracted from ${normalizedName}`);
  return {
    fileName: normalizedName,
    mimeType,
    format,
    content: normalizedContent,
    contentHash: crypto.createHash("sha256").update(normalizedContent).digest("hex"),
    byteCount: buffer.length,
  };
}
