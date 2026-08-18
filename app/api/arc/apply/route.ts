import { NextResponse } from "next/server";
import { addArcApplication, checkAndStampApplyThrottle } from "@/lib/arc";
import { clientKey } from "@/lib/client-key";
import {
  sendApplicationReceivedEmail,
  sendAuthorNotification,
} from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional profile links must be absolute https URLs and reasonably short. */
function validUrl(value: string) {
  return !value || (value.startsWith("https://") && value.length <= 300);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  let name = "";
  let email = "";
  let reason = "";
  let goodreadsUrl = "";
  let amazonProfileUrl = "";
  let honeypot = "";

  try {
    const body = await req.json();
    name = typeof body?.name === "string" ? body.name.trim() : "";
    email = typeof body?.email === "string" ? body.email.trim() : "";
    reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    goodreadsUrl =
      typeof body?.goodreadsUrl === "string" ? body.goodreadsUrl.trim() : "";
    amazonProfileUrl =
      typeof body?.amazonProfileUrl === "string"
        ? body.amazonProfileUrl.trim()
        : "";
    honeypot = typeof body?.company === "string" ? body.company.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field. Pretend success so bots
  // don't learn they were caught, and don't store anything.
  if (honeypot) {
    return NextResponse.json({ ok: true, status: "applied" });
  }

  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: "Please enter your name." },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (reason.length < 20 || reason.length > 1000) {
    return NextResponse.json(
      { error: "Please tell me a little more (at least 20 characters)." },
      { status: 400 },
    );
  }

  if (!validUrl(goodreadsUrl) || !validUrl(amazonProfileUrl)) {
    return NextResponse.json(
      { error: "Profile links must start with https://" },
      { status: 400 },
    );
  }

  // After validation, so a malformed request never spends the allowance, and
  // before any write or send, which is the thing being rationed. Reports the
  // same success body as a real application: an abuser learns nothing about the
  // limit, and a genuine second submission from a shared address sees the same
  // reassuring message it would have seen anyway.
  if ((await checkAndStampApplyThrottle(await clientKey())) === "limited") {
    console.warn("[arc/apply] submission suppressed (throttled)");
    return NextResponse.json({ ok: true, status: "applied" });
  }

  const result = await addArcApplication({
    email,
    name,
    reason,
    goodreadsUrl,
    amazonProfileUrl,
  });

  switch (result) {
    case "ok":
      // Best-effort notifications — a mail failure must never turn a stored
      // application into an error for the applicant.
      await sendApplicationReceivedEmail(email, name);
      await sendAuthorNotification(
        "New ARC reader application",
        `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) applied to the ARC program.</p><p>${escapeHtml(reason)}</p><p><a href="/admin/arc">Review it in the admin →</a></p>`,
      );
      return NextResponse.json({ ok: true, status: "applied" });
    case "duplicate":
      return NextResponse.json({ ok: true, status: "already" });
    case "not-configured":
      return NextResponse.json(
        { error: "Applications aren't available right now." },
        { status: 503 },
      );
    default:
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
  }
}
