import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "author_admin_session";

function getAdminSecret() {
  return process.env.BLOG_ADMIN_SECRET;
}

function createSessionValue(secret: string) {
  return createHmac("sha256", secret).update("author-admin").digest("hex");
}

export async function isAdminAuthenticated() {
  const secret = getAdminSecret();

  if (!secret) {
    return false;
  }

  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === createSessionValue(secret);
}

export async function loginAdmin(password: string) {
  const secret = getAdminSecret();

  if (!secret || password !== secret) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return true;
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
