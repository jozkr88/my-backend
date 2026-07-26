export function redactJozFixtureText(value = "") {
  let text = String(value || "")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[PHONE]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[ID]")
    .replace(/\b(?:api[_ -]?key|token|secret|password|private key)\s*[:=]?\s*\S+/gi, "[REDACTED]")
    .replace(/\b(?:joz(?:ef)?\s+krupa)\b/gi, "[PERSON]")
    .replace(/\b(?:my name is|i am|i'm)\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?/gi, "[NAME]")
    .replace(/\b(account|order|invoice|ticket|case)\s*#?\s*[A-Z0-9-]{4,}\b/gi, "$1 [REFERENCE]")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 700);
}

export function isSafeJozFixtureText(raw = "", redacted = "") {
  if (!redacted || redacted.length < 3) return false;
  if (/\[EMAIL\]|\[PHONE\]|\[IP\]/.test(redacted)) return false;
  if (/\b(?:password|secret|private key|seed phrase|social security|passport number)\b/i.test(raw)) return false;
  return true;
}
