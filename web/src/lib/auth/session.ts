import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "akar_session";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing in env");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  orgId: string;
  email: string;
};

export async function signSession(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(getSecretKey());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload as unknown as SessionPayload;
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
  };
}

export function buildSetCookieHeader(token: string) {
  const opts = sessionCookieOptions();

  const parts = [
    `${sessionCookieName()}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
  ];

  if (opts.secure) parts.push("Secure");

  return parts.join("; ");
}

export function buildClearCookieHeader() {
  return `${sessionCookieName()}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
