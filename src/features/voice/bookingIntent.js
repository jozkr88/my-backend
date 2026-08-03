const BOOKING_REQUEST_PATTERNS = [
  /\b(?:book|schedule|arrange|organize|set up)\b.{0,40}\b(?:joz|meeting|call|time|appointment|chat)\b/i,
  /\b(?:meet|speak|talk)\s+(?:with|to)\s+joz\b/i,
];

export function isBookingRequest(value = "") {
  const text = String(value || "").trim();
  return Boolean(text) && BOOKING_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}
