import { createRemoteJWKSet, jwtVerify } from "jose";

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function getIssuer() {
  const url = getSupabaseUrl();
  return url ? `${url}/auth/v1` : null;
}

function isAuthRequired() {
  return process.env.JOZ_REQUIRE_AUTH === "true" || process.env.NODE_ENV === "production";
}

let remoteJwks = null;

function getRemoteJwks() {
  if (!remoteJwks) {
    const issuer = getIssuer();
    if (!issuer) return null;
    remoteJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return remoteJwks;
}

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  return /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || null;
}

export async function verifyJozAccessToken(token) {
  const issuer = getIssuer();
  if (!issuer) throw new Error("SUPABASE_URL is not configured");

  const jwtSecret = String(process.env.SUPABASE_JWT_SECRET || "").trim();
  const key = jwtSecret
    ? new TextEncoder().encode(jwtSecret)
    : getRemoteJwks();
  if (!key) throw new Error("Configure SUPABASE_JWT_SECRET or Supabase JWKS access");

  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience: "authenticated",
    ...(jwtSecret ? { algorithms: ["HS256"] } : {}),
  });

  if (!payload.sub) throw new Error("JWT has no subject");
  return {
    userId: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : "authenticated",
    claims: payload,
  };
}

export async function authenticateJozRequest(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    if (!isAuthRequired()) return next();
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.jozAuth = await verifyJozAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
}

export function requireJozAuth(req, res, next) {
  if (!isAuthRequired()) return authenticateJozRequest(req, res, next);
  return authenticateJozRequest(req, res, next);
}

export function isJozAuthRequired() {
  return isAuthRequired();
}
