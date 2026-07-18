import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "author_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function getAdminSecret() {
  return process.env.BLOG_ADMIN_SECRET;
}

/** Constant-time string equality that never throws on a length mismatch. */
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Session cookie value: `<expiresAt>.<hmac>`, where the HMAC signs the expiry
 * so it can't be forged or extended. Baking the expiry into the signed value
 * means the token self-expires — it's no longer a single constant string that
 * re-authenticates forever if it ever leaks.
 */
function signSession(secret: string, expiresAt: number) {
  const mac = createHmac("sha256", secret)
    .update(`author-admin.${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${mac}`;
}

function isValidSession(secret: string, value: string | undefined) {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(value.slice(0, dot));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(value, signSession(secret, expiresAt));
}

export async function isAdminAuthenticated() {
  const secret = getAdminSecret();

  if (!secret) {
    return false;
  }

  const cookieStore = await cookies();
  return isValidSession(secret, cookieStore.get(COOKIE_NAME)?.value);
}

export async function loginAdmin(password: string) {
  const secret = getAdminSecret();

  if (!secret || !safeEqual(password, secret)) {
    return false;
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signSession(secret, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
  });

  return true;
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
