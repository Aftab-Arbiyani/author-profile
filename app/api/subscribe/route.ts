import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/firestore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let name = "";
  let email = "";
  let honeypot = "";

  try {
    const body = await req.json();
    name = typeof body?.name === "string" ? body.name.trim() : "";
    email = typeof body?.email === "string" ? body.email.trim() : "";
    honeypot = typeof body?.company === "string" ? body.company.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field. Pretend success so bots
  // don't learn they were caught, and don't store anything.
  if (honeypot) {
    return NextResponse.json({ ok: true, status: "subscribed" });
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

  const result = await addSubscriber(email, name);

  switch (result) {
    case "ok":
      return NextResponse.json({ ok: true, status: "subscribed" });
    case "duplicate":
      return NextResponse.json({ ok: true, status: "already" });
    case "not-configured":
      return NextResponse.json(
        { error: "Subscriptions aren't available right now." },
        { status: 503 },
      );
    default:
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
  }
}
