import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  ChapterTooLargeError,
  getArcBook,
  getChapterSummaries,
  saveChaptersBulk,
  type SaveChapterInput,
} from "@/lib/arc";
import { sanitizeEpubHtml } from "@/lib/sanitize";
import { getFirebaseDb } from "@/lib/firestore";

/**
 * Step two of the EPUB import: write the chapters the author confirmed.
 *
 * A route handler for the same reason as the parse step — the confirmed payload
 * is the whole manuscript's HTML, which routinely exceeds the 1MB server-action
 * body cap.
 */
export const runtime = "nodejs";

/** Sanity ceiling; a spine longer than this isn't a novel. */
const MAX_CHAPTERS = 300;
const MAX_TITLE_LENGTH = 200;
/** Matches the split threshold in lib/epub.ts, under the Firestore doc cap. */
const MAX_CHAPTER_HTML = 800_000;

type IncomingChapter = { order: number; title: string; html: string };

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  if (!getFirebaseDb()) {
    return NextResponse.json(
      { error: "Firebase is not configured — nothing was saved." },
      { status: 503 },
    );
  }

  let bookSlug = "";
  let incoming: IncomingChapter[] = [];

  try {
    const body = await req.json();
    bookSlug = typeof body?.bookSlug === "string" ? body.bookSlug.trim() : "";
    incoming = Array.isArray(body?.chapters) ? body.chapters : [];
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!bookSlug) {
    return NextResponse.json({ error: "Which book is this for?" }, { status: 400 });
  }

  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "Select at least one chapter to import." },
      { status: 400 },
    );
  }

  if (incoming.length > MAX_CHAPTERS) {
    return NextResponse.json(
      { error: `That's more than ${MAX_CHAPTERS} chapters — split the import.` },
      { status: 400 },
    );
  }

  const book = await getArcBook(bookSlug);

  if (!book) {
    return NextResponse.json({ error: "That book doesn't exist." }, { status: 404 });
  }

  const orders = new Set<number>();

  for (const chapter of incoming) {
    const order = Number(chapter?.order);
    const title = typeof chapter?.title === "string" ? chapter.title.trim() : "";
    const html = typeof chapter?.html === "string" ? chapter.html : "";

    if (!Number.isInteger(order) || order < 1 || order > incoming.length) {
      return NextResponse.json(
        { error: "Chapter numbers must run from 1 upwards with no gaps." },
        { status: 400 },
      );
    }

    if (orders.has(order)) {
      return NextResponse.json(
        { error: `Two chapters share the number ${order}.` },
        { status: 400 },
      );
    }

    orders.add(order);

    if (!title) {
      return NextResponse.json(
        { error: "Every chapter needs a title." },
        { status: 400 },
      );
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `"${title.slice(0, 40)}…" is too long for a chapter title.` },
        { status: 400 },
      );
    }

    if (!html.trim()) {
      return NextResponse.json(
        { error: `"${title}" has no content.` },
        { status: 400 },
      );
    }

    if (html.length > MAX_CHAPTER_HTML) {
      return NextResponse.json(
        { error: `"${title}" is too long for one chapter — split it.` },
        { status: 400 },
      );
    }
  }

  // Orders must be exactly 1..N. Duplicates or gaps would silently break
  // getChapterByOrder, which resolves navigation with a single-result query.
  if (orders.size !== incoming.length) {
    return NextResponse.json(
      { error: "Chapter numbers must run from 1 upwards with no gaps." },
      { status: 400 },
    );
  }

  // Append after any chapters the book already has, so a second import can't
  // collide with the first.
  const existing = await getChapterSummaries(bookSlug);
  const offset = existing.reduce((max, item) => Math.max(max, item.order), 0);

  const payload: SaveChapterInput[] = [...incoming]
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((chapter) => ({
      order: offset + Number(chapter.order),
      title: String(chapter.title).trim(),
      // Re-sanitised server-side: the HTML round-tripped through the browser
      // between the two requests and is never trusted on the way back.
      html: sanitizeEpubHtml(String(chapter.html)),
    }));

  const empty = payload.find((chapter) => !chapter.html.trim());

  if (empty) {
    return NextResponse.json(
      { error: `"${empty.title}" had no usable content after cleaning.` },
      { status: 400 },
    );
  }

  try {
    const imported = await saveChaptersBulk(bookSlug, payload);
    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    if (err instanceof ChapterTooLargeError) {
      return NextResponse.json(
        { error: "One chapter is too large to store — split it and retry." },
        { status: 400 },
      );
    }

    console.error("[arc-import-commit]", err);

    return NextResponse.json(
      { error: "Couldn't save the chapters. Check the server logs." },
      { status: 500 },
    );
  }
}
