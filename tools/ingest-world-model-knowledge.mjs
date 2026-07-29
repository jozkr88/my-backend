import crypto from "node:crypto";
import {
  getWorldModelKnowledgeManifest,
  loadWorldModelKnowledgeRecords,
  validateWorldModelKnowledge,
} from "../shared/worldModelKnowledge.js";

const validation = validateWorldModelKnowledge();
if (!validation.ok) {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}

const first = loadWorldModelKnowledgeRecords();
const second = loadWorldModelKnowledgeRecords();
const fingerprint = (records) => crypto
  .createHash("sha256")
  .update(JSON.stringify(records.map((record) => ({
    slug: record.slug,
    sourceType: record.source_type,
    body: record.body,
    sourcePages: record.metadata?.source_pages || [],
  }))))
  .digest("hex");
const firstFingerprint = fingerprint(first);
const secondFingerprint = fingerprint(second);
const result = {
  ok: firstFingerprint === secondFingerprint,
  validation,
  manifest: getWorldModelKnowledgeManifest(),
  generated_record_count: first.length,
  source_type_counts: first.reduce((counts, record) => {
    counts[record.source_type] = (counts[record.source_type] || 0) + 1;
    return counts;
  }, {}),
  stable_fingerprint: firstFingerprint,
  idempotent_second_fingerprint: secondFingerprint,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
