import { NextResponse } from "next/server";
import { getArcSessionEmail } from "@/lib/arc-auth";
import { getArcReader, saveArcProgress } from "@/lib/arc";

/**
 * Reading-position beacon for the ARC reader. Best-effort by design (modelled
 * on incrementBlogPostViews): it always answers { ok: true } so a failed save
 * never surfaces as an error mid-read, but it still verifies the session and
 * the book assignment before writing anything.
 */
export async function POST(req: Request) {
  const email = await getArcSessionEmail();

  if (!email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let bookSlug = "";
  let chapterOrder = 0;
  let percent = 0;

  try {
    const body = await req.json();
    bookSlug = typeof body?.bookSlug === "string" ? body.bookSlug.trim() : "";
    chapterOrder = Number(body?.chapterOrder);
    percent = Number(body?.percent);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (
    !bookSlug ||
    bookSlug.length > 200 ||
    !Number.isFinite(chapterOrder) ||
    chapterOrder < 1 ||
    !Number.isFinite(percent)
  ) {
    return NextResponse.json({ ok: true });
  }

  // Don't record progress for a book this reader was never given.
  const reader = await getArcReader(email);

  if (
    !reader ||
    reader.status !== "active" ||
    !reader.bookSlugs.includes(bookSlug)
  ) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  await saveArcProgress(email, bookSlug, chapterOrder, percent);

  return NextResponse.json({ ok: true });
}
