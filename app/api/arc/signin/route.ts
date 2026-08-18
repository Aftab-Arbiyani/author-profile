import { NextResponse } from "next/server";
import {
  checkAndStampMagicLinkThrottle,
  createMagicLinkToken,
  getArcReader,
} from "@/lib/arc";
import { sendMagicLinkEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

/**
 * Every outcome below the validation check returns this same body. Whether the
 * address is unknown, revoked, or throttled must be indistinguishable to the
 * caller — otherwise the endpoint becomes a directory of who is an ARC reader.
 */
const GENERIC_OK = { ok: true, status: "sent" };

export async function POST(req: Request) {
  let email = "";
  let honeypot = "";

  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
    honeypot = typeof body?.company === "string" ? body.company.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (honeypot) {
    return NextResponse.json(GENERIC_OK);
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const reader = await getArcReader(email);

  if (!reader || reader.status !== "active") {
    console.warn("[arc/signin] no active reader for the submitted address");
    return NextResponse.json(GENERIC_OK);
  }

  const throttle = await checkAndStampMagicLinkThrottle(email);

  if (throttle !== "ok") {
    console.warn(`[arc/signin] send suppressed (${throttle})`);
    return NextResponse.json(GENERIC_OK);
  }

  const token = await createMagicLinkToken(email);

  if (!token) {
    return NextResponse.json(
      { error: "Sign-in isn't available right now." },
      { status: 503 },
    );
  }

  // The raw token only ever exists in this URL — never logged, never stored.
  const result = await sendMagicLinkEmail(
    email,
    `${SITE_URL}/arc/verify?token=${token}`,
  );

  if (result === "not-configured") {
    return NextResponse.json(
      { error: "Sign-in email isn't configured yet. Please contact the author." },
      { status: 503 },
    );
  }

  if (result === "error") {
    return NextResponse.json(
      { error: "Couldn't send the email. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(GENERIC_OK);
}
