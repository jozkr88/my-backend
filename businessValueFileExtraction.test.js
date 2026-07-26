import test from "node:test";
import assert from "node:assert/strict";

import { extractBusinessValueFile } from "./shared/businessValueFileExtraction.js";

function base64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function storedDocx(documentXml) {
  const name = Buffer.from("word/document.xml");
  const content = Buffer.from(documentXml);
  const local = Buffer.alloc(30 + name.length + content.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  content.copy(local, 30 + name.length);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}

test("extracts bounded text files", () => {
  const result = extractBusinessValueFile({
    fileName: "policy.txt",
    mimeType: "text/plain",
    data: base64("Finance owns the source of truth."),
  });
  assert.equal(result.format, "text");
  assert.match(result.content, /source of truth/);
});

test("extracts text from a DOCX document.xml entry", () => {
  const docx = storedDocx(
    '<w:document><w:body><w:p><w:r><w:t>Finance owns the source of truth.</w:t></w:r></w:p><w:p><w:r><w:t>Data is refreshed daily.</w:t></w:r></w:p></w:body></w:document>'
  );
  const result = extractBusinessValueFile({
    fileName: "readiness.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    data: base64(docx),
  });
  assert.equal(result.format, "docx");
  assert.match(result.content, /Finance owns the source of truth/);
  assert.match(result.content, /Data is refreshed daily/);
});

test("extracts basic PDF text operators", () => {
  const pdf = Buffer.from("%PDF-1.4\nstream\n(Finance owns the source of truth.) Tj\nendstream\n%%EOF");
  const result = extractBusinessValueFile({
    fileName: "readiness.pdf",
    mimeType: "application/pdf",
    data: base64(pdf),
  });
  assert.equal(result.format, "pdf");
  assert.match(result.content, /source of truth/);
});
