import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { EpubParseError, parseEpub } from "@/lib/epub";

/**
 * Step one of the EPUB import: unpack an uploaded manuscript and hand its
 * chapters back for the author to review. Nothing is written — the archive lives
 * only for the length of this request, and the parsed chapters are held in the
 * browser until the author confirms them.
 *
 * A route handler rather than a server action because server actions cap request
 * bodies at 1MB and a novel's EPUB runs well past that.
 */
export const runtime = "nodejs";

/** EPUBs for a novel sit comfortably under this; anything larger is a mistake. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let file: File;

  try {
    const form = await req.formData();
    const upload = form.get("file");

    if (!(upload instanceof File)) {
      return NextResponse.json(
        { error: "Choose an EPUB file to import." },
        { status: 400 },
      );
    }

    file = upload;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That EPUB is too large (10MB maximum)." },
      { status: 413 },
    );
  }

  try {
    const result = await parseEpub(Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      ok: true,
      bookTitle: result.bookTitle,
      chapters: result.chapters,
    });
  } catch (err) {
    // EpubParseError messages are written for the author, so pass them through.
    if (err instanceof EpubParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    console.error("[arc-import-parse]", err);

    return NextResponse.json(
      { error: "Couldn't read that EPUB. Check the server logs." },
      { status: 500 },
    );
  }
}
