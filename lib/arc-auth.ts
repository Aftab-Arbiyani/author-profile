import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getArcReader, type ArcReader } from "@/lib/arc";

/**
 * ARC reader session — a second, separate principal from the admin session in
 * lib/admin-auth.ts. Same HMAC-signed-cookie design, but with a per-reader
 * identity (email) baked into the signed value and a dedicated secret
 * (ARC_SESSION_SECRET — never BLOG_ADMIN_SECRET, which doubles as the admin
 * password).
 */

const COOKIE_NAME = "arc_reader_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getArcSecret() {
  return process.env.ARC_SESSION_SECRET;
}

/** Whether reader sign-in can work at all. Mirrors `hasEmailConfig()`. */
export function hasArcAuthConfig() {
  return Boolean(getArcSecret());
}

/** Constant-time string equality that never throws on a length mismatch. */
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Cookie value: `<base64url(email)>.<expiresAt>.<hmac>`. The HMAC signs both
 * the email and the expiry, so neither can be forged, swapped, or extended.
 * Base64url-encoding the email keeps the `.` delimiter unambiguous and the
 * cookie charset safe.
 */
function signSession(secret: string, emailLower: string, expiresAt: number) {
  const mac = createHmac("sha256", secret)
    .update(`arc-reader.${emailLower}.${expiresAt}`)
    .digest("hex");
  return `${Buffer.from(emailLower).toString("base64url")}.${expiresAt}.${mac}`;
}

/** Returns the session's email when the cookie is valid, otherwise null. */
function parseSession(secret: string, value: string | undefined): string | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  let email: string;
  try {
    email = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expiresAt = Number(parts[1]);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  if (!safeEqual(value, signSession(secret, email, expiresAt))) {
    return null;
  }

  return email;
}

/**
 * The email in the reader's session cookie, verified by signature and expiry
 * only. Most callers want requireActiveReader() instead, which also checks the
 * reader still exists and hasn't been revoked.
 */
export async function getArcSessionEmail(): Promise<string | null> {
  const secret = getArcSecret();

  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  return parseSession(secret, cookieStore.get(COOKIE_NAME)?.value);
}

/** True when the reader's granted reading window has closed. */
export function isAccessExpired(reader: ArcReader): boolean {
  if (!reader.accessExpiresAt) {
    // Grandfathered: readers approved before expiry existed never lapse.
    return false;
  }

  const expiresAt = Date.parse(reader.accessExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

/**
 * Full reader guard for protected pages and server actions: valid session
 * cookie AND a live `arcReaders` doc with status "active" whose reading window
 * is still open. Re-reading the doc on every request makes revocation and
 * expiry immediate — the cookie alone never grants access.
 */
export async function requireActiveReader(): Promise<ArcReader | null> {
  const email = await getArcSessionEmail();

  if (!email) {
    return null;
  }

  const reader = await getArcReader(email);

  if (!reader || reader.status !== "active" || isAccessExpired(reader)) {
    return null;
  }

  return reader;
}

/**
 * Guard for the review surfaces: a live, non-revoked reader, whose reading
 * window may since have closed.
 *
 * Expiry deliberately does not apply here. It exists to close off the
 * unpublished manuscript, and a review written a few days after finishing is
 * the entire point of the programme — locking someone out of writing it because
 * their reading window lapsed would throw away the thing we were asking for.
 */
export async function requireReviewingReader(): Promise<ArcReader | null> {
  const email = await getArcSessionEmail();

  if (!email) {
    return null;
  }

  const reader = await getArcReader(email);

  return reader && reader.status === "active" ? reader : null;
}

/**
 * The reader behind the current session regardless of status or expiry, for the
 * one surface that needs to explain *why* access stopped rather than bouncing
 * to sign-in. Never use this as a guard.
 */
export async function getSessionReader(): Promise<ArcReader | null> {
  const email = await getArcSessionEmail();
  return email ? getArcReader(email) : null;
}

/** Sets the session cookie after a successful magic-link redemption. */
export async function loginArcReader(email: string) {
  const secret = getArcSecret();

  if (!secret) {
    return false;
  }

  const emailLower = email.trim().toLowerCase();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signSession(secret, emailLower, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
  });

  return true;
}

export async function logoutArcReader() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
