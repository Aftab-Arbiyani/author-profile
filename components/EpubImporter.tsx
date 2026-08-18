"use client";

import { useState } from "react";

type Phase = "idle" | "parsing" | "preview" | "committing";

type ParsedChapter = {
  index: number;
  href: string;
  title: string;
  html: string;
  textLength: number;
  defaultSkip: boolean;
  skipReason?: string;
  part?: { n: number; of: number };
};

type Row = ParsedChapter & { include: boolean; order: number };

type Props = {
  bookSlug: string;
  bookTitle: string;
  existingChapterCount: number;
};

/**
 * Two-step EPUB import. The parsed manuscript is held here in component state
 * between the two requests — there's no server-side staging, so navigating away
 * mid-review simply discards it and the author re-uploads.
 *
 * The confirm step exists because an EPUB spine can't be trusted to contain only
 * chapters: covers, copyright pages, dedications, contents and back matter all
 * live in it. The heuristics from lib/epub.ts pre-tick the skip boxes, but the
 * author makes the final call.
 */
export function EpubImporter({
  bookSlug,
  bookTitle,
  existingChapterCount,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [detectedTitle, setDetectedTitle] = useState<string | undefined>();

  const busy = phase === "parsing" || phase === "committing";
  const included = rows.filter((row) => row.include);

  /** Renumbers included rows 1..N in list order, leaving skipped rows at 0. */
  function renumber(next: Row[]): Row[] {
    let order = 0;
    return next.map((row) =>
      row.include ? { ...row, order: (order += 1) } : { ...row, order: 0 },
    );
  }

  async function onParse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file || busy) return;

    setPhase("parsing");
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);

      // No Content-Type header — the browser sets the multipart boundary.
      const res = await fetch("/api/admin/arc/import/parse", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't read that EPUB.");
        setPhase("idle");
        return;
      }

      const parsed: ParsedChapter[] = data.chapters ?? [];
      setDetectedTitle(data.bookTitle);
      setRows(
        renumber(
          parsed.map((chapter) => ({
            ...chapter,
            include: !chapter.defaultSkip,
            order: 0,
          })),
        ),
      );
      setPhase("preview");
    } catch {
      setError("Network error while uploading. Please try again.");
      setPhase("idle");
    }
  }

  async function onCommit() {
    if (busy || included.length === 0) return;

    setPhase("committing");
    setError("");

    try {
      const res = await fetch("/api/admin/arc/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookSlug,
          // Already validated as exactly 1..N, so the author's own numbering is
          // sent through rather than silently reassigned.
          chapters: included
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((row) => ({
              order: row.order,
              title: row.title,
              html: row.html,
            })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Couldn't save the chapters.");
        setPhase("preview");
        return;
      }

      // Full navigation, matching how the rest of admin refreshes after a write.
      window.location.href = `/admin/arc/books/${bookSlug}?status=imported`;
    } catch {
      setError("Network error while saving. Please try again.");
      setPhase("preview");
    }
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.index === index ? { ...row, ...patch } : row,
      );
      // Toggling inclusion re-derives the numbering. Editing a title or an
      // order does not — a hand-set number is left exactly as typed.
      return "include" in patch ? renumber(next) : next;
    });
  }

  const untitled = included.some((row) => !row.title.trim());

  // Mirrors the server's rule: chapter numbers must be exactly 1..N. Enforced
  // here too so a mistake is caught before uploading the whole manuscript.
  const orders = included.map((row) => row.order).sort((a, b) => a - b);
  const misnumbered = orders.some((order, i) => order !== i + 1);

  if (phase === "idle" || phase === "parsing") {
    return (
      <form className="mArcAddForm" onSubmit={onParse}>
        {error && <p className="mArcNotice mTopBarError">{error}</p>}

        <label className="mSettingLabel">
          <span>EPUB file</span>
          <input
            type="file"
            name="file"
            accept=".epub,application/epub+zip"
            required
            disabled={busy}
          />
        </label>

        <p className="mArcHint">
          Chapters are read out of the EPUB and shown here for review before
          anything is saved. Images are not imported.
          {existingChapterCount > 0 && (
            <>
              {" "}
              <strong>{bookTitle}</strong> already has {existingChapterCount}{" "}
              {existingChapterCount === 1 ? "chapter" : "chapters"} — imported
              chapters are added after them.
            </>
          )}
        </p>

        <button type="submit" className="mBtnPublish" disabled={busy}>
          {phase === "parsing" ? "Reading EPUB…" : "Read chapters"}
        </button>
      </form>
    );
  }

  return (
    <div className="mArcAddForm">
      {error && <p className="mArcNotice mTopBarError">{error}</p>}

      <div className="mArcSectionHead">
        <h2 className="mPostListHeading">
          {included.length} of {rows.length} to import
          {detectedTitle ? ` · ${detectedTitle}` : ""}
        </h2>
        <button
          type="button"
          className="mBtnDraft"
          onClick={() => {
            setRows([]);
            setError("");
            setPhase("idle");
          }}
          disabled={busy}
        >
          Start over
        </button>
      </div>

      <p className="mArcHint">
        Untick anything that isn&apos;t a chapter. Pre-unticked rows were flagged
        automatically — check them, the guess isn&apos;t always right.
      </p>

      <ul className="mPostListItems">
        {rows.map((row) => (
          <li className="mPostListItem" key={row.index}>
            <div className="mPostListMeta">
              <label className="mArcCheck">
                <input
                  type="checkbox"
                  checked={row.include}
                  disabled={busy}
                  onChange={(e) =>
                    update(row.index, { include: e.target.checked })
                  }
                />
                <span>{row.include ? `Chapter ${row.order}` : "Skip"}</span>
              </label>
              <span className="mPostListDate">
                {row.textLength.toLocaleString()} characters
                {row.part ? ` · part ${row.part.n} of ${row.part.of}` : ""}
              </span>
            </div>

            <div className="mImportRow">
              <input
                type="number"
                className="mImportOrder"
                value={row.include ? row.order : ""}
                aria-label={`Chapter number for ${row.title}`}
                min={1}
                max={rows.length}
                disabled={busy || !row.include}
                onChange={(e) =>
                  update(row.index, { order: Number(e.target.value) })
                }
              />
              <input
                type="text"
                value={row.title}
                aria-label={`Title for ${row.href}`}
                maxLength={200}
                disabled={busy || !row.include}
                onChange={(e) => update(row.index, { title: e.target.value })}
              />
            </div>

            {row.skipReason && (
              <p className="mPostListExcerpt">{row.skipReason}</p>
            )}
          </li>
        ))}
      </ul>

      {untitled && (
        <p className="mArcNotice mTopBarError">
          Every chapter being imported needs a title.
        </p>
      )}

      {misnumbered && (
        <p className="mArcNotice mTopBarError">
          Chapter numbers must run 1 to {included.length} with no gaps or
          repeats. Untick and re-tick a row to renumber them automatically.
        </p>
      )}

      <button
        type="button"
        className="mBtnPublish"
        onClick={onCommit}
        disabled={busy || included.length === 0 || untitled || misnumbered}
      >
        {phase === "committing"
          ? "Saving chapters…"
          : `Import ${included.length} ${
              included.length === 1 ? "chapter" : "chapters"
            }`}
      </button>
    </div>
  );
}
